export type Role = "owner" | "deputy" | "member";
export type ConversationType = "direct" | "group" | "self";
export type MessageKind = "text" | "image" | "video" | "file" | "sticker" | "system" | "call" | "poll";
export type MessageStatus = "sending" | "sent" | "delivered" | "seen" | "failed";
export type Gender = "male" | "female" | "other";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  cover?: string;
  color: string;
  bio?: string;
  gender?: Gender;
  birthday?: string;
  online: boolean;
  lastSeen?: number;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  url: string;
  kind: "image" | "video" | "file";
}

export interface ReplyRef {
  id: string;
  senderName: string;
  preview: string;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface Poll {
  question: string;
  options: PollOption[];
  multiple: boolean;
}

export interface CallInfo {
  video: boolean;
  durationSec: number;
  missed: boolean;
}

export interface Message {
  id: string;
  clientMsgId: string;
  conversationId: string;
  seq: number;
  senderId: string;
  kind: MessageKind;
  text?: string;
  attachments?: Attachment[];
  sticker?: string;
  poll?: Poll;
  call?: CallInfo;
  replyTo?: ReplyRef;
  forwarded?: boolean;
  mentions?: string[];
  reactions: Record<string, string[]>;
  status: MessageStatus;
  recalled?: boolean;
  deletedFor?: string[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  avatar?: string;
  color?: string;
  description?: string;
  memberIds: string[];
  roles: Record<string, Role>;
  pinned: boolean;
  muted: boolean;
  unread: number;
  pinnedMessageIds: string[];
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
  /** Id of the conversation on the backend (live mode). */
  remoteId?: string;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  message: string;
  createdAt: number;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  fontSize: "sm" | "md" | "lg";
  enterToSend: boolean;
  showOnline: boolean;
  readReceipts: boolean;
  notifySound: boolean;
}

export interface Session {
  /** Key of the local cache (the login e-mail). */
  userId: string;
  /** Id of the account on the backend (live mode). */
  remoteUserId?: string;
  mode: "live" | "demo";
  accessToken?: string;
  refreshToken?: string;
}

export interface DailyPoint {
  date: string;
  messages: number;
  activeUsers: number;
}

export interface StatsSnapshot {
  totalMessages: number;
  activeUsers: number;
  newUsers: number;
  totalMedia: number;
  daily: DailyPoint[];
  media: { kind: string; count: number }[];
  topGroups: { id: string; name: string; messages: number }[];
  topUsers: { id: string; name: string; messages: number }[];
  source: "api" | "local";
}

export interface DbState {
  users: Record<string, User>;
  friendIds: string[];
  requests: FriendRequest[];
  conversations: Record<string, Conversation>;
  messages: Record<string, Message[]>;
  typing: Record<string, string[]>;
  settings: Settings;
}
