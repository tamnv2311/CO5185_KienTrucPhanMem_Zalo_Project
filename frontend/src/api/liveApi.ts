import { api } from "./client";
import type { StatsSnapshot, User } from "../data/types";
import { colorFor } from "../lib/format";

/**
 * Calls to the real ZaloLite backend (through the API gateway).
 * Every function throws ApiError; callers decide whether to fall back or to show the message.
 */

type Loose = Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
const json = (body: unknown) => JSON.stringify(body);
const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body === undefined ? undefined : json(body) });
const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: json(body) });
const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user?: Partial<User>;
}

export interface RemoteUser {
  id: string;
  displayName: string;
  avatar?: string;
  cover?: string;
  bio?: string;
  gender?: string;
  email?: string;
  phone?: string;
  relation?: string;
  friendshipId?: number;
}

export interface RemoteFriend {
  friendshipId: number;
  status: string;
  message?: string;
  createdAt?: string;
  requesterId: string;
  recipientId: string;
  user: RemoteUser;
}

export interface RemoteAttachment {
  mediaId?: string;
  id?: string;
  url: string;
  name?: string;
  size?: number;
  mime?: string;
  kind?: string;
}

export interface RemoteMessage {
  id: string;
  conversationId: string;
  seq: number;
  clientMsgId: string;
  senderId: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "STICKER" | "SYSTEM";
  content?: string | null;
  attachments?: RemoteAttachment[];
  replyTo?: { id: string; senderId: string; preview?: string } | null;
  mentions?: string[];
  reactions?: Record<string, string[]>;
  recalled?: boolean;
  forwarded?: boolean;
  status?: string;
  createdAt: string;
}

