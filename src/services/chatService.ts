import {
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import type {
  Chat,
  Message,
  Presence,
  ReadMap,
  UserProfile,
} from '../types/models';
import { chatIdFor, sortMessages } from '../utils/chat';
import { database } from './firebase';

type ErrorHandler = (error: Error) => void;

export function watchUsers(
  callback: (users: Record<string, UserProfile>) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onValue(
    ref(database, 'users'),
    snapshot => {
      const users: Record<string, UserProfile> = {};
      snapshot.forEach(child => {
        users[child.key!] = { ...child.val(), uid: child.key! };
      });
      callback(users);
    },
    onError,
  );
}

export function watchPresence(
  callback: (presence: Record<string, Presence>) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onValue(
    ref(database, 'presence'),
    snapshot => {
      const states: Record<string, Presence> = {};
      snapshot.forEach(child => {
        const value = child.val();
        states[child.key!] = {
          online: Object.keys(value.connections ?? {}).length > 0,
          lastOnline: value.lastOnline ?? null,
        };
      });
      callback(states);
    },
    onError,
  );
}

export const watchConnection = (callback: (connected: boolean) => void) =>
  onValue(ref(database, '.info/connected'), snapshot =>
    callback(snapshot.val() === true),
  );

export function watchChatIndex(
  uid: string,
  callback: (ids: string[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onValue(
    ref(database, `userChats/${uid}`),
    snapshot => callback(Object.keys(snapshot.val() ?? {})),
    onError,
  );
}

export function watchChat(
  chatId: string,
  callback: (chat: Chat | null) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onValue(
    ref(database, `chats/${chatId}`),
    snapshot =>
      callback(snapshot.exists() ? { ...snapshot.val(), id: chatId } : null),
    onError,
  );
}

export function watchMessages(
  chatId: string,
  callback: (messages: Message[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onValue(
    query(ref(database, `messages/${chatId}`), orderByChild('createdAt')),
    snapshot => {
      const messages: Message[] = [];
      snapshot.forEach(child => {
        messages.push({ ...child.val(), id: child.key! });
      });
      // Replace the snapshot rather than appending it: reconnecting cannot duplicate messages.
      callback(sortMessages(messages));
    },
    onError,
  );
}

export function watchReads(
  chatId: string,
  uid: string,
  callback: (reads: ReadMap) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onValue(
    ref(database, `messageReads/${chatId}/${uid}`),
    snapshot => callback(snapshot.val() ?? {}),
    onError,
  );
}

export async function ensureChat(
  uid: string,
  partnerId: string,
): Promise<string> {
  const chatId = chatIdFor(uid, partnerId);
  const chatRef = ref(database, `chats/${chatId}`);
  const isOurChat = (value: { memberA?: string; memberB?: string } | null) =>
    value &&
    [value.memberA, value.memberB].sort().join('|') ===
      [uid, partnerId].sort().join('|');
  let exists = false;
  try {
    const existing = await get(chatRef);
    exists = Boolean(isOurChat(existing.val()));
    if (existing.exists() && !exists) {
      throw new Error('Cuộc trò chuyện không hợp lệ.');
    }
  } catch (error) {
    // Missing chat metadata cannot be read under the member-only rules.
    const code = (error as { code?: string }).code?.toLowerCase() ?? '';
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      !code.includes('permission') &&
      !/permission[_ -]denied/.test(message)
    ) {
      throw error;
    }
  }
  if (!exists) {
    const [memberA, memberB] = [uid, partnerId].sort();
    try {
      await set(chatRef, { memberA, memberB, createdAt: serverTimestamp() });
    } catch (error) {
      // Both members may create the same chat at once; only accept an existing matching pair.
      const existing = await get(chatRef).catch(() => null);
      if (!existing || !isOurChat(existing.val())) {
        throw error;
      }
    }
  }
  // Metadata must exist before this write: the deployed rules use the current root snapshot.
  await update(ref(database), {
    [`userChats/${uid}/${chatId}`]: true,
    [`userChats/${partnerId}/${chatId}`]: true,
  });
  return chatId;
}

export async function sendMessage(
  chatId: string,
  uid: string,
  draft: string,
): Promise<void> {
  const text = draft.trim();
  if (!text) {
    throw new Error('Hãy nhập nội dung tin nhắn.');
  }
  if (text.length > 4000) {
    throw new Error('Tin nhắn tối đa 4.000 ký tự.');
  }
  await set(push(ref(database, `messages/${chatId}`)), {
    senderId: uid,
    text,
    createdAt: serverTimestamp(),
  });
}

export async function sendLocationMessage(
  chatId: string,
  uid: string,
  location: NonNullable<Message['location']>,
): Promise<void> {
  const { latitude, longitude } = location;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error('Tọa độ vị trí không hợp lệ.');
  }
  await set(push(ref(database, `messages/${chatId}`)), {
    senderId: uid,
    text: '📍 Vị trí được chia sẻ',
    location: { latitude, longitude },
    createdAt: serverTimestamp(),
  });
}

export async function markMessagesRead(
  chatId: string,
  uid: string,
  messageIds: string[],
): Promise<void> {
  if (!messageIds.length) {
    return;
  }
  const updates: Record<string, true> = {};
  messageIds.forEach(id => {
    updates[`messageReads/${chatId}/${uid}/${id}`] = true;
  });
  await update(ref(database), updates);
}
