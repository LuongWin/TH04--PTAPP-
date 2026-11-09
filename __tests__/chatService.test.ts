import { get, onValue, push, set, update } from 'firebase/database';
import {
  ensureChat,
  markMessagesRead,
  sendMessage,
  watchMessages,
} from '../src/services/chatService';

jest.mock('../src/services/firebase', () => ({ database: {} }));
jest.mock('firebase/database', () => ({
  ref: jest.fn((_db, path = '/') => ({ path })),
  query: jest.fn(value => value),
  orderByChild: jest.fn(value => value),
  onValue: jest.fn(),
  get: jest.fn(),
  push: jest.fn(value => ({ path: `${value.path}/new-message` })),
  serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })),
  set: jest.fn(),
  update: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (set as jest.Mock).mockResolvedValue(undefined);
  (update as jest.Mock).mockResolvedValue(undefined);
});

test('new chat creation tolerates member-only reads and creates indexes after metadata', async () => {
  (get as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('permission_denied'), {
      code: 'PERMISSION_DENIED',
    }),
  );
  const id = await ensureChat('alice', 'bob');
  expect(set).toHaveBeenCalledWith(
    { path: `chats/${id}` },
    { memberA: 'alice', memberB: 'bob', createdAt: { '.sv': 'timestamp' } },
  );
  expect(update).toHaveBeenCalledWith(
    { path: '/' },
    { [`userChats/alice/${id}`]: true, [`userChats/bob/${id}`]: true },
  );
  expect((set as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (update as jest.Mock).mock.invocationCallOrder[0],
  );
});

test('simultaneous creation from the other member accepts only matching existing metadata', async () => {
  (get as jest.Mock)
    .mockRejectedValueOnce(new Error('permission_denied'))
    .mockResolvedValueOnce({
      val: () => ({ memberA: 'alice', memberB: 'bob' }),
    });
  (set as jest.Mock).mockRejectedValueOnce(new Error('Already exists'));
  await expect(ensureChat('bob', 'alice')).resolves.toBeTruthy();
  expect(update).toHaveBeenCalledTimes(1);
});

test('network errors do not attempt to create a new chat', async () => {
  (get as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
  await expect(ensureChat('alice', 'bob')).rejects.toThrow('Network');
  expect(set).not.toHaveBeenCalled();
});

test('empty messages never write to Firebase, valid messages preserve sender and server timestamp', async () => {
  await expect(sendMessage('chat', 'alice', ' \n  ')).rejects.toThrow();
  expect(push).not.toHaveBeenCalled();
  await sendMessage('chat', 'alice', ' Chào bạn! ');
  expect(set).toHaveBeenCalledWith(
    { path: 'messages/chat/new-message' },
    { senderId: 'alice', text: 'Chào bạn!', createdAt: { '.sv': 'timestamp' } },
  );
});

test('marking read updates just the displayed message IDs for the current account', async () => {
  await markMessagesRead('chat', 'alice', ['m1', 'm2']);
  expect(update).toHaveBeenCalledWith(
    { path: '/' },
    { 'messageReads/chat/alice/m1': true, 'messageReads/chat/alice/m2': true },
  );
});

test('repeated realtime snapshots replace messages instead of duplicating them', () => {
  let listener: (snapshot: unknown) => void = () => undefined;
  const stop = jest.fn();
  (onValue as jest.Mock).mockImplementationOnce((_ref, callback) => {
    listener = callback;
    return stop;
  });
  const received = jest.fn();
  const unsubscribe = watchMessages('chat', received, jest.fn());
  const snapshot = {
    forEach: (callback: (value: unknown) => void) =>
      callback({
        key: 'm1',
        val: () => ({ senderId: 'alice', text: 'Chào', createdAt: 1 }),
      }),
  };
  listener(snapshot);
  listener(snapshot);
  expect(received.mock.calls.map(call => call[0].length)).toEqual([1, 1]);
  unsubscribe();
  expect(stop).toHaveBeenCalledTimes(1);
});
