import {
  chatIdFor,
  conversationFor,
  matchesProfile,
  sortMessages,
  unreadMessages,
  validateRegistration,
} from '../src/utils/chat';
import type { Message, UserProfile } from '../src/types/models';

const first: Message = {
  id: 'first',
  senderId: 'alice',
  text: 'Chào Bob',
  createdAt: 100,
};
const second: Message = {
  id: 'second',
  senderId: 'bob',
  text: 'Chào Alice',
  createdAt: 100,
};
const third: Message = {
  id: 'third',
  senderId: 'bob',
  text: 'Tin mới tới đồng thời',
  createdAt: 101,
};

test('both members resolve the same unique chat key', () => {
  expect(chatIdFor('alice', 'bob')).toBe(chatIdFor('bob', 'alice'));
  expect(chatIdFor('ab', 'c')).not.toBe(chatIdFor('a', 'bc'));
  expect(chatIdFor('a.b', 'c/d')).not.toMatch(/[.#$[\]/]/);
  expect(() => chatIdFor('alice', 'alice')).toThrow();
});

test('unread receipts are per message, so reading older messages cannot hide a concurrent incoming message', () => {
  expect(
    unreadMessages([first, second, third], { second: true }, 'alice').map(
      item => item.id,
    ),
  ).toEqual(['third']);
  expect(unreadMessages([first, second], { second: true }, 'alice')).toEqual(
    [],
  );
});

test('conversation preview uses the latest message and excludes chats without messages', () => {
  const chat = { id: 'chat', memberA: 'alice', memberB: 'bob', createdAt: 0 };
  expect(conversationFor(chat, [], {}, 'alice')).toBeNull();
  expect(
    conversationFor(chat, [third, first, second], { second: true }, 'alice'),
  ).toMatchObject({ partnerId: 'bob', lastMessage: third, unreadCount: 1 });
  expect(conversationFor(chat, [first], {}, 'mallory')).toBeNull();
  expect(sortMessages([third, second, first]).map(item => item.id)).toEqual([
    'first',
    'second',
    'third',
  ]);
});

test('Vietnamese names are searchable without diacritics and emails are searchable', () => {
  const profile: UserProfile = {
    uid: 'bob',
    fullName: 'Đặng Toàn Thắng',
    email: 'thang@example.com',
    createdAt: 0,
  };
  expect(matchesProfile(profile, 'dang toan')).toBe(true);
  expect(matchesProfile(profile, 'THANG@')).toBe(true);
  expect(matchesProfile(profile, 'khác')).toBe(false);
});

test('registration rejects empty names, malformed emails, short and mismatching passwords', () => {
  expect(
    validateRegistration('  ', 'a@example.com', '123456', '123456'),
  ).toBeTruthy();
  expect(
    validateRegistration('Alice', 'invalid', '123456', '123456'),
  ).toBeTruthy();
  expect(
    validateRegistration('Alice', 'a@example.com', '12345', '12345'),
  ).toMatch(/6/);
  expect(
    validateRegistration('Alice', 'a@example.com', '123456', 'abcdef'),
  ).toMatch(/khớp/);
  expect(
    validateRegistration('Alice', 'a@example.com', '123456', '123456'),
  ).toBeNull();
});