export interface RemoteConversation {
  id: string;
  type: "DIRECT" | "GROUP";
  groupId?: string;
  peerId?: string;
  name?: string;
  avatar?: string;
  memberIds: string[];
  lastSeq: number;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  pinnedMessageIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteGroup {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  ownerId: string;
  members?: { userId: string; role: "OWNER" | "ADMIN" | "MEMBER" }[];
}

export interface OutgoingRemoteMessage {
  conversationId: string;
  clientMsgId: string;
  type: string;
  content?: string;
  attachments?: RemoteAttachment[];
  replyToId?: string;
  mentions?: string[];
}

function toUser(raw: Loose): Partial<User> {
  const id = str(raw.id ?? raw.userId);
  return {
    id,
    name: str(raw.displayName ?? raw.name) ?? "",
    email: str(raw.email),
    phone: str(raw.phone),
    avatar: str(raw.avatar ?? raw.avatarUrl),
    cover: str(raw.cover),
    bio: str(raw.bio),
    gender: str(raw.gender) as User["gender"],
    birthday: str(raw.birthday),
    color: colorFor(id ?? "x"),
  };
}

function toAuth(raw: Loose): AuthResult {
  const user = (raw.user ?? raw.account ?? raw.profile) as Loose | undefined;
  return {
    accessToken: String(raw.accessToken ?? raw.token),
    refreshToken: String(raw.refreshToken ?? ""),
    user: user ? toUser(user) : undefined,
  };
}

const ids = (list: string[]) => encodeURIComponent(list.join(","));

export const liveApi = {
  // ---------- account ----------
  async login(email: string, password: string): Promise<AuthResult> {
    return toAuth(await post<Loose>("/auth/login", { email, password }));
  },
  async register(email: string, password: string, displayName: string): Promise<AuthResult> {
    return toAuth(await post<Loose>("/auth/register", { email, password, displayName }));
  },
  async logout(refreshToken: string): Promise<void> {
    await post("/auth/logout", { refreshToken });
  },
  async me(): Promise<Partial<User>> {
    return toUser(await api<Loose>("/users/me"));
  },
  async updateMe(patch: Partial<User>): Promise<Partial<User>> {
    return toUser(await put<Loose>("/users/me", {
      displayName: patch.name, avatar: patch.avatar, cover: patch.cover, bio: patch.bio,
      phone: patch.phone || undefined, gender: patch.gender, birthday: patch.birthday,
    }));
  },
  changePassword: (currentPassword: string, newPassword: string) => put<unknown>("/users/me/password", { currentPassword, newPassword }),

  // ---------- people ----------
  searchUsers: (query: string) => api<RemoteUser[]>(`/users/search?q=${encodeURIComponent(query)}`),
  usersByIds: (userIds: string[]) => userIds.length ? api<RemoteUser[]>(`/users?ids=${ids(userIds)}`) : Promise.resolve([]),
  friends: () => api<RemoteFriend[]>("/friends"),
  incomingRequests: () => api<RemoteFriend[]>("/friends/requests/pending"),
  sentRequests: () => api<RemoteFriend[]>("/friends/requests/sent"),
  sendFriendRequest: (userId: string, message: string) => post<RemoteFriend>("/friends/requests", { userId, message }),
  acceptRequest: (friendshipId: string) => post<RemoteFriend>(`/friends/requests/${friendshipId}/accept`),
  rejectRequest: (friendshipId: string) => post<unknown>(`/friends/requests/${friendshipId}/reject`),
  cancelRequest: (friendshipId: string) => post<unknown>(`/friends/requests/${friendshipId}/cancel`),
  unfriend: (userId: string) => del<unknown>(`/friends/${userId}`),
  presence: (userIds: string[]) => userIds.length
    ? api<{ userId: string; online: boolean; lastSeen?: string }[]>(`/chat/presence?ids=${ids(userIds)}`) : Promise.resolve([]),

  // ---------- conversations & messages ----------
  conversations: () => api<RemoteConversation[]>("/chat/conversations"),
  openDirect: (peerId: string) => post<RemoteConversation>(`/chat/conversations/direct?peerId=${encodeURIComponent(peerId)}`),
  history: (conversationId: string, beforeSeq?: number) =>
    api<RemoteMessage[]>(`/chat/conversations/${conversationId}/messages?limit=60${beforeSeq ? `&beforeSeq=${beforeSeq}` : ""}`),
  sendMessage: (message: OutgoingRemoteMessage) => post<RemoteMessage>("/chat/messages", message),
  markRead: (conversationId: string) => post<unknown>(`/chat/conversations/${conversationId}/read`),
  conversationSettings: (conversationId: string, settings: { pinned?: boolean; muted?: boolean }) =>
    put<unknown>(`/chat/conversations/${conversationId}/settings`, settings),
  clearConversation: (conversationId: string) => del<unknown>(`/chat/conversations/${conversationId}`),
  react: (messageId: string, emoji: string) => post<RemoteMessage>(`/chat/messages/${messageId}/reactions`, { emoji }),
  recall: (messageId: string) => post<RemoteMessage>(`/chat/messages/${messageId}/recall`),
  deleteMessage: (messageId: string) => del<unknown>(`/chat/messages/${messageId}`),
  pinMessage: (messageId: string, pinned: boolean) => put<unknown>(`/chat/messages/${messageId}/pin`, { pinned }),
  async upload(file: Blob, name: string): Promise<RemoteAttachment> {
    const form = new FormData();
    form.append("file", file, name);
    const media = await api<RemoteAttachment>("/media", { method: "POST", body: form });
    return { ...media, mediaId: media.id };
  },

  // ---------- groups ----------
  group: (groupId: string) => api<RemoteGroup>(`/groups/${groupId}`),
  createGroup: (name: string, memberIds: string[], avatar?: string) => post<RemoteGroup>("/groups", { name, memberIds, avatar }),
  updateGroup: (groupId: string, patch: { name?: string; description?: string; avatar?: string }) => put<unknown>(`/groups/${groupId}`, patch),
  addMembers: (groupId: string, userIds: string[]) => post<unknown>(`/groups/${groupId}/members`, { userIds }),
  removeMember: (groupId: string, userId: string) => del<unknown>(`/groups/${groupId}/members/${userId}`),
  setRole: (groupId: string, userId: string, role: "ADMIN" | "MEMBER") => put<unknown>(`/groups/${groupId}/members/${userId}/role`, { role }),
  transferOwnership: (groupId: string, userId: string) => post<unknown>(`/groups/${groupId}/owner`, { userId }),
  leaveGroup: (groupId: string) => post<unknown>(`/groups/${groupId}/leave`),
  deleteGroup: (groupId: string) => del<unknown>(`/groups/${groupId}`),

  // ---------- statistics ----------
  async stats(): Promise<Partial<StatsSnapshot>> {
    const [overview, groups, media, history, users] = await Promise.all([
      api<Loose>("/stats/overview"),
      api<Loose[]>("/stats/groups"),
      api<Loose[]>("/stats/media"),
      api<Loose[]>("/stats/history?days=7").catch(() => [] as Loose[]),
      api<Loose[]>("/stats/users").catch(() => [] as Loose[]),
    ]);
    const kinds: Record<string, string> = { IMAGE: "Ảnh", VIDEO: "Video", FILE: "Tệp" };
    return {
      totalMessages: Number(overview.totalMessages ?? 0),
      activeUsers: Number(overview.activeUsers ?? 0),
      newUsers: Number(overview.newUsers ?? 0),
      totalMedia: Number(overview.totalMedia ?? 0),
      topGroups: (groups ?? []).map(g => ({ id: String(g.groupId), name: String(g.groupName ?? g.groupId), messages: Number(g.messageCount ?? 0) })),
      media: (media ?? []).map(m => ({ kind: kinds[String(m.mediaKind)] ?? String(m.mediaKind), count: Number(m.count ?? 0) })),
      daily: history.map(d => ({ date: String(d.date).slice(5).split("-").reverse().join("/"), messages: Number(d.totalMessages ?? 0), activeUsers: Number(d.activeUsers ?? 0) })),
      topUsers: users.map(u => ({ id: String(u.userId), name: String(u.displayName ?? u.userId), messages: Number(u.messageCount ?? 0) })),
      source: "api",
    };
  },
};
