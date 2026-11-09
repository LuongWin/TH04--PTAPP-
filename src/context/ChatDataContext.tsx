import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type {
  Chat,
  Conversation,
  Message,
  Presence,
  ReadMap,
  UserProfile,
} from '../types/models';
import * as service from '../services/chatService';
import { errorMessage } from '../services/errors';
import { conversationFor } from '../utils/chat';

export type ChatState = {
  chat: Chat | null;
  messages: Message[];
  reads: ReadMap;
  ready: boolean;
};
type DataState = {
  users: Record<string, UserProfile>;
  presence: Record<string, Presence>;
  chats: Record<string, ChatState>;
  conversations: Conversation[];
  usersLoading: boolean;
  chatsLoading: boolean;
  connected: boolean;
  error: string | null;
  refresh: () => void;
};
const ChatDataContext = createContext<DataState | null>(null);

export function ChatDataProvider({
  uid,
  children,
}: PropsWithChildren<{ uid: string }>) {
  const [users, setUsers] = useState<DataState['users']>({});
  const [presence, setPresence] = useState<DataState['presence']>({});
  const [chats, setChats] = useState<DataState['chats']>({});
  const [usersLoading, setUsersLoading] = useState(true);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    let indexLoaded = false;
    type Entry = ChatState & { loaded: Set<string>; cleanup: (() => void)[] };
    const entries = new Map<string, Entry>();
    setUsers({});
    setPresence({});
    setChats({});
    setError(null);
    setUsersLoading(true);
    setChatsLoading(true);
    const publish = () => {
      if (!active) {
        return;
      }
      const next: Record<string, ChatState> = {};
      entries.forEach((entry, id) => {
        next[id] = {
          chat: entry.chat,
          messages: entry.messages,
          reads: entry.reads,
          ready: entry.loaded.size === 3,
        };
      });
      setChats(next);
      setChatsLoading(
        !indexLoaded ||
          [...entries.values()].some(entry => entry.loaded.size < 3),
      );
    };
    const fail = (failure: Error) => {
      if (active) {
        setError(errorMessage(failure));
        setChatsLoading(false);
        setUsersLoading(false);
      }
    };
    const cleanup = [
      service.watchUsers(next => {
        if (active) {
          setUsers(next);
          setUsersLoading(false);
        }
      }, fail),
      service.watchPresence(next => {
        if (active) {
          setPresence(next);
        }
      }, fail),
      service.watchConnection(next => {
        if (active) {
          setConnected(next);
        }
      }),
      service.watchChatIndex(
        uid,
        ids => {
          if (!active) {
            return;
          }
          indexLoaded = true;
          const wanted = new Set(ids);
          entries.forEach((entry, id) => {
            if (!wanted.has(id)) {
              entry.cleanup.forEach(stop => stop());
              entries.delete(id);
            }
          });
          ids.forEach(id => {
            if (entries.has(id)) {
              return;
            }
            const entry: Entry = {
              chat: null,
              messages: [],
              reads: {},
              ready: false,
              loaded: new Set(),
              cleanup: [],
            };
            entries.set(id, entry);
            const entryFailure = (failure: Error) => {
              entry.loaded = new Set(['chat', 'messages', 'reads']);
              publish();
              fail(failure);
            };
            entry.cleanup.push(
              service.watchChat(
                id,
                chat => {
                  entry.chat = chat;
                  entry.loaded.add('chat');
                  publish();
                },
                entryFailure,
              ),
              service.watchMessages(
                id,
                messages => {
                  entry.messages = messages;
                  entry.loaded.add('messages');
                  publish();
                },
                entryFailure,
              ),
              service.watchReads(
                id,
                uid,
                reads => {
                  entry.reads = reads;
                  entry.loaded.add('reads');
                  publish();
                },
                entryFailure,
              ),
            );
          });
          publish();
        },
        fail,
      ),
    ];
    return () => {
      active = false;
      cleanup.forEach(stop => stop());
      entries.forEach(entry => entry.cleanup.forEach(stop => stop()));
      entries.clear();
    };
  }, [uid, revision]);

  const conversations = useMemo(
    () =>
      Object.values(chats)
        .map(
          entry =>
            entry.chat &&
            conversationFor(entry.chat, entry.messages, entry.reads, uid),
        )
        .filter((item): item is Conversation => Boolean(item))
        .sort(
          (a, b) =>
            b.lastMessage.createdAt - a.lastMessage.createdAt ||
            b.lastMessage.id.localeCompare(a.lastMessage.id),
        ),
    [chats, uid],
  );
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return (
    <ChatDataContext.Provider
      value={{
        users,
        presence,
        chats,
        conversations,
        usersLoading,
        chatsLoading,
        connected,
        error,
        refresh,
      }}
    >
      {children}
    </ChatDataContext.Provider>
  );
}

export function useChatData() {
  const value = useContext(ChatDataContext);
  if (!value) {
    throw new Error('ChatDataProvider is missing.');
  }
  return value;
}
