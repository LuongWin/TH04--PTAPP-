import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ChatDataProvider, useChatData } from '../src/context/ChatDataContext';
import * as service from '../src/services/chatService';

jest.mock('../src/services/chatService', () => ({
  watchUsers: jest.fn(),
  watchPresence: jest.fn(),
  watchConnection: jest.fn(),
  watchChatIndex: jest.fn(),
  watchChat: jest.fn(),
  watchMessages: jest.fn(),
  watchReads: jest.fn(),
}));

test('one subscription per chat, unread updates in realtime, and every listener is removed on account change/unmount', async () => {
  const callbacks: Record<string, (...args: any[]) => void> = {};
  const stops: jest.Mock[] = [];
  Object.entries(service).forEach(([name, fn]) => {
    if (!jest.isMockFunction(fn)) {
      return;
    }
    (fn as jest.Mock).mockImplementation((...args: any[]) => {
      const callback = args.find(arg => typeof arg === 'function');
      callbacks[name] = callback;
      const stop = jest.fn();
      stops.push(stop);
      return stop;
    });
  });
  let latest: ReturnType<typeof useChatData>;
  function Consumer() {
    latest = useChatData();
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = TestRenderer.create(
      <ChatDataProvider uid="alice">
        <Consumer />
      </ChatDataProvider>,
    );
  });
  await act(() => {
    callbacks.watchChatIndex(['chat']);
    callbacks.watchChatIndex(['chat']);
  });
  expect(service.watchMessages).toHaveBeenCalledTimes(1);
  const message = { id: 'm1', senderId: 'bob', text: 'Xin chào', createdAt: 1 };
  await act(() => {
    callbacks.watchChat({
      id: 'chat',
      memberA: 'alice',
      memberB: 'bob',
      createdAt: 0,
    });
    callbacks.watchReads({});
    callbacks.watchMessages([message]);
  });
  expect(latest!.conversations[0].unreadCount).toBe(1);
  await act(() => {
    callbacks.watchMessages([message]);
  });
  expect(latest!.conversations[0].messages).toHaveLength(1);
  await act(() => {
    callbacks.watchReads({ m1: true });
  });
  expect(latest!.conversations[0].unreadCount).toBe(0);
  const firstStops = [...stops];
  await act(() => {
    renderer!.update(
      <ChatDataProvider uid="bob">
        <Consumer />
      </ChatDataProvider>,
    );
  });
  firstStops.forEach(stop => expect(stop).toHaveBeenCalledTimes(1));
  expect(latest!.conversations).toHaveLength(0);
  await act(() => {
    renderer!.unmount();
  });
  stops.forEach(stop => expect(stop).toHaveBeenCalledTimes(1));
});
