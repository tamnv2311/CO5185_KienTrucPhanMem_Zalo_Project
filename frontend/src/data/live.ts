import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { ApiError, accessToken } from "../api/client";
import { liveApi, RemoteAttachment, RemoteConversation, RemoteFriend, RemoteGroup, RemoteMessage, RemoteUser } from "../api/liveApi";
import { colorFor } from "../lib/format";
import { ME_ID } from "./seed";
import type { Attachment, Conversation, DbState, FriendRequest, Message, Role, User } from "./types";

/** What the bridge needs from the store. */
export interface LiveHost {
  db(): DbState;
  remoteUserId(): string | undefined;
  activeConversationId(): string | undefined;
  setDb(update: (db: DbState) => DbState): void;
  setTyping(conversationId: string, userId: string, on: boolean): void;
  /** A message from someone else: appends, bumps unread, shows a toast. */
  incoming(conversationId: string, message: Message): void;
  closeConversation(conversationId: string): void;
  toast(text: string, tone?: "info" | "success" | "error"): void;
  /** The first pull finished (successfully or not). */
  synced(): void;
}

interface RealtimeEvent {
  type: string;
  conversationId?: string;
  data: Record<string, unknown>;
}

const KINDS: Record<string, Message["kind"]> = { TEXT: "text", IMAGE: "image", VIDEO: "video", FILE: "file", STICKER: "sticker", SYSTEM: "system" };
export const SYNCED_KINDS: Message["kind"][] = ["text", "sticker", "image", "video", "file"];

export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại";
}

/**
 * Keeps the local model in sync with the backend while a live session is open:
 * pulls friends/conversations/history over REST and applies WebSocket pushes.
 * Remote ids are used as local ids; only the signed-in user is known locally as ME_ID.
 */
export class LiveSync {
  private client?: Client;
  private watched?: { id: string; subscription: StompSubscription };
  private syncTimer?: ReturnType<typeof setTimeout>;
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastTypingSent = 0;
  private typingStop?: ReturnType<typeof setTimeout>;
  /** Direct conversations being created on the server; sends wait for them. */
  private opening = new Map<string, Promise<unknown>>();

  constructor(private host: LiveHost) {}

  // ---------- id mapping ----------
  local = (remoteUserId: string) => remoteUserId === this.host.remoteUserId() ? ME_ID : remoteUserId;
  remote = (localUserId: string) => localUserId === ME_ID ? (this.host.remoteUserId() ?? ME_ID) : localUserId;

  directId(localUserId: string): string {
    const [a, b] = [this.remote(ME_ID), this.remote(localUserId)].sort();
    return `dm_${a}_${b}`;
  }

  // ---------- lifecycle ----------
  start() {
    void this.sync();
    this.connect();
  }

  stop() {
    clearTimeout(this.syncTimer);
    this.watched = undefined;
    void this.client?.deactivate();
    this.client = undefined;
  }

