import { useSyncExternalStore } from "react";
import { ApiError } from "../api/client";
import { liveApi } from "../api/liveApi";
import { colorFor, uid } from "../lib/format";
import { CANNED_REPLIES, ME_ID, createSeed } from "./seed";
import type {
  Attachment, CallInfo, Conversation, DbState, FriendRequest, Message, Poll, ReplyRef, Role, Session, Settings, StatsSnapshot, User,
} from "./types";

export interface Toast {
  id: string;
  text: string;
  tone?: "info" | "success" | "error";
  conversationId?: string;
}

export interface AppState {
  session?: Session;
  db: DbState;
  activeConversationId?: string;
  toasts: Toast[];
}

export interface OutgoingMessage {
  kind: Message["kind"];
  text?: string;
  attachments?: Attachment[];
  sticker?: string;
  poll?: Poll;
  call?: CallInfo;
  replyTo?: ReplyRef;
  mentions?: string[];
  forwarded?: boolean;
}

const SESSION_KEY = "zalolite.session";
const dbKey = (userId: string) => `zalolite.db.v1.${userId}`;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* storage unavailable or full – demo keeps working in memory */ }
}

/** Blob/object URLs die with the page, so they are not persisted. */
function persistable(db: DbState): DbState {
  const messages: DbState["messages"] = {};
  for (const [cid, list] of Object.entries(db.messages)) {
    messages[cid] = list.map(m => m.attachments?.some(a => a.url.startsWith("blob:"))
      ? { ...m, attachments: m.attachments.map(a => a.url.startsWith("blob:") ? { ...a, url: "#" } : a) }
      : m);
  }
  return { ...db, messages, typing: {} };
}

