import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Alert, AppState } from "react-native";
import {
  accessToken, ApiError, errorText, getServer, onSessionChange, refreshToken, setServer, setTokens, socketUrl, Tokens,
} from "./api/client";
import { StompClient, Subscription } from "./api/stomp";
import {
  AuthResult, GroupRole, LocalFile, RemoteConversation, RemoteFriend, RemoteGroup, RemoteMessage, RemoteUser, zalolite,
} from "./api/zalolite";
import { normalizeServer } from "./config";

// ---------- model ----------

export interface User {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  email?: string;
  phone?: string;
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

export type MessageStatus = "sending" | "sent" | "delivered" | "seen" | "failed";

export interface Message {
  id: string;
  clientMsgId: string;
  conversationId: string;
  seq: number;
  senderId: string;
  kind: "text" | "image" | "video" | "file" | "sticker" | "system";
  text?: string;
  attachments?: Attachment[];
  replyTo?: { id: string; senderId: string; preview: string };
  reactions: Record<string, string[]>;
  status: MessageStatus;
  recalled?: boolean;
  createdAt: number;
  /** The picked file of a message that is not on the server yet (kept for "send again"). */
  localFile?: LocalFile;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  groupId?: string;
  peerId?: string;
  name?: string;
  avatar?: string;
  memberIds: string[];
  roles: Record<string, GroupRole>;
  unread: number;
  pinned: boolean;
  muted: boolean;
  lastSeq: number;
  updatedAt: number;
  /** Older messages may still be on the server. */
  hasMore: boolean;
}

export interface FriendRequest {
  friendshipId: number;
  userId: string;
  message: string;
  createdAt: number;
}

export interface State {
  /** The stored session is still being read. */
  booting: boolean;
  server: string;
  me?: User;
  users: Record<string, User>;
  friendIds: string[];
  incoming: FriendRequest[];
  sent: FriendRequest[];
  conversations: Record<string, Conversation>;
  /** Oldest first. Messages still being sent stay at the end. */
  messages: Record<string, Message[]>;
  typing: Record<string, string[]>;
  connected: boolean;
  /** The first pull after sign-in finished. */
  synced: boolean;
}

const SESSION_KEY = "zalolite.session";
const SERVER_KEY = "zalolite.server";
const PAGE = 40;

const signedOut = (): State => ({
  booting: false, server: getServer(), users: {}, friendIds: [], incoming: [], sent: [],
  conversations: {}, messages: {}, typing: {}, connected: false, synced: false,
});

let state: State = { ...signedOut(), booting: true };
const subscribers = new Set<() => void>();

function set(update: (current: State) => State) {
  const next = update(state);
  if (next === state) return;
  state = next;
  subscribers.forEach(notify => notify());
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

export const getState = () => state;

/** Selectors must return a value kept in the state (or a primitive), not a new object. */
export function useStore<T>(selector: (current: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// ---------- session ----------

function persist() {
  const access = accessToken();
  const refresh = refreshToken();
  if (!access || !refresh || !state.me) return;
  void AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: access, refreshToken: refresh, me: state.me }));
}

/** Reads the stored session when the app starts. */
export async function boot() {
  onSessionChange({ tokens: persist, unauthorized: () => void signOut(false) });
  let previous = AppState.currentState;
  AppState.addEventListener("change", next => {
    // The system closes sockets of a suspended app: reconnect and catch up when it comes back.
    if (next === "active" && previous !== "active" && state.me) {
      stomp?.reconnectNow();
      scheduleSync(0);
      if (activeId) void zalolite.markRead(activeId).catch(() => undefined);
    }
    previous = next;
  });
  try {
    const [server, raw] = await Promise.all([AsyncStorage.getItem(SERVER_KEY), AsyncStorage.getItem(SESSION_KEY)]);
    if (server) setServer(server);
    const stored = raw ? JSON.parse(raw) as Tokens & { me?: User } : undefined;
    if (stored?.accessToken && stored.me) {
      setTokens({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
      set(current => ({ ...current, server: getServer(), me: { ...stored.me!, online: true } }));
      startLive();
    }
  } catch { /* a broken record just means signing in again */ }
  set(current => ({ ...current, server: getServer(), booting: false }));
}

async function enter(server: string, request: () => Promise<AuthResult>) {
  const url = normalizeServer(server);
  setServer(url);
  void AsyncStorage.setItem(SERVER_KEY, url);
  const result = await request();
  setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  try {
    const me = toUser(result.user ?? await zalolite.me());
    set(() => ({ ...signedOut(), me: { ...me, online: true } }));
  } catch (error) {
    setTokens(undefined);
    throw error;
  }
  persist();
  startLive();
}

export const signIn = (server: string, email: string, password: string) =>
  enter(server, () => zalolite.login(email.trim(), password));

export const signUp = (server: string, email: string, password: string, name: string) =>
  enter(server, () => zalolite.register(email.trim(), password, name.trim()));

export async function signOut(tellServer = true) {
  stopLive();
  const token = refreshToken();
  if (tellServer && token) void zalolite.logout(token).catch(() => undefined);
  setTokens(undefined);
  void AsyncStorage.removeItem(SESSION_KEY);
  set(() => signedOut());
}

export async function updateProfile(patch: { name: string; bio: string }) {
  const remote = await zalolite.updateMe({ displayName: patch.name.trim(), bio: patch.bio.trim() });
  set(current => current.me ? ({ ...current, me: { ...current.me, ...toUser(remote, current.me), online: true } }) : current);
  persist();
}

export async function updateAvatar(file: LocalFile) {
  const media = await zalolite.upload(file);
  const remote = await zalolite.updateMe({ avatar: media.url });
  set(current => current.me ? ({ ...current, me: { ...current.me, ...toUser(remote, current.me), online: true } }) : current);
  persist();
}

// ---------- realtime ----------

interface RealtimeEvent {
  type: string;
  conversationId?: string;
  data: Record<string, unknown>;
}

let stomp: StompClient | undefined;
let watched: { id: string; subscription: Subscription } | undefined;
let activeId: string | undefined;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let lastTypingSent = 0;
let typingStop: ReturnType<typeof setTimeout> | undefined;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function startLive() {
  const me = state.me;
  if (!me || stomp) return;
  stomp = new StompClient({
    url: socketUrl,
    connectHeaders: () => ({ Authorization: `Bearer ${accessToken() ?? ""}` }),
    onConnect: () => {
      set(current => ({ ...current, connected: true }));
      scheduleSync(0); // catch up with whatever happened while disconnected
    },
    onDisconnect: () => set(current => ({ ...current, connected: false })),
    // A refused connection usually means an expired token; any API call renews it.
    beforeRetry: () => zalolite.me(),
  });
  stomp.subscribe(`/topic/users/${me.id}`, body => onEvent(JSON.parse(body) as RealtimeEvent));
  stomp.subscribe("/topic/presence", body => onPresence((JSON.parse(body) as RealtimeEvent).data));
  stomp.activate();
  void sync();
}

function stopLive() {
  clearTimeout(syncTimer);
  clearTimeout(typingStop);
  typingTimers.forEach(timer => clearTimeout(timer));
  typingTimers.clear();
  watched = undefined;
  activeId = undefined;
  stomp?.deactivate();
  stomp = undefined;
}

/** Coalesces bursts of "something changed" events into one refresh. */
function scheduleSync(delay = 300) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void sync(), delay);
}

/** The conversation on screen: it is kept read, and its typing indicators and receipts are followed. */
export function setActiveConversation(conversationId?: string) {
  activeId = conversationId;
  if (watched?.id !== conversationId) {
    watched?.subscription.unsubscribe();
    watched = conversationId && stomp ? {
      id: conversationId,
      subscription: stomp.subscribe(`/topic/conversations/${conversationId}/events`, body => onEvent(JSON.parse(body) as RealtimeEvent)),
    } : undefined;
  }
  if (!conversationId) return;
  patchConversation(conversationId, { unread: 0 });
  void zalolite.markRead(conversationId).catch(() => undefined);
}

function onEvent(event: RealtimeEvent) {
  const cid = event.conversationId;
  switch (event.type) {
    case "message.new": onMessage(event.data as unknown as RemoteMessage); break;
    case "message.updated": replaceMessage(toMessage(event.data as unknown as RemoteMessage)); break;
    case "message.failed":
      if (cid) patchByClientId(cid, String(event.data.clientMsgId), message => ({ ...message, status: "failed" }));
      break;
    case "receipt": if (cid) onReceipt(cid, event.data); break;
    case "typing": if (cid) onTyping(cid, String(event.data.userId), Boolean(event.data.typing)); break;
    case "conversation.removed": if (cid) removeConversation(cid); break;
    case "conversation.pins": break; // pinned messages are not shown in the app
    case "error": Alert.alert("ZaloLite", String(event.data.message ?? "Có lỗi xảy ra")); break;
    default: scheduleSync(); // conversation.added / conversation.updated / friend.*
  }
}

function onMessage(remote: RemoteMessage) {
  const cid = remote.conversationId;
  const me = state.me;
  if (!me) return;
  if (!state.conversations[cid]) { scheduleSync(); return; }
  const message = toMessage(remote);
  const known = (state.messages[cid] ?? []).some(m => m.id === message.id || m.clientMsgId === message.clientMsgId);
  if (known) { replaceMessage(message); return; }

  const theirs = message.senderId !== me.id && message.kind !== "system";
  const reading = activeId === cid && AppState.currentState === "active";
  set(current => {
    const conversation = current.conversations[cid];
    if (!conversation) return current;
    return {
      ...current,
      messages: { ...current.messages, [cid]: insert(current.messages[cid] ?? [], message) },
      conversations: {
        ...current.conversations,
        [cid]: {
          ...conversation, updatedAt: message.createdAt, lastSeq: Math.max(conversation.lastSeq, message.seq),
          unread: theirs && !reading ? conversation.unread + 1 : conversation.unread,
        },
      },
    };
  });
  // A system line usually means members or the group itself changed.
  if (message.kind === "system") scheduleSync(600);
  if (!theirs) return;
  // Their message is here, so they are no longer "typing".
  clearTimeout(typingTimers.get(`${cid}:${message.senderId}`));
  setTyping(cid, message.senderId, false);
  if (reading) void zalolite.markRead(cid).catch(() => undefined);
  else stomp?.publish("/app/chat.delivered", JSON.stringify({ conversationId: cid, seq: remote.seq }));
}

function onReceipt(cid: string, data: Record<string, unknown>) {
  const readSeq = Number(data.readSeq ?? 0);
  const deliveredSeq = Number(data.deliveredSeq ?? 0);
  const me = state.me;
  if (!me) return;
  if (String(data.userId) === me.id) {
    // Read on another device of mine.
    if ((state.conversations[cid]?.lastSeq ?? 0) <= readSeq) patchConversation(cid, { unread: 0 });
    return;
  }
  set(current => ({
    ...current,
    messages: {
      ...current.messages,
      [cid]: (current.messages[cid] ?? []).map(m => {
        if (m.senderId !== me.id || m.status === "sending" || m.status === "failed" || m.status === "seen") return m;
        if (m.seq <= readSeq) return { ...m, status: "seen" as const };
        if (m.seq <= deliveredSeq && m.status !== "delivered") return { ...m, status: "delivered" as const };
        return m;
      }),
    },
  }));
}

function onTyping(cid: string, userId: string, typing: boolean) {
  if (userId === state.me?.id) return;
  const key = `${cid}:${userId}`;
  clearTimeout(typingTimers.get(key));
  setTyping(cid, userId, typing);
  // The "stopped typing" event can get lost; never leave the indicator on.
  if (typing) typingTimers.set(key, setTimeout(() => setTyping(cid, userId, false), 5000));
}

function setTyping(cid: string, userId: string, on: boolean) {
  set(current => {
    const now = current.typing[cid] ?? [];
    if (now.includes(userId) === on) return current;
    return { ...current, typing: { ...current.typing, [cid]: on ? [...now, userId] : now.filter(id => id !== userId) } };
  });
}

function onPresence(data: Record<string, unknown>) {
  const userId = String(data.userId);
  set(current => current.users[userId] ? ({
    ...current,
    users: {
      ...current.users,
      [userId]: {
        ...current.users[userId], online: Boolean(data.online),
        lastSeen: data.lastSeen ? Date.parse(String(data.lastSeen)) : current.users[userId].lastSeen,
      },
    },
  }) : current);
}

/** Called while the user types; tells the others at most every 2.5 s and clears itself. */
export function sendTyping(conversationId: string) {
  const publish = (typing: boolean) => stomp?.publish("/app/chat.typing", JSON.stringify({ conversationId, typing }));
  if (Date.now() - lastTypingSent > 2500) { lastTypingSent = Date.now(); publish(true); }
  clearTimeout(typingStop);
  typingStop = setTimeout(() => { lastTypingSent = 0; publish(false); }, 3000);
}

// ---------- pull ----------

let pulling: Promise<void> | undefined;

/** Pulls friends, conversations and new messages. Concurrent callers share one run. */
export function sync(): Promise<void> {
  pulling ??= pull().catch(() => undefined).finally(() => {
    pulling = undefined;
    set(current => current.synced || !current.me ? current : { ...current, synced: true });
  });
  return pulling;
}

async function pull() {
  const me = state.me;
  if (!me) return;
  // A failed request keeps what is already on screen instead of emptying it.
  const safe = <T,>(request: Promise<T>) => request.catch(() => undefined);
  const [friends, incoming, sent, conversations] = await Promise.all([
    safe(zalolite.friends()), safe(zalolite.incomingRequests()), safe(zalolite.sentRequests()), safe(zalolite.conversations()),
  ]);
  if (state.me?.id !== me.id) return; // signed out meanwhile

  const fetched: RemoteUser[] = [...friends ?? [], ...incoming ?? [], ...sent ?? []].map(f => f.user).filter(Boolean);
  const known = new Set([me.id, ...fetched.map(u => u.id), ...Object.keys(state.users)]);
  const missing = Array.from(new Set((conversations ?? []).flatMap(c => c.memberIds))).filter(id => !known.has(id));
  fetched.push(...await safe(zalolite.usersByIds(missing.slice(0, 200))) ?? []);
  const groups = await Promise.all((conversations ?? []).filter(c => c.type === "GROUP")
    .map(c => safe(zalolite.group(c.groupId ?? c.id))));
  const groupById = new Map(groups.filter((g): g is RemoteGroup => !!g).map(g => [g.id, g]));
  if (state.me?.id !== me.id) return;

  set(current => {
    const users = { ...current.users };
    for (const user of fetched) users[user.id] = toUser(user, users[user.id]);
    let next = current.conversations;
    let messages = current.messages;
    if (conversations) {
      next = {};
      messages = {};
      for (const remote of conversations) {
        next[remote.id] = toConversation(remote, groupById.get(remote.groupId ?? remote.id), current.conversations[remote.id]);
        messages[remote.id] = current.messages[remote.id] ?? [];
      }
    }
    const request = (friend: RemoteFriend): FriendRequest => ({
      friendshipId: friend.friendshipId, userId: friend.user.id, message: friend.message ?? "",
      createdAt: friend.createdAt ? Date.parse(friend.createdAt) : Date.now(),
    });
    return {
      ...current, users, conversations: next, messages,
      friendIds: friends ? friends.map(f => f.user.id) : current.friendIds,
      incoming: incoming ? incoming.map(request) : current.incoming,
      sent: sent ? sent.map(request) : current.sent,
    };
  });

  await Promise.all((conversations ?? []).map(remote => {
    const loaded = (state.messages[remote.id] ?? []).reduce((max, m) => isPending(m) ? max : Math.max(max, m.seq), 0);
    return loaded < remote.lastSeq ? loadHistory(remote.id) : undefined;
  }));
  void refreshPresence();
}

async function loadHistory(conversationId: string) {
  try {
    const remote = sorted((await zalolite.history(conversationId)).map(toMessage));
    const sentIds = new Set(remote.map(m => m.clientMsgId));
    set(current => {
      const conversation = current.conversations[conversationId];
      if (!conversation) return current;
      // Messages still on their way (or failed) are not on the server yet: keep them at the end.
      const pending = (current.messages[conversationId] ?? []).filter(m => isPending(m) && !sentIds.has(m.clientMsgId));
      return {
        ...current,
        messages: { ...current.messages, [conversationId]: [...remote, ...pending] },
        conversations: { ...current.conversations, [conversationId]: { ...conversation, hasMore: remote.length >= PAGE } },
      };
    });
  } catch { /* keep what is on screen */ }
}

const loadingOlder = new Set<string>();

/** Loads the page before the oldest message on screen. */
export async function loadOlder(conversationId: string) {
  const conversation = state.conversations[conversationId];
  const oldest = (state.messages[conversationId] ?? []).find(m => !isPending(m));
  if (!conversation?.hasMore || !oldest || loadingOlder.has(conversationId)) return;
  loadingOlder.add(conversationId);
  try {
    const older = sorted((await zalolite.history(conversationId, oldest.seq)).map(toMessage));
    set(current => {
      const now = current.conversations[conversationId];
      if (!now) return current;
      const have = new Set((current.messages[conversationId] ?? []).map(m => m.id));
      return {
        ...current,
        messages: { ...current.messages, [conversationId]: [...older.filter(m => !have.has(m.id)), ...current.messages[conversationId] ?? []] },
        conversations: { ...current.conversations, [conversationId]: { ...now, hasMore: older.length >= PAGE } },
      };
    });
  } catch { /* the list can be pulled again */ } finally {
    loadingOlder.delete(conversationId);
  }
}

async function refreshPresence() {
  const userIds = Object.keys(state.users).filter(id => id !== state.me?.id);
  try {
    const statuses = await zalolite.presence(userIds.slice(0, 400));
    set(current => {
      const users = { ...current.users };
      for (const status of statuses) {
        const user = users[status.userId];
        if (user) users[status.userId] = { ...user, online: status.online, lastSeen: status.lastSeen ? Date.parse(status.lastSeen) : user.lastSeen };
      }
      return { ...current, users };
    });
  } catch { /* presence is optional */ }
}

// ---------- messages ----------

export interface Draft {
  text?: string;
  file?: LocalFile;
  replyTo?: Message;
}

export function sendMessage(conversationId: string, draft: Draft) {
  const me = state.me;
  if (!me) return;
  clearTimeout(typingStop);
  lastTypingSent = 0;
  const clientMsgId = uid();
  const kind = draft.file ? kindOf(draft.file.mime) : "text";
  const message: Message = {
    id: `local_${clientMsgId}`, clientMsgId, conversationId, seq: 0, senderId: me.id, kind,
    text: draft.text?.trim() || undefined,
    attachments: draft.file ? [{ id: clientMsgId, name: draft.file.name, size: 0, mime: draft.file.mime, url: draft.file.uri, kind: kind as Attachment["kind"] }] : undefined,
    replyTo: draft.replyTo && !isPending(draft.replyTo)
      ? { id: draft.replyTo.id, senderId: draft.replyTo.senderId, preview: previewText(draft.replyTo) } : undefined,
    reactions: {}, status: "sending", createdAt: Date.now(), localFile: draft.file,
  };
  set(current => current.conversations[conversationId] ? ({
    ...current,
    messages: { ...current.messages, [conversationId]: [...current.messages[conversationId] ?? [], message] },
    conversations: { ...current.conversations, [conversationId]: { ...current.conversations[conversationId], updatedAt: message.createdAt } },
  }) : current);
  void deliver(message);
}

export function resendMessage(message: Message) {
  patchByClientId(message.conversationId, message.clientMsgId, m => ({ ...m, status: "sending", createdAt: Date.now() }));
  void deliver(message);
}

async function deliver(message: Message) {
  try {
    const attachments = message.localFile ? [await zalolite.upload(message.localFile)] : undefined;
    const stored = await zalolite.sendMessage({
      conversationId: message.conversationId, clientMsgId: message.clientMsgId, type: message.kind.toUpperCase(),
      content: message.text, attachments, replyToId: message.replyTo?.id,
    });
    replaceMessage(toMessage(stored));
  } catch (error) {
    patchByClientId(message.conversationId, message.clientMsgId, m => ({ ...m, status: "failed" }));
    Alert.alert("Không gửi được tin nhắn", errorText(error));
  }
}

export async function reactToMessage(message: Message, emoji: string) {
  replaceMessage(toMessage(await zalolite.react(message.id, emoji)));
}

export async function recallMessage(message: Message) {
  replaceMessage(toMessage(await zalolite.recall(message.id)));
}

/** Removes a message on my side only. A message that never reached the server is just dropped. */
export async function deleteMessage(message: Message) {
  if (!isPending(message)) await zalolite.deleteMessage(message.id);
  set(current => ({
    ...current,
    messages: { ...current.messages, [message.conversationId]: (current.messages[message.conversationId] ?? []).filter(m => m.clientMsgId !== message.clientMsgId) },
  }));
}

// ---------- conversations, friends, groups ----------

/** Returns the id of the direct conversation with a user, creating it on the server when needed. */
export async function openDirect(userId: string): Promise<string> {
  const existing = Object.values(state.conversations).find(c => c.type === "direct" && c.memberIds.includes(userId));
  if (existing) return existing.id;
  const remote = await zalolite.openDirect(userId);
  if (!state.users[userId]) {
    const [user] = await zalolite.usersByIds([userId]).catch(() => [] as RemoteUser[]);
    if (user) rememberUsers([user]);
  }
  set(current => ({
    ...current,
    conversations: { ...current.conversations, [remote.id]: toConversation(remote, undefined, current.conversations[remote.id]) },
    messages: { ...current.messages, [remote.id]: current.messages[remote.id] ?? [] },
  }));
  if (remote.lastSeq > 0) void loadHistory(remote.id);
  return remote.id;
}

export async function setConversationSettings(conversationId: string, settings: { pinned?: boolean; muted?: boolean }) {
  await zalolite.conversationSettings(conversationId, settings);
  patchConversation(conversationId, settings);
}

/** Looks people up on the server and remembers them so they can be shown. */
export async function searchUsers(query: string): Promise<RemoteUser[]> {
  const found = await zalolite.searchUsers(query.trim());
  rememberUsers(found);
  return found;
}

export async function sendFriendRequest(userId: string) {
  await zalolite.sendFriendRequest(userId, "Xin chào, mình kết bạn nhé!");
  await sync();
}

export async function answerFriendRequest(friendshipId: number, accept: boolean) {
  await (accept ? zalolite.acceptRequest(friendshipId) : zalolite.rejectRequest(friendshipId));
  await sync();
}

export async function cancelFriendRequest(friendshipId: number) {
  await zalolite.cancelRequest(friendshipId);
  await sync();
}

export async function unfriend(userId: string) {
  await zalolite.unfriend(userId);
  await sync();
}

/** Creates a group and returns the id of its conversation. */
export async function createGroup(name: string, memberIds: string[]): Promise<string | undefined> {
  const group = await zalolite.createGroup(name.trim(), memberIds);
  await sync();
  return Object.values(state.conversations).find(c => c.groupId === group.id || c.id === group.id)?.id;
}

export async function addGroupMembers(conversation: Conversation, userIds: string[]) {
  await zalolite.addMembers(conversation.groupId ?? conversation.id, userIds);
  await sync();
}

export async function removeGroupMember(conversation: Conversation, userId: string) {
  await zalolite.removeMember(conversation.groupId ?? conversation.id, userId);
  await sync();
}

export async function leaveGroup(conversation: Conversation) {
  await zalolite.leaveGroup(conversation.groupId ?? conversation.id);
  removeConversation(conversation.id);
}

// ---------- local model helpers ----------

const isPending = (message: Message) => message.status === "sending" || message.status === "failed";
const sorted = (messages: Message[]) => [...messages].sort((a, b) => a.seq - b.seq);
const rank = (status: MessageStatus) => ({ sending: 0, failed: 0, sent: 1, delivered: 2, seen: 3 })[status];
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

function kindOf(mime: string): Message["kind"] {
  return mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "file";
}

/** Server messages go before the ones still being sent. */
function insert(list: Message[], message: Message): Message[] {
  const firstPending = list.findIndex(isPending);
  return firstPending < 0 ? [...list, message] : [...list.slice(0, firstPending), message, ...list.slice(firstPending)];
}

function replaceMessage(message: Message) {
  const cid = message.conversationId;
  set(current => {
    const list = current.messages[cid];
    if (!list) return current;
    const index = list.findIndex(m => m.id === message.id || m.clientMsgId === message.clientMsgId);
    if (index < 0) return current;
    const old = list[index];
    // Receipts may have arrived before the answer of the send request: never go back in status.
    const merged = { ...message, status: rank(old.status) > rank(message.status) ? old.status : message.status };
    const rest = list.filter((_, i) => i !== index);
    // A message that just reached the server moves in front of the ones still being sent.
    const next = isPending(old) ? insert(rest, merged) : [...list.slice(0, index), merged, ...list.slice(index + 1)];
    const conversation = current.conversations[cid];
    return {
      ...current,
      messages: { ...current.messages, [cid]: next },
      conversations: conversation ? { ...current.conversations, [cid]: { ...conversation, lastSeq: Math.max(conversation.lastSeq, message.seq) } } : current.conversations,
    };
  });
}

function patchByClientId(cid: string, clientMsgId: string, update: (message: Message) => Message) {
  set(current => ({
    ...current,
    messages: { ...current.messages, [cid]: (current.messages[cid] ?? []).map(m => m.clientMsgId === clientMsgId ? update(m) : m) },
  }));
}

function patchConversation(cid: string, patch: Partial<Conversation>) {
  set(current => current.conversations[cid]
    ? ({ ...current, conversations: { ...current.conversations, [cid]: { ...current.conversations[cid], ...patch } } }) : current);
}

function removeConversation(cid: string) {
  set(current => {
    if (!current.conversations[cid]) return current;
    const conversations = { ...current.conversations };
    const messages = { ...current.messages };
    delete conversations[cid];
    delete messages[cid];
    return { ...current, conversations, messages };
  });
}

function rememberUsers(remote: RemoteUser[]) {
  set(current => {
    const users = { ...current.users };
    for (const user of remote) users[user.id] = toUser(user, users[user.id]);
    return { ...current, users };
  });
}

// ---------- mapping ----------

function toUser(remote: RemoteUser, current?: User): User {
  return {
    id: remote.id, name: remote.displayName || "Người dùng", avatar: remote.avatar ?? undefined, bio: remote.bio ?? undefined,
    email: remote.email ?? current?.email, phone: remote.phone ?? current?.phone,
    online: current?.online ?? false, lastSeen: current?.lastSeen,
  };
}

function toConversation(remote: RemoteConversation, group: RemoteGroup | undefined, current?: Conversation): Conversation {
  const roles: Record<string, GroupRole> = group?.members
    ? Object.fromEntries(group.members.map(member => [member.userId, member.role])) : current?.roles ?? {};
  return {
    id: remote.id, type: remote.type === "GROUP" ? "group" : "direct", groupId: remote.groupId, peerId: remote.peerId,
    name: remote.name ?? group?.name ?? current?.name, avatar: remote.avatar ?? group?.avatar ?? undefined,
    memberIds: remote.memberIds, roles, pinned: remote.pinned, muted: remote.muted,
    unread: activeId === remote.id ? 0 : remote.unreadCount, lastSeq: remote.lastSeq,
    updatedAt: remote.updatedAt ? Date.parse(remote.updatedAt) : current?.updatedAt ?? Date.now(),
    hasMore: current?.hasMore ?? true,
  };
}

const KINDS: Record<string, Message["kind"]> = { TEXT: "text", IMAGE: "image", VIDEO: "video", FILE: "file", STICKER: "sticker", SYSTEM: "system" };

function toMessage(remote: RemoteMessage): Message {
  const kind = KINDS[remote.type] ?? "text";
  const created = Date.parse(remote.createdAt);
  const status = String(remote.status ?? "SENT").toLowerCase();
  return {
    id: remote.id, clientMsgId: remote.clientMsgId, conversationId: remote.conversationId, seq: remote.seq,
    senderId: remote.senderId, kind, text: remote.content ?? undefined,
    attachments: remote.attachments?.length ? remote.attachments.map(a => ({
      id: a.mediaId ?? a.id ?? a.url, name: a.name ?? "Tệp", size: a.size ?? 0, mime: a.mime ?? "application/octet-stream", url: a.url,
      kind: (["image", "video"].includes((a.kind ?? "").toLowerCase()) ? (a.kind ?? "").toLowerCase() : "file") as Attachment["kind"],
    })) : undefined,
    replyTo: remote.replyTo ? { id: remote.replyTo.id, senderId: remote.replyTo.senderId, preview: remote.replyTo.preview ?? "" } : undefined,
    reactions: remote.reactions ?? {},
    status: status === "delivered" || status === "seen" ? status : "sent",
    recalled: remote.recalled || undefined,
    createdAt: Number.isFinite(created) ? created : Date.now(),
  };
}

// ---------- what screens show ----------

/** The other person of a direct conversation. */
export function peerOf(conversation: Conversation, meId: string): string | undefined {
  return conversation.type === "direct" ? conversation.peerId ?? conversation.memberIds.find(id => id !== meId) : undefined;
}

export function titleOf(conversation: Conversation, users: Record<string, User>, meId: string): string {
  if (conversation.type === "group") return conversation.name || "Nhóm";
  const peer = peerOf(conversation, meId);
  return (peer && users[peer]?.name) || conversation.name || "Người dùng";
}

/** One line describing a message, for the conversation list and reply quotes. */
export function previewText(message: Message): string {
  if (message.recalled) return "Tin nhắn đã được thu hồi";
  switch (message.kind) {
    case "image": return "[Hình ảnh]";
    case "video": return "[Video]";
    case "file": return `[Tệp] ${message.attachments?.[0]?.name ?? ""}`.trim();
    case "sticker": return "[Sticker]";
    default: return message.text ?? "";
  }
}

export { ApiError, errorText };
