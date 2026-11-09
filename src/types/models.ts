export type UserProfile = {
  uid: string;
  fullName: string;
  email: string;
  createdAt: number;
  avatarUrl?: string;
};

export type Presence = { online: boolean; lastOnline: number | null };
export type Chat = {
  id: string;
  memberA: string;
  memberB: string;
  createdAt: number;
};
export type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  location?: { latitude: number; longitude: number };
};
export type ReadMap = Record<string, true>;
export type Conversation = {
  chat: Chat;
  partnerId: string;
  messages: Message[];
  reads: ReadMap;
  lastMessage: Message;
  unreadCount: number;
};