class AppStore {
  private state: AppState;
  private listeners = new Set<() => void>();
  private saveTimer?: ReturnType<typeof setTimeout>;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    const raw = safeGet(SESSION_KEY);
    const session = raw ? (JSON.parse(raw) as Session) : undefined;
    this.state = { session, db: session ? this.loadDb(session.userId) : createSeed(), toasts: [] };
  }

  // ---------- plumbing ----------
  getState = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }

  private setDb(update: (db: DbState) => DbState) {
    this.set({ db: update(this.state.db) });
    this.scheduleSave();
  }

  private scheduleSave() {
    const session = this.state.session;
    if (!session) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => safeSet(dbKey(session.userId), JSON.stringify(persistable(this.state.db))), 400);
  }

  private loadDb(userId: string): DbState {
    const raw = safeGet(dbKey(userId));
    if (raw) {
      try { return { ...(JSON.parse(raw) as DbState), typing: {} }; } catch { /* fall through */ }
    }
    return createSeed();
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  get me(): User {
    return this.state.db.users[ME_ID];
  }

  get isLive(): boolean {
    return this.state.session?.mode === "live";
  }

  // ---------- toasts ----------
  toast(text: string, tone: Toast["tone"] = "info", conversationId?: string) {
    const toast = { id: uid("t"), text, tone, conversationId };
    this.set({ toasts: [...this.state.toasts, toast].slice(-4) });
    setTimeout(() => this.dismissToast(toast.id), 4000);
  }

  dismissToast(id: string) {
    this.set({ toasts: this.state.toasts.filter(t => t.id !== id) });
  }

  // ---------- auth ----------
  private startSession(session: Session, profile?: Partial<User>) {
    safeSet(SESSION_KEY, JSON.stringify(session));
    safeSet("accessToken", session.accessToken ?? null);
    safeSet("refreshToken", session.refreshToken ?? null);
    const stored = safeGet(dbKey(session.userId));
    let db = stored ? this.loadDb(session.userId) : createSeed(profile ? { name: profile.name, email: profile.email } : {});
    if (profile) {
      const me = db.users[ME_ID];
      db = { ...db, users: { ...db.users, [ME_ID]: { ...me, ...Object.fromEntries(Object.entries(profile).filter(([k, v]) => v && k !== "id")), id: ME_ID } } };
    }
    this.state = { ...this.state, session, db, toasts: [] };
    this.listeners.forEach(l => l());
    this.scheduleSave();
    if (session.mode === "live") void this.syncLive();
  }

  /** Try the real backend first; when it is unreachable fall back to demo mode. */
  async login(email: string, password: string): Promise<"live" | "demo"> {
    try {
      const result = await liveApi.login(email, password);
      this.startSession({ userId: email.toLowerCase(), mode: "live", accessToken: result.accessToken, refreshToken: result.refreshToken }, { email, ...result.user });
      return "live";
    } catch (error) {
      if (error instanceof ApiError && error.unavailable) {
        this.startSession({ userId: `demo:${email.toLowerCase()}`, mode: "demo" }, { email, name: email.split("@")[0] });
        return "demo";
      }
      throw error;
    }
  }

  async register(email: string, password: string, displayName: string): Promise<"live" | "demo"> {
    try {
      const result = await liveApi.register(email, password, displayName);
      this.startSession({ userId: email.toLowerCase(), mode: "live", accessToken: result.accessToken, refreshToken: result.refreshToken }, { email, name: displayName, ...result.user });
      return "live";
    } catch (error) {
      if (error instanceof ApiError && error.unavailable) {
        this.startSession({ userId: `demo:${email.toLowerCase()}`, mode: "demo" }, { email, name: displayName });
        return "demo";
      }
      throw error;
    }
  }

  demoLogin() {
    this.startSession({ userId: "demo:guest", mode: "demo" });
  }

  logout() {
    const session = this.state.session;
    if (session?.mode === "live" && session.refreshToken) void liveApi.logout(session.refreshToken).catch(() => undefined);
    this.timers.forEach(clearTimeout);
    this.timers = [];
    safeSet(SESSION_KEY, null);
    safeSet("accessToken", null);
    safeSet("refreshToken", null);
    this.set({ session: undefined, activeConversationId: undefined, toasts: [] });
  }

  resetDemoData() {
    const session = this.state.session;
    if (!session) return;
    const me = this.me;
    this.set({ db: createSeed({ name: me.name, email: me.email }) });
    this.scheduleSave();
    this.toast("Đã khôi phục dữ liệu mẫu", "success");
  }

  /** Pull data that already exists on the backend into the local model. */
  private async syncLive() {
    try {
      const profile = await liveApi.me();
      this.setDb(db => ({ ...db, users: { ...db.users, [ME_ID]: { ...db.users[ME_ID], ...Object.fromEntries(Object.entries(profile).filter(([k, v]) => v && k !== "id")) } } }));
    } catch { /* keep local profile */ }
    try {
      const groups = await liveApi.groups();
      this.setDb(db => {
        const conversations = { ...db.conversations };
        const messages = { ...db.messages };
        for (const g of groups) {
          if (!g.remoteId) continue;
          const id = `remote_${g.remoteId}`;
          if (!conversations[id]) {
            conversations[id] = {
              id, remoteId: g.remoteId, type: "group", name: g.name ?? "Nhóm", avatar: g.avatar, color: colorFor(id),
              memberIds: [ME_ID], roles: { [ME_ID]: "member" }, pinned: false, muted: false, unread: 0,
              pinnedMessageIds: [], createdAt: Date.now(), updatedAt: Date.now(),
            };
            messages[id] = [];
          }
        }
        return { ...db, conversations, messages };
      });
    } catch { /* group service not reachable */ }
  }

  // ---------- profile & settings ----------
  async updateMe(patch: Partial<User>) {
    this.setDb(db => ({ ...db, users: { ...db.users, [ME_ID]: { ...db.users[ME_ID], ...patch } } }));
    if (this.isLive) {
      try { await liveApi.updateMe({ ...this.me, ...patch }); } catch { /* saved locally */ }
    }
    this.toast("Đã cập nhật thông tin", "success");
  }

  updateSettings(patch: Partial<Settings>) {
    this.setDb(db => ({ ...db, settings: { ...db.settings, ...patch } }));
    if (patch.showOnline !== undefined) {
      this.setDb(db => ({ ...db, users: { ...db.users, [ME_ID]: { ...db.users[ME_ID], online: patch.showOnline! } } }));
    }
  }

  // ---------- conversations ----------
  setActive(id?: string) {
    this.set({ activeConversationId: id });
    if (id) this.markRead(id);
  }

  markRead(id: string) {
    const c = this.state.db.conversations[id];
    if (!c) return;
    const list = this.state.db.messages[id] ?? [];
    const needs = c.unread > 0 || list.some(m => m.senderId !== ME_ID && m.status !== "seen");
    if (!needs) return;
    this.setDb(db => ({
      ...db,
      conversations: { ...db.conversations, [id]: { ...db.conversations[id], unread: 0 } },
      messages: { ...db.messages, [id]: (db.messages[id] ?? []).map(m => m.senderId !== ME_ID && m.status !== "seen" ? { ...m, status: "seen" } : m) },
    }));
  }

  markUnread(id: string) {
    this.patchConversation(id, { unread: Math.max(1, this.state.db.conversations[id]?.unread ?? 0) });
  }

  async loadRemoteHistory(id: string) {
    const c = this.state.db.conversations[id];
    if (!this.isLive || !c?.remoteId) return;
    try {
      const remote = await liveApi.messages(c.remoteId);
      this.setDb(db => ({
        ...db,
        messages: {
          ...db.messages,
          [id]: remote.map((m, i) => ({
            id: m.id ?? uid("m"), clientMsgId: m.clientMsgId ?? uid("c"), conversationId: id, seq: m.seq || i + 1,
            senderId: m.senderId === this.state.session?.userId ? ME_ID : (m.senderId ?? "unknown"),
            kind: "text", text: m.text, reactions: {}, status: m.status ?? "sent", createdAt: m.createdAt ?? Date.now(),
          })),
        },
      }));
    } catch { /* keep local history */ }
  }

  patchConversation(id: string, patch: Partial<Conversation>) {
    this.setDb(db => db.conversations[id] ? ({ ...db, conversations: { ...db.conversations, [id]: { ...db.conversations[id], ...patch } } }) : db);
  }

  togglePin(id: string) {
    const c = this.state.db.conversations[id];
    this.patchConversation(id, { pinned: !c.pinned });
    this.toast(c.pinned ? "Đã bỏ ghim hội thoại" : "Đã ghim hội thoại");
  }

  toggleMute(id: string) {
    const c = this.state.db.conversations[id];
    this.patchConversation(id, { muted: !c.muted });
    this.toast(c.muted ? "Đã bật thông báo" : "Đã tắt thông báo");
  }

  deleteConversation(id: string) {
    this.setDb(db => ({ ...db, conversations: { ...db.conversations, [id]: { ...db.conversations[id], hidden: true, unread: 0 } }, messages: { ...db.messages, [id]: [] } }));
    if (this.state.activeConversationId === id) this.set({ activeConversationId: undefined });
    this.toast("Đã xóa hội thoại");
  }

  clearHistory(id: string) {
    this.setDb(db => ({ ...db, messages: { ...db.messages, [id]: [] }, conversations: { ...db.conversations, [id]: { ...db.conversations[id], pinnedMessageIds: [] } } }));
    this.toast("Đã xóa lịch sử trò chuyện");
  }

  /** Find or create the 1-1 conversation with a user. */
  ensureDirect(userId: string): string {
    if (userId === ME_ID) return "c_self";
    const existing = Object.values(this.state.db.conversations).find(c => c.type === "direct" && c.memberIds.includes(userId));
    if (existing) {
      if (existing.hidden) this.patchConversation(existing.id, { hidden: false });
      return existing.id;
    }
    const id = uid("c");
    const now = Date.now();
    this.setDb(db => ({
      ...db,
      conversations: {
        ...db.conversations,
        [id]: { id, type: "direct", memberIds: [ME_ID, userId], roles: { [ME_ID]: "member", [userId]: "member" }, pinned: false, muted: false, unread: 0, pinnedMessageIds: [], createdAt: now, updatedAt: now, color: colorFor(id) },
      },
      messages: { ...db.messages, [id]: [] },
    }));
    return id;
  }

  // ---------- messages ----------
  private nextSeq(cid: string) {
    const list = this.state.db.messages[cid] ?? [];
    return (list[list.length - 1]?.seq ?? 0) + 1;
  }

  private append(cid: string, message: Message, bumpUnread: boolean) {
    this.setDb(db => {
      const c = db.conversations[cid];
      if (!c) return db;
      return {
        ...db,
        messages: { ...db.messages, [cid]: [...(db.messages[cid] ?? []), message] },
        conversations: { ...db.conversations, [cid]: { ...c, hidden: false, updatedAt: message.createdAt, unread: bumpUnread ? c.unread + 1 : c.unread } },
      };
    });
  }

  private patchMessage(cid: string, mid: string, update: (m: Message) => Message) {
    this.setDb(db => ({ ...db, messages: { ...db.messages, [cid]: (db.messages[cid] ?? []).map(m => m.id === mid ? update(m) : m) } }));
  }

  findMessage(cid: string, mid: string) {
    return this.state.db.messages[cid]?.find(m => m.id === mid);
  }

  send(cid: string, payload: OutgoingMessage): Message {
    const clientMsgId = uid("cm");
    const message: Message = {
      id: uid("m"), clientMsgId, conversationId: cid, seq: this.nextSeq(cid), senderId: ME_ID,
      reactions: {}, status: "sending", createdAt: Date.now(), ...payload,
    };
    this.append(cid, message, false);
    const c = this.state.db.conversations[cid];

    if (this.isLive && c?.remoteId && (payload.kind === "text" || payload.kind === "sticker")) {
      liveApi.sendMessage(c.remoteId, clientMsgId, payload.text ?? payload.sticker ?? "", payload.kind.toUpperCase())
        .then(remote => this.patchMessage(cid, message.id, m => ({ ...m, status: remote.status ?? "sent", seq: remote.seq || m.seq })))
        .catch(() => this.patchMessage(cid, message.id, m => ({ ...m, status: "failed" })));
      return message;
    }
    this.simulateDelivery(cid, message);
    return message;
  }

  retry(cid: string, mid: string) {
    const m = this.findMessage(cid, mid);
    if (!m) return;
    this.setDb(db => ({ ...db, messages: { ...db.messages, [cid]: db.messages[cid].filter(x => x.id !== mid) } }));
    this.send(cid, { kind: m.kind, text: m.text, attachments: m.attachments, sticker: m.sticker, replyTo: m.replyTo });
  }

  /** Demo mode: emulate sent -> delivered -> seen and an occasional reply. */
  private simulateDelivery(cid: string, message: Message) {
    const c = this.state.db.conversations[cid];
    this.later(250, () => this.patchMessage(cid, message.id, m => ({ ...m, status: "sent" })));
    if (!c || c.type === "self") return;
    const others = c.memberIds.filter(id => id !== ME_ID);
    const online = others.filter(id => this.state.db.users[id]?.online);
    this.later(800, () => this.patchMessage(cid, message.id, m => ({ ...m, status: "delivered" })));
    if (online.length === 0 || message.kind === "call") return;
    this.later(1600, () => this.patchMessage(cid, message.id, m => ({ ...m, status: "seen" })));
    const replier = c.type === "direct" ? others[0] : (Math.random() < 0.6 ? online[Math.floor(Math.random() * online.length)] : undefined);
    if (!replier) return;
    this.later(1900, () => this.setTyping(cid, replier, true));
    this.later(1900 + 1500 + Math.random() * 1500, () => {
      this.setTyping(cid, replier, false);
      const reply = message.kind === "sticker" ? "😄" : CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
      this.receive(cid, { kind: "text", text: reply }, replier);
    });
  }

  private setTyping(cid: string, userId: string, on: boolean) {
    const current = this.state.db.typing[cid] ?? [];
    const next = on ? Array.from(new Set([...current, userId])) : current.filter(id => id !== userId);
    this.set({ db: { ...this.state.db, typing: { ...this.state.db.typing, [cid]: next } } });
  }

  /** Message from another member (demo simulation or realtime socket). */
  receive(cid: string, payload: OutgoingMessage, senderId: string, extra: Partial<Message> = {}) {
    const active = this.state.activeConversationId === cid && document.visibilityState !== "hidden";
    const message: Message = {
      id: uid("m"), clientMsgId: uid("cm"), conversationId: cid, seq: this.nextSeq(cid), senderId,
      reactions: {}, status: active ? "seen" : "delivered", createdAt: Date.now(), ...payload, ...extra,
    };
    if (extra.id && this.state.db.messages[cid]?.some(m => m.id === extra.id || m.clientMsgId === extra.clientMsgId)) return;
    this.append(cid, message, !active);
    const c = this.state.db.conversations[cid];
    if (!active && c && !c.muted) {
      const sender = this.state.db.users[senderId]?.name ?? "Ai đó";
      const title = c.type === "group" ? `${c.name}: ${sender}` : sender;
      this.toast(`${title}: ${payload.text ?? "Đã gửi một tệp"}`, "info", cid);
      if (this.state.db.settings.notifySound) beep();
    }
  }

  react(cid: string, mid: string, emoji: string) {
    this.patchMessage(cid, mid, m => {
      const reactions = { ...m.reactions };
      const users = reactions[emoji] ?? [];
      reactions[emoji] = users.includes(ME_ID) ? users.filter(u => u !== ME_ID) : [...users, ME_ID];
      if (reactions[emoji].length === 0) delete reactions[emoji];
      return { ...m, reactions };
    });
  }

  clearMyReactions(cid: string, mid: string) {
    this.patchMessage(cid, mid, m => ({
      ...m,
      reactions: Object.fromEntries(Object.entries(m.reactions).map(([k, v]) => [k, v.filter(u => u !== ME_ID)]).filter(([, v]) => v.length > 0)),
    }));
  }

  recall(cid: string, mid: string) {
    this.patchMessage(cid, mid, m => ({ ...m, recalled: true, text: undefined, attachments: undefined, sticker: undefined, poll: undefined, reactions: {} }));
    this.patchConversation(cid, { pinnedMessageIds: (this.state.db.conversations[cid]?.pinnedMessageIds ?? []).filter(id => id !== mid) });
  }

  deleteForMe(cid: string, mid: string) {
    this.patchMessage(cid, mid, m => ({ ...m, deletedFor: [...(m.deletedFor ?? []), ME_ID] }));
  }

  pinMessage(cid: string, mid: string) {
    const c = this.state.db.conversations[cid];
    if (!c || c.pinnedMessageIds.includes(mid)) return;
    this.patchConversation(cid, { pinnedMessageIds: [mid, ...c.pinnedMessageIds].slice(0, 3) });
    this.addSystem(cid, `${this.me.name} đã ghim một tin nhắn`);
  }

  unpinMessage(cid: string, mid: string) {
    const c = this.state.db.conversations[cid];
    if (!c) return;
    this.patchConversation(cid, { pinnedMessageIds: c.pinnedMessageIds.filter(id => id !== mid) });
  }

  forward(fromCid: string, mid: string, targetIds: string[]) {
    const m = this.findMessage(fromCid, mid);
    if (!m) return;
    targetIds.forEach(target => this.send(target, { kind: m.kind, text: m.text, attachments: m.attachments, sticker: m.sticker, forwarded: true }));
    this.toast(`Đã chuyển tiếp tới ${targetIds.length} cuộc trò chuyện`, "success");
  }

  vote(cid: string, mid: string, optionId: string) {
    this.patchMessage(cid, mid, m => {
      if (!m.poll) return m;
      const options = m.poll.options.map(o => {
        const has = o.voterIds.includes(ME_ID);
        if (o.id === optionId) return { ...o, voterIds: has ? o.voterIds.filter(v => v !== ME_ID) : [...o.voterIds, ME_ID] };
        return m.poll!.multiple ? o : { ...o, voterIds: o.voterIds.filter(v => v !== ME_ID) };
      });
      return { ...m, poll: { ...m.poll, options } };
    });
  }

  addSystem(cid: string, text: string) {
    this.append(cid, {
      id: uid("m"), clientMsgId: uid("cm"), conversationId: cid, seq: this.nextSeq(cid), senderId: ME_ID,
      kind: "system", text, reactions: {}, status: "seen", createdAt: Date.now(),
    }, false);
  }

  logCall(cid: string, call: CallInfo) {
    this.send(cid, { kind: "call", call });
  }

  // ---------- groups ----------
  async createGroup(name: string, memberIds: string[], avatar?: string): Promise<string> {
    const id = uid("g");
    const now = Date.now();
    const all = [ME_ID, ...memberIds.filter(m => m !== ME_ID)];
    const roles: Record<string, Role> = Object.fromEntries(all.map(m => [m, m === ME_ID ? "owner" : "member"]));
    let remoteId: string | undefined;
    if (this.isLive) {
      try { remoteId = await liveApi.createGroup(name, memberIds); } catch { /* local only */ }
    }
    this.setDb(db => ({
      ...db,
      conversations: { ...db.conversations, [id]: { id, remoteId, type: "group", name, avatar, color: colorFor(id), memberIds: all, roles, pinned: false, muted: false, unread: 0, pinnedMessageIds: [], createdAt: now, updatedAt: now } },
      messages: { ...db.messages, [id]: [] },
    }));
    const names = memberIds.map(m => this.state.db.users[m]?.name).filter(Boolean).join(", ");
    this.addSystem(id, `${this.me.name} đã tạo nhóm và thêm ${names}`);
    this.toast(`Đã tạo nhóm "${name}"`, "success");
    return id;
  }

  updateGroup(cid: string, patch: Partial<Pick<Conversation, "name" | "avatar" | "description">>) {
    this.patchConversation(cid, patch);
    if (patch.name) this.addSystem(cid, `${this.me.name} đã đổi tên nhóm thành "${patch.name}"`);
    if (patch.avatar) this.addSystem(cid, `${this.me.name} đã đổi ảnh đại diện nhóm`);
  }

  addMembers(cid: string, userIds: string[]) {
    const c = this.state.db.conversations[cid];
    if (!c) return;
    const fresh = userIds.filter(u => !c.memberIds.includes(u));
    if (fresh.length === 0) return;
    this.patchConversation(cid, { memberIds: [...c.memberIds, ...fresh], roles: { ...c.roles, ...Object.fromEntries(fresh.map(u => [u, "member" as Role])) } });
    this.addSystem(cid, `${this.me.name} đã thêm ${fresh.map(u => this.state.db.users[u]?.name).join(", ")} vào nhóm`);
  }

  removeMember(cid: string, userId: string) {
    const c = this.state.db.conversations[cid];
    if (!c) return;
    const roles = { ...c.roles };
    delete roles[userId];
    this.patchConversation(cid, { memberIds: c.memberIds.filter(m => m !== userId), roles });
    this.addSystem(cid, `${this.me.name} đã mời ${this.state.db.users[userId]?.name} rời nhóm`);
  }

  setRole(cid: string, userId: string, role: Role) {
    const c = this.state.db.conversations[cid];
    if (!c) return;
    const roles = { ...c.roles, [userId]: role };
    if (role === "owner") roles[ME_ID] = "deputy";
    this.patchConversation(cid, { roles });
    const name = this.state.db.users[userId]?.name;
    const label = role === "owner" ? "trưởng nhóm" : role === "deputy" ? "phó nhóm" : "thành viên";
    this.addSystem(cid, `${name} đã được đặt làm ${label}`);
  }

  leaveGroup(cid: string) {
    const c = this.state.db.conversations[cid];
    if (!c) return;
    this.addSystem(cid, `${this.me.name} đã rời nhóm`);
    this.patchConversation(cid, { memberIds: c.memberIds.filter(m => m !== ME_ID), hidden: true });
    if (this.state.activeConversationId === cid) this.set({ activeConversationId: undefined });
    this.toast(`Đã rời nhóm "${c.name}"`);
  }

  dissolveGroup(cid: string) {
    const c = this.state.db.conversations[cid];
    this.setDb(db => {
      const conversations = { ...db.conversations };
      const messages = { ...db.messages };
      delete conversations[cid];
      delete messages[cid];
      return { ...db, conversations, messages };
    });
    if (this.state.activeConversationId === cid) this.set({ activeConversationId: undefined });
    this.toast(`Đã giải tán nhóm "${c?.name}"`);
  }

  // ---------- friends ----------
  searchUsers(query: string): User[] {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return [];
    return Object.values(this.state.db.users).filter(u => u.id !== ME_ID && (
      (u.phone ?? "").replace(/\s+/g, "").includes(q) || (u.email ?? "").toLowerCase() === q || u.name.toLowerCase().replace(/\s+/g, "").includes(q)
    ));
  }

  async sendFriendRequest(userId: string, message: string) {
    const request: FriendRequest = { id: uid("fr"), fromId: ME_ID, toId: userId, message, createdAt: Date.now() };
    this.setDb(db => ({ ...db, requests: [...db.requests, request] }));
    const target = this.state.db.users[userId];
    if (this.isLive) {
      try { await liveApi.sendFriendRequest(target?.email ?? target?.phone ?? userId, message); } catch { /* local only */ }
    }
    this.toast(`Đã gửi lời mời kết bạn tới ${target?.name}`, "success");
    // Demo: the other side accepts after a moment.
    if (!this.isLive) {
      this.later(4000, () => {
        if (!this.state.db.requests.some(r => r.id === request.id)) return;
        this.setDb(db => ({ ...db, requests: db.requests.filter(r => r.id !== request.id), friendIds: [...db.friendIds, userId] }));
        const cid = this.ensureDirect(userId);
        this.receive(cid, { kind: "text", text: "Chào bạn, mình đã đồng ý kết bạn nhé 👋" }, userId);
      });
    }
  }

  acceptRequest(requestId: string) {
    const r = this.state.db.requests.find(x => x.id === requestId);
    if (!r) return;
    this.setDb(db => ({ ...db, requests: db.requests.filter(x => x.id !== requestId), friendIds: Array.from(new Set([...db.friendIds, r.fromId])) }));
    const cid = this.ensureDirect(r.fromId);
    this.addSystem(cid, `Bạn và ${this.state.db.users[r.fromId]?.name} đã trở thành bạn bè`);
    this.toast(`Đã đồng ý kết bạn với ${this.state.db.users[r.fromId]?.name}`, "success");
  }

  declineRequest(requestId: string) {
    this.setDb(db => ({ ...db, requests: db.requests.filter(x => x.id !== requestId) }));
  }

  unfriend(userId: string) {
    this.setDb(db => ({ ...db, friendIds: db.friendIds.filter(id => id !== userId) }));
    this.toast(`Đã hủy kết bạn với ${this.state.db.users[userId]?.name}`);
  }

  // ---------- statistics ----------
  async stats(): Promise<StatsSnapshot> {
    const local = this.localStats();
    if (!this.isLive) return local;
    try {
      const remote = await liveApi.stats();
      return { ...local, ...remote, daily: local.daily, topUsers: local.topUsers, source: "api" };
    } catch {
      return local;
    }
  }

  localStats(): StatsSnapshot {
    const { db } = this.state;
    const all = Object.values(db.messages).flat().filter(m => m.kind !== "system");
    const days: StatsSnapshot["daily"] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;
      const inDay = all.filter(m => m.createdAt >= start && m.createdAt < end);
      days.push({ date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, messages: inDay.length, activeUsers: new Set(inDay.map(m => m.senderId)).size });
    }
    const mediaCount: Record<string, number> = { "Ảnh": 0, "Video": 0, "Tệp": 0, "Sticker": 0 };
    all.forEach(m => {
      if (m.kind === "sticker") mediaCount["Sticker"]++;
      m.attachments?.forEach(a => { mediaCount[a.kind === "image" ? "Ảnh" : a.kind === "video" ? "Video" : "Tệp"]++; });
    });
    const groups = Object.values(db.conversations).filter(c => c.type === "group")
      .map(c => ({ id: c.id, name: c.name ?? "Nhóm", messages: (db.messages[c.id] ?? []).filter(m => m.kind !== "system").length }))
      .sort((a, b) => b.messages - a.messages).slice(0, 5);
    const perUser: Record<string, number> = {};
    all.forEach(m => { perUser[m.senderId] = (perUser[m.senderId] ?? 0) + 1; });
    const topUsers = Object.entries(perUser).map(([id, n]) => ({ id, name: db.users[id]?.name ?? id, messages: n }))
      .sort((a, b) => b.messages - a.messages).slice(0, 5);
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      totalMessages: all.length,
      activeUsers: new Set(all.filter(m => m.createdAt > weekAgo).map(m => m.senderId)).size,
      newUsers: db.requests.length + 1,
      totalMedia: Object.values(mediaCount).reduce((a, b) => a + b, 0),
      daily: days,
      media: Object.entries(mediaCount).map(([kind, count]) => ({ kind, count })),
      topGroups: groups,
      topUsers,
      source: "local",
    };
  }
}

let audio: AudioContext | undefined;
function beep() {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.25);
  } catch { /* audio not allowed */ }
}

export const store = new AppStore();
(globalThis as unknown as { __zaloStore?: AppStore }).__zaloStore = store;

export function useApp<T>(selector: (state: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export { ME_ID };
