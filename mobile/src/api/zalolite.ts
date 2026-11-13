import { api } from "./client";

/** Shapes returned by the ZaloLite backend (through the API gateway). */

export interface RemoteUser {
  id: string;
  displayName: string;
  avatar?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  /** SELF, FRIEND, REQUEST_SENT, REQUEST_RECEIVED, BLOCKED or NONE, from the viewer's point of view. */
  relation?: string;
  friendshipId?: number | null;
}

export interface RemoteFriend {
  friendshipId: number;
  status: string;
  message?: string | null;
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
  reactions?: Record<string, string[]>;
  recalled?: boolean;
  status?: string;
  createdAt: string;
}

export interface RemoteConversation {
  id: string;
  type: "DIRECT" | "GROUP";
  groupId?: string;
  peerId?: string;
  name?: string | null;
  avatar?: string | null;
  memberIds: string[];
  lastSeq: number;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

export interface RemoteGroup {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  ownerId: string;
  members?: { userId: string; role: GroupRole }[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user?: RemoteUser;
}

export interface OutgoingMessage {
  conversationId: string;
  clientMsgId: string;
  type: string;
  content?: string;
  attachments?: RemoteAttachment[];
  replyToId?: string;
}

/** A file picked on the device, ready to be uploaded. */
export interface LocalFile {
  uri: string;
  name: string;
  mime: string;
}

const json = (body: unknown) => JSON.stringify(body);
const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body === undefined ? undefined : json(body) });
const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: json(body) });
const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
const ids = (list: string[]) => encodeURIComponent(list.join(","));

export const zalolite = {
  // ---------- account ----------
  login: (email: string, password: string) => post<AuthResult>("/auth/login", { email, password }),
  register: (email: string, password: string, displayName: string) => post<AuthResult>("/auth/register", { email, password, displayName }),
  logout: (refreshToken: string) => post<unknown>("/auth/logout", { refreshToken }),
  me: () => api<RemoteUser>("/users/me"),
  updateMe: (patch: { displayName?: string; bio?: string; avatar?: string }) => put<RemoteUser>("/users/me", patch),

  // ---------- people ----------
  searchUsers: (query: string) => api<RemoteUser[]>(`/users/search?q=${encodeURIComponent(query)}`),
  usersByIds: (userIds: string[]) => userIds.length ? api<RemoteUser[]>(`/users?ids=${ids(userIds)}`) : Promise.resolve([]),
  friends: () => api<RemoteFriend[]>("/friends"),
  incomingRequests: () => api<RemoteFriend[]>("/friends/requests/pending"),
  sentRequests: () => api<RemoteFriend[]>("/friends/requests/sent"),
  sendFriendRequest: (userId: string, message: string) => post<RemoteFriend>("/friends/requests", { userId, message }),
  acceptRequest: (friendshipId: number) => post<RemoteFriend>(`/friends/requests/${friendshipId}/accept`),
  rejectRequest: (friendshipId: number) => post<unknown>(`/friends/requests/${friendshipId}/reject`),
  cancelRequest: (friendshipId: number) => post<unknown>(`/friends/requests/${friendshipId}/cancel`),
  unfriend: (userId: string) => del<unknown>(`/friends/${userId}`),
  presence: (userIds: string[]) => userIds.length
    ? api<{ userId: string; online: boolean; lastSeen?: string }[]>(`/chat/presence?ids=${ids(userIds)}`) : Promise.resolve([]),

  // ---------- conversations & messages ----------
  conversations: () => api<RemoteConversation[]>("/chat/conversations"),
  openDirect: (peerId: string) => post<RemoteConversation>(`/chat/conversations/direct?peerId=${encodeURIComponent(peerId)}`),
  history: (conversationId: string, beforeSeq?: number) =>
    api<RemoteMessage[]>(`/chat/conversations/${conversationId}/messages?limit=40${beforeSeq ? `&beforeSeq=${beforeSeq}` : ""}`),
  sendMessage: (message: OutgoingMessage) => post<RemoteMessage>("/chat/messages", message),
  markRead: (conversationId: string) => post<unknown>(`/chat/conversations/${conversationId}/read`),
  conversationSettings: (conversationId: string, settings: { pinned?: boolean; muted?: boolean }) =>
    put<unknown>(`/chat/conversations/${conversationId}/settings`, settings),
  react: (messageId: string, emoji: string) => post<RemoteMessage>(`/chat/messages/${messageId}/reactions`, { emoji }),
  recall: (messageId: string) => post<RemoteMessage>(`/chat/messages/${messageId}/recall`),
  deleteMessage: (messageId: string) => del<unknown>(`/chat/messages/${messageId}`),
  async upload(file: LocalFile): Promise<RemoteAttachment> {
    const form = new FormData();
    // React Native uploads a local file when the part is described by its uri.
    form.append("file", { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
    const media = await api<RemoteAttachment>("/media", { method: "POST", body: form });
    return { ...media, mediaId: media.id };
  },

  // ---------- groups ----------
  group: (groupId: string) => api<RemoteGroup>(`/groups/${groupId}`),
  createGroup: (name: string, memberIds: string[]) => post<RemoteGroup>("/groups", { name, memberIds }),
  addMembers: (groupId: string, userIds: string[]) => post<unknown>(`/groups/${groupId}/members`, { userIds }),
  removeMember: (groupId: string, userId: string) => del<unknown>(`/groups/${groupId}/members/${userId}`),
  leaveGroup: (groupId: string) => post<unknown>(`/groups/${groupId}/leave`),
};
