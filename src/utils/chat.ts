import type {
  Chat,
  Conversation,
  Message,
  ReadMap,
  UserProfile,
} from '../types/models';

export function chatIdFor(first: string, second: string): string {
  if (!first || !second || first === second) {
    throw new Error('Hãy chọn một người khác để trò chuyện.');
  }
  return [first, second]
    .sort()
    .map(
      uid => `${uid.length}:${encodeURIComponent(uid).replace(/\./g, '%2E')}`,
    )
    .join('|');
}

export function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}

export function unreadMessages(
  messages: Message[],
  reads: ReadMap,
  uid: string,
): Message[] {
  return messages.filter(
    message => message.senderId !== uid && !reads[message.id],
  );
}

export function conversationFor(
  chat: Chat,
  messages: Message[],
  reads: ReadMap,
  uid: string,
): Conversation | null {
  const sorted = sortMessages(messages);
  const lastMessage = sorted[sorted.length - 1];
  if (!lastMessage || (chat.memberA !== uid && chat.memberB !== uid)) {
    return null;
  }
  return {
    chat,
    messages: sorted,
    reads,
    lastMessage,
    partnerId: chat.memberA === uid ? chat.memberB : chat.memberA,
    unreadCount: unreadMessages(sorted, reads, uid).length,
  };
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function matchesProfile(
  profile: UserProfile | undefined,
  search: string,
): boolean {
  return (
    !search.trim() ||
    Boolean(
      profile &&
        normalizeSearch(`${profile.fullName} ${profile.email}`).includes(
          normalizeSearch(search),
        ),
    )
  );
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map(word => word[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function clockTime(timestamp: number): string {
  if (!timestamp) {
    return 'Đang gửi';
  }
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function conversationTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toDateString() === new Date().toDateString()
    ? clockTime(timestamp)
    : new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      }).format(date);
}

export function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) {
    return 'Hôm nay';
  }
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function validateRegistration(
  fullName: string,
  email: string,
  password: string,
  confirmation: string,
): string | null {
  if (
    !fullName.trim() ||
    fullName.trim().length > 100 ||
    /[\r\n]/.test(fullName)
  ) {
    return 'Họ tên cần từ 1 đến 100 ký tự, trên một dòng.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Vui lòng nhập địa chỉ email hợp lệ.';
  }
  if (password.length < 6) {
    return 'Mật khẩu cần ít nhất 6 ký tự.';
  }
  if (password !== confirmation) {
    return 'Mật khẩu nhập lại chưa khớp.';
  }
  return null;
}
