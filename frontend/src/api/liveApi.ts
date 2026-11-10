import { api } from "./client";
import type { Conversation, Message, StatsSnapshot, User } from "../data/types";
import { colorFor } from "../lib/format";

/**
 * Calls to the real ZaloLite backend (through the API gateway).
 * Every function throws ApiError when the backend is unavailable so the store
 * can fall back to the local demo data.
 */

type Loose = Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user?: Partial<User>;
}

function toUser(raw: Loose): Partial<User> {
  const id = str(raw.id ?? raw.userId);
  return {
    id,
    name: str(raw.displayName ?? raw.name) ?? "",
    email: str(raw.email),
    phone: str(raw.phone),
    avatar: str(raw.avatar ?? raw.avatarUrl),
    bio: str(raw.bio),
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

export const liveApi = {
  async login(email: string, password: string): Promise<AuthResult> {
    return toAuth(await api<Loose>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
  },

  async register(email: string, password: string, displayName: string): Promise<AuthResult> {
    return toAuth(await api<Loose>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) }));
  },

  async logout(refreshToken: string): Promise<void> {
    await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
  },

  async me(): Promise<Partial<User>> {
    return toUser(await api<Loose>("/users/me"));
  },

  async updateMe(patch: Partial<User>): Promise<Partial<User>> {
    return toUser(await api<Loose>("/users/me", {
      method: "PUT",
      body: JSON.stringify({ displayName: patch.name, avatar: patch.avatar, bio: patch.bio, phone: patch.phone }),
    }));
  },

  async sendFriendRequest(target: string, message: string): Promise<void> {
    await api("/friends/requests", { method: "POST", body: JSON.stringify({ target, email: target, message }) });
  },

  async groups(): Promise<Partial<Conversation>[]> {
    const list = await api<Loose[]>("/groups");
    return (list ?? []).map(raw => ({
      remoteId: str(raw.id ?? raw.groupId),
      name: str(raw.name),
      avatar: str(raw.avatar),
      type: "group" as const,
    }));
  },

  async createGroup(name: string, memberIds: string[]): Promise<string | undefined> {
    const raw = await api<Loose>("/groups", { method: "POST", body: JSON.stringify({ name, memberIds }) });
    return str(raw?.id ?? raw?.groupId);
  },

  async messages(remoteConversationId: string): Promise<Partial<Message>[]> {
    const list = await api<Loose[]>(`/chat/conversations/${remoteConversationId}/messages`);
    return (list ?? []).map(toMessage);
  },

  async sendMessage(remoteConversationId: string, clientMsgId: string, content: string, type = "TEXT"): Promise<Partial<Message>> {
    const raw = await api<Loose>("/chat/messages", {
      method: "POST",
      body: JSON.stringify({ conversationId: remoteConversationId, clientMsgId, content, type }),
    });
    return toMessage(raw);
  },

  async stats(): Promise<Partial<StatsSnapshot>> {
    const [overview, groups, media] = await Promise.all([
      api<Loose>("/stats/overview"),
      api<Loose[]>("/stats/groups"),
      api<Loose[]>("/stats/media"),
    ]);
    return {
      totalMessages: Number(overview.totalMessages ?? 0),
      activeUsers: Number(overview.activeUsers ?? 0),
      newUsers: Number(overview.newUsers ?? 0),
      totalMedia: Number(overview.totalMedia ?? 0),
      topGroups: (groups ?? []).map(g => ({ id: String(g.groupId), name: String(g.groupName ?? g.groupId), messages: Number(g.messageCount ?? 0) })),
      media: (media ?? []).map(m => ({ kind: String(m.mediaKind), count: Number(m.count ?? 0) })),
      source: "api",
    };
  },
};

export function toMessage(raw: Loose): Partial<Message> {
  const status = String(raw.status ?? "SENT").toLowerCase() as Message["status"];
  const created = raw.createdAt ? new Date(String(raw.createdAt)).getTime() : Date.now();
  return {
    id: str(raw.id),
    clientMsgId: str(raw.clientMsgId),
    seq: Number(raw.seq ?? 0),
    senderId: str(raw.senderId),
    text: str(raw.content ?? raw.text),
    kind: "text",
    status: ["sent", "delivered", "seen"].includes(status) ? status : "sent",
    createdAt: Number.isFinite(created) ? created : Date.now(),
  };
}