  /** Coalesces bursts of "something changed" events into one refresh. */
  scheduleSync(delay = 300) {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.sync(), delay);
  }

  private connect() {
    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
      beforeConnect: () => { client.connectHeaders = { Authorization: `Bearer ${accessToken() ?? ""}` }; },
      reconnectDelay: 3000,
      onConnect: () => {
        const me = this.host.remoteUserId();
        if (!me) return;
        client.subscribe(`/topic/users/${me}`, frame => this.onEvent(parse(frame)));
        client.subscribe("/topic/presence", frame => this.onPresence(parse(frame).data));
        const active = this.host.activeConversationId();
        this.watched = undefined;
        if (active) this.watch(active);
        this.scheduleSync(0); // catch up with whatever happened while disconnected
      },
    });
    this.client = client;
    client.activate();
  }

  /** Typing indicators and group receipts only matter for the conversation on screen. */
  watch(conversationId?: string) {
    if (this.watched?.id === conversationId) return;
    try { this.watched?.subscription.unsubscribe(); } catch { /* socket already closed */ }
    this.watched = undefined;
    const remoteId = conversationId && this.host.db().conversations[conversationId]?.remoteId;
    if (!remoteId || !this.client?.connected) return;
    this.watched = {
      id: conversationId,
      subscription: this.client.subscribe(`/topic/conversations/${remoteId}/events`, frame => this.onEvent(parse(frame))),
    };
  }

  // ---------- pull ----------
  async sync() {
    try {
      await this.pull();
    } finally {
      this.host.synced();
    }
  }

  private async pull() {
    if (!this.host.remoteUserId()) return;
    const safe = <T,>(request: Promise<T[]>) => request.catch(() => [] as T[]);
    const [friends, incoming, sent, conversations] = await Promise.all([
      safe(liveApi.friends()), safe(liveApi.incomingRequests()), safe(liveApi.sentRequests()), safe(liveApi.conversations()),
    ]);

    const fetched: RemoteUser[] = [...friends, ...incoming, ...sent].map(f => f.user).filter(Boolean);
    const known = new Set([this.remote(ME_ID), ...fetched.map(u => u.id), ...Object.keys(this.host.db().users)]);
    const missing = Array.from(new Set(conversations.flatMap(c => c.memberIds))).filter(id => !known.has(id));
    fetched.push(...await safe(liveApi.usersByIds(missing.slice(0, 200))));
    const groups = await Promise.all(conversations.filter(c => c.type === "GROUP")
      .map(c => liveApi.group(c.id).catch(() => undefined)));
    const groupById = new Map(groups.filter((g): g is RemoteGroup => !!g).map(g => [g.id, g]));

    this.host.setDb(db => {
      const users = { ...db.users };
      for (const user of fetched) users[user.id] = { ...users[user.id], ...this.toUser(user, users[user.id]) };
      const next: Record<string, Conversation> = {};
      const messages: DbState["messages"] = {};
      // Conversations that only exist locally (the personal cloud) are kept as they are.
      for (const [id, conversation] of Object.entries(db.conversations)) {
        if (!conversation.remoteId) { next[id] = conversation; messages[id] = db.messages[id] ?? []; }
      }
      for (const remote of conversations) {
        next[remote.id] = this.toConversation(remote, groupById.get(remote.id), db.conversations[remote.id]);
        messages[remote.id] = db.messages[remote.id] ?? [];
      }
      return {
        ...db, users, conversations: next, messages,
        friendIds: friends.map(f => f.user.id),
        requests: [...incoming.map(f => this.toRequest(f, true)), ...sent.map(f => this.toRequest(f, false))],
      };
    });

    await Promise.all(conversations.map(remote => {
      const loaded = this.host.db().messages[remote.id] ?? [];
      const lastSeq = loaded.reduce((max, m) => m.status === "sending" || m.status === "failed" ? max : Math.max(max, m.seq), 0);
      return lastSeq < remote.lastSeq ? this.loadHistory(remote.id) : undefined;
    }));
    void this.refreshPresence();
  }

  async loadHistory(conversationId: string) {
    try {
      const remote = (await liveApi.history(conversationId)).map(m => this.toMessage(m));
      const ids = new Set(remote.map(m => m.clientMsgId));
      this.host.setDb(db => db.conversations[conversationId] ? ({
        ...db,
        messages: {
          ...db.messages,
          // Messages still on their way (or failed) are not on the server yet: keep them at the end.
          [conversationId]: [...remote, ...(db.messages[conversationId] ?? []).filter(m => (m.status === "sending" || m.status === "failed") && !ids.has(m.clientMsgId))],
        },
      }) : db);
    } catch { /* keep what is on screen */ }
  }

  private async refreshPresence() {
    const userIds = Object.keys(this.host.db().users).filter(id => id !== ME_ID);
    try {
      const statuses = await liveApi.presence(userIds.slice(0, 400));
      this.host.setDb(db => {
        const users = { ...db.users };
        for (const status of statuses) {
          if (users[status.userId]) users[status.userId] = { ...users[status.userId], online: status.online, lastSeen: status.lastSeen ? Date.parse(status.lastSeen) : users[status.userId].lastSeen };
        }
        return { ...db, users };
      });
    } catch { /* presence is optional */ }
  }

  /** Looks people up on the server and remembers them locally so they can be shown. */
  async searchUsers(query: string): Promise<User[]> {
    const found = await liveApi.searchUsers(query.trim());
    this.host.setDb(db => {
      const users = { ...db.users };
      for (const user of found) users[user.id] = { ...users[user.id], ...this.toUser(user, users[user.id]) };
      return { ...db, users };
    });
    return found.map(user => this.host.db().users[user.id]);
  }

  // ---------- push ----------
  private onEvent(event: RealtimeEvent) {
    const cid = event.conversationId;
    switch (event.type) {
      case "message.new": this.onMessage(event.data as unknown as RemoteMessage); break;
      case "message.updated": this.replaceMessage(this.toMessage(event.data as unknown as RemoteMessage)); break;
      case "message.failed":
        if (cid) this.patchByClientId(cid, String(event.data.clientMsgId), m => ({ ...m, status: "failed" }));
        this.host.toast(String(event.data.message ?? "Không gửi được tin nhắn"), "error");
        break;
      case "receipt": if (cid) this.onReceipt(cid, event.data); break;
      case "typing": if (cid) this.onTyping(cid, String(event.data.userId), Boolean(event.data.typing)); break;
      case "conversation.pins":
        if (cid) this.patchConversation(cid, { pinnedMessageIds: (event.data.pinnedMessageIds as string[]) ?? [] });
        break;
      case "conversation.removed":
        if (cid) this.host.closeConversation(cid);
        break;
      case "friend.requested":
        this.host.toast(`${String(event.data.requesterName ?? "Ai đó")} đã gửi lời mời kết bạn`);
        this.scheduleSync();
        break;
      case "friend.accepted":
        if (event.data.requesterId === this.host.remoteUserId()) this.host.toast(`${String(event.data.recipientName ?? "Bạn mới")} đã đồng ý kết bạn`, "success");
        this.scheduleSync();
        break;
      case "error": this.host.toast(String(event.data.message ?? "Có lỗi xảy ra"), "error"); break;
      default: this.scheduleSync(); // conversation.added / conversation.updated / friend.removed
    }
  }

  private onMessage(remote: RemoteMessage) {
    const cid = remote.conversationId;
    if (!this.host.db().conversations[cid]) { this.scheduleSync(); return; }
    const message = this.toMessage(remote);
    const existing = (this.host.db().messages[cid] ?? []).some(m => m.id === message.id || m.clientMsgId === message.clientMsgId);
    if (existing) { this.replaceMessage(message); return; }
    if (message.senderId === ME_ID || message.kind === "system") {
      this.host.setDb(db => ({
        ...db,
        messages: { ...db.messages, [cid]: [...(db.messages[cid] ?? []), message] },
        conversations: { ...db.conversations, [cid]: { ...db.conversations[cid], hidden: false, updatedAt: message.createdAt } },
      }));
      // A system line usually means members or the group itself changed.
      if (message.kind === "system") this.scheduleSync(600);
      return;
    }
    // Their message is here, so they are no longer "typing".
    clearTimeout(this.typingTimers.get(`${cid}:${message.senderId}`));
    this.host.setTyping(cid, message.senderId, false);
    this.host.incoming(cid, message);
    if (this.host.activeConversationId() === cid && document.visibilityState !== "hidden") {
      void liveApi.markRead(cid).catch(() => undefined);
    } else if (this.client?.connected) {
      this.client.publish({ destination: "/app/chat.delivered", body: JSON.stringify({ conversationId: cid, seq: remote.seq }) });
    }
  }

  private onReceipt(cid: string, data: Record<string, unknown>) {
    const readSeq = Number(data.readSeq ?? 0);
    const deliveredSeq = Number(data.deliveredSeq ?? 0);
    if (this.local(String(data.userId)) === ME_ID) {
      // Read on another device of mine.
      const last = (this.host.db().messages[cid] ?? []).at(-1);
      if (!last || last.seq <= readSeq) this.patchConversation(cid, { unread: 0 });
      return;
    }
    this.host.setDb(db => ({
      ...db,
      messages: {
        ...db.messages,
        [cid]: (db.messages[cid] ?? []).map(m => {
          if (m.senderId !== ME_ID || m.status === "sending" || m.status === "failed" || m.status === "seen") return m;
          if (m.seq <= readSeq) return { ...m, status: "seen" as const };
          if (m.seq <= deliveredSeq && m.status !== "delivered") return { ...m, status: "delivered" as const };
          return m;
        }),
      },
    }));
  }

  private onTyping(cid: string, remoteUserId: string, typing: boolean) {
    const userId = this.local(remoteUserId);
    if (userId === ME_ID) return;
    const key = `${cid}:${userId}`;
    clearTimeout(this.typingTimers.get(key));
    this.host.setTyping(cid, userId, typing);
    // The "stopped typing" event can get lost; never leave the indicator on.
    if (typing) this.typingTimers.set(key, setTimeout(() => this.host.setTyping(cid, userId, false), 5000));
  }

  private onPresence(data: Record<string, unknown>) {
    const userId = this.local(String(data.userId));
    this.host.setDb(db => db.users[userId] && userId !== ME_ID ? ({
      ...db,
      users: { ...db.users, [userId]: { ...db.users[userId], online: Boolean(data.online), lastSeen: data.lastSeen ? Date.parse(String(data.lastSeen)) : db.users[userId].lastSeen } },
    }) : db);
  }

  // ---------- outgoing ----------
  /** Called while the user types; tells the others at most every 2.5 s and clears itself. */
  typing(conversationId: string) {
    const remoteId = this.host.db().conversations[conversationId]?.remoteId;
    if (!remoteId || !this.client?.connected) return;
    const publish = (typing: boolean) => this.client?.connected && this.client.publish({
      destination: "/app/chat.typing", body: JSON.stringify({ conversationId: remoteId, typing }),
    });
    if (Date.now() - this.lastTypingSent > 2500) { this.lastTypingSent = Date.now(); publish(true); }
    clearTimeout(this.typingStop);
    this.typingStop = setTimeout(() => { this.lastTypingSent = 0; publish(false); }, 3000);
  }

  openDirect(conversationId: string, localUserId: string) {
    const pending = liveApi.openDirect(this.remote(localUserId)).catch(() => undefined)
      .finally(() => this.opening.delete(conversationId));
    this.opening.set(conversationId, pending);
  }

  async send(conversationId: string, message: Message) {
    // Sending ends the "typing" state; do not let the pending stop-timer fire later.
    clearTimeout(this.typingStop);
    this.lastTypingSent = 0;
    try {
      await this.opening.get(conversationId);
      const attachments = message.attachments?.length
        ? await Promise.all(message.attachments.map(a => this.upload(a))) : undefined;
      const replyToId = message.replyTo && !message.replyTo.id.startsWith("m_") ? message.replyTo.id : undefined;
      const stored = await liveApi.sendMessage({
        conversationId, clientMsgId: message.clientMsgId, type: message.kind.toUpperCase(),
        content: message.kind === "sticker" ? message.sticker : message.text,
        attachments, replyToId, mentions: message.mentions?.map(this.remote),
      });
      this.replaceMessage(this.toMessage(stored));
      clearTimeout(this.typingStop);
      this.lastTypingSent = 0;
    } catch (error) {
      this.patchByClientId(conversationId, message.clientMsgId, m => ({ ...m, status: "failed" }));
      this.host.toast(errorText(error), "error");
    }
  }

  /** Local previews (blob:/data: URLs) are uploaded to media-service; server files are reused. */
  private async upload(attachment: Attachment): Promise<RemoteAttachment> {
    if (attachment.url.startsWith("/api/media/")) {
      return { mediaId: attachment.id, url: attachment.url, name: attachment.name, size: attachment.size, mime: attachment.mime, kind: attachment.kind.toUpperCase() };
    }
    const blob = await (await fetch(attachment.url)).blob();
    const typed = blob.type ? blob : new Blob([blob], { type: attachment.mime });
    return liveApi.upload(typed, attachment.name);
  }

  // ---------- local model helpers ----------
  private replaceMessage(message: Message) {
    const cid = message.conversationId;
    this.host.setDb(db => db.messages[cid] ? ({
      ...db,
      messages: {
        ...db.messages,
        [cid]: db.messages[cid].map(m => m.id === message.id || m.clientMsgId === message.clientMsgId
          // Keep what only this client knows (e.g. that I deleted it on my side).
          ? { ...message, deletedFor: m.deletedFor, status: rank(m.status) > rank(message.status) ? m.status : message.status }
          : m),
      },
    }) : db);
  }

  private patchByClientId(cid: string, clientMsgId: string, update: (m: Message) => Message) {
    this.host.setDb(db => ({ ...db, messages: { ...db.messages, [cid]: (db.messages[cid] ?? []).map(m => m.clientMsgId === clientMsgId ? update(m) : m) } }));
  }

  private patchConversation(cid: string, patch: Partial<Conversation>) {
    this.host.setDb(db => db.conversations[cid] ? ({ ...db, conversations: { ...db.conversations, [cid]: { ...db.conversations[cid], ...patch } } }) : db);
  }

  // ---------- mapping ----------
  private toUser(remote: RemoteUser, current?: User): User {
    return {
      id: remote.id, name: remote.displayName || "Người dùng", avatar: remote.avatar ?? undefined, cover: remote.cover ?? undefined,
      bio: remote.bio ?? undefined, gender: (remote.gender ?? undefined) as User["gender"], email: remote.email ?? current?.email,
      phone: remote.phone ?? current?.phone, color: colorFor(remote.id), online: current?.online ?? false, lastSeen: current?.lastSeen,
    };
  }

  private toRequest(friend: RemoteFriend, incoming: boolean): FriendRequest {
    return {
      id: String(friend.friendshipId), fromId: incoming ? friend.user.id : ME_ID, toId: incoming ? ME_ID : friend.user.id,
      message: friend.message ?? "", createdAt: friend.createdAt ? Date.parse(friend.createdAt) : Date.now(),
    };
  }

  private toConversation(remote: RemoteConversation, group: RemoteGroup | undefined, current?: Conversation): Conversation {
    const memberIds = remote.memberIds.map(this.local);
    const roles: Record<string, Role> = Object.fromEntries(memberIds.map(id => [id, "member" as Role]));
    for (const member of group?.members ?? []) {
      roles[this.local(member.userId)] = member.role === "OWNER" ? "owner" : member.role === "ADMIN" ? "deputy" : "member";
    }
    const active = this.host.activeConversationId() === remote.id;
    return {
      id: remote.id, remoteId: remote.id, type: remote.type === "GROUP" ? "group" : "direct",
      name: remote.name ?? current?.name, avatar: remote.avatar ?? undefined, description: group?.description ?? current?.description,
      color: colorFor(remote.id), memberIds, roles, pinned: remote.pinned, muted: remote.muted,
      unread: active ? 0 : remote.unreadCount, pinnedMessageIds: remote.pinnedMessageIds ?? [],
      createdAt: remote.createdAt ? Date.parse(remote.createdAt) : current?.createdAt ?? Date.now(),
      updatedAt: remote.updatedAt ? Date.parse(remote.updatedAt) : current?.updatedAt ?? Date.now(),
    };
  }

  toMessage(remote: RemoteMessage): Message {
    const kind = KINDS[remote.type] ?? "text";
    const users = this.host.db().users;
    const created = Date.parse(remote.createdAt);
    const status = String(remote.status ?? "SENT").toLowerCase() as Message["status"];
    return {
      id: remote.id, clientMsgId: remote.clientMsgId, conversationId: remote.conversationId, seq: remote.seq,
      senderId: kind === "system" ? "system" : this.local(remote.senderId), kind,
      text: kind === "sticker" ? undefined : remote.content ?? undefined,
      sticker: kind === "sticker" ? remote.content ?? undefined : undefined,
      attachments: remote.attachments?.length ? remote.attachments.map(a => ({
        id: a.mediaId ?? a.id ?? a.url, name: a.name ?? "Tệp", size: a.size ?? 0, mime: a.mime ?? "application/octet-stream", url: a.url,
        kind: (a.kind ?? "FILE").toLowerCase() as Attachment["kind"],
      })) : undefined,
      replyTo: remote.replyTo ? {
        id: remote.replyTo.id, preview: remote.replyTo.preview ?? "",
        senderName: this.local(remote.replyTo.senderId) === ME_ID ? users[ME_ID]?.name ?? "Bạn" : users[remote.replyTo.senderId]?.name ?? "",
      } : undefined,
      forwarded: remote.forwarded || undefined,
      mentions: remote.mentions?.length ? remote.mentions.map(this.local) : undefined,
      reactions: Object.fromEntries(Object.entries(remote.reactions ?? {}).map(([emoji, ids]) => [emoji, ids.map(this.local)])),
      status: ["sent", "delivered", "seen"].includes(status) ? status : "sent",
      recalled: remote.recalled || undefined,
      createdAt: Number.isFinite(created) ? created : Date.now(),
    };
  }
}

function parse(frame: IMessage): RealtimeEvent {
  return JSON.parse(frame.body) as RealtimeEvent;
}

function rank(status: Message["status"]): number {
  return { sending: 0, failed: 0, sent: 1, delivered: 2, seen: 3 }[status];
}
