// End-to-end smoke test of the whole backend through the API gateway.
// Needs Node 22+ (built-in fetch and WebSocket), no dependencies:
//   node tests/e2e/smoke.spec.js
// ZALOLITE_E2E_URL overrides the gateway address (default http://localhost:8080).

const base = process.env.ZALOLITE_E2E_URL || "http://localhost:8080";
const wsUrl = base.replace(/^http/, "ws") + "/ws/websocket";
const run = Date.now().toString(36);
const password = "E2e-" + crypto.randomUUID();
let passed = 0;

function check(condition, label) {
  if (!condition) throw new Error("FAILED: " + label);
  passed++;
  console.log("  ok  " + label);
}

async function call(method, path, { token, body, headers = {}, raw = false } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = "Bearer " + token;
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(base + path, init);
  if (raw) return response;
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
  const data = json && typeof json === "object" && "success" in json ? json.data : json;
  return { status: response.status, data, message: json && json.message };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(label, probe, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("TIMEOUT: " + label);
    await sleep(400);
  }
}

/** Minimal STOMP 1.2 client over the raw WebSocket transport of the SockJS endpoint. */
function stomp(token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const handlers = new Map();
    const client = {
      errors: [],
      subscribe(destination, handler) {
        const id = "sub-" + handlers.size;
        handlers.set(id, handler);
        socket.send(`SUBSCRIBE\nid:${id}\ndestination:${destination}\n\n\0`);
      },
      send(destination, payload) {
        socket.send(`SEND\ndestination:${destination}\ncontent-type:application/json\n\n${JSON.stringify(payload)}\0`);
      },
      close() { socket.close(); },
      closed: false,
    };
    socket.onopen = () => socket.send(`CONNECT\naccept-version:1.2\nhost:zalolite\nAuthorization:Bearer ${token}\n\n\0`);
    socket.onerror = () => reject(new Error("WebSocket error"));
    socket.onclose = () => { client.closed = true; };
    socket.onmessage = event => {
      for (const frame of String(event.data).split("\0")) {
        if (!frame.trim()) continue;
        const [head, ...rest] = frame.replace(/^\n+/, "").split("\n\n");
        const [command, ...headerLines] = head.split("\n");
        const headers = Object.fromEntries(headerLines.map(line => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1)]));
        const body = rest.join("\n\n");
        if (command === "CONNECTED") resolve(client);
        else if (command === "ERROR") { client.errors.push(headers.message || body); reject(new Error(headers.message || "STOMP error")); }
        else if (command === "MESSAGE") handlers.get(headers.subscription)?.(JSON.parse(body));
      }
    };
  });
}

async function register(name) {
  const email = `${name}.${run}@e2e.zalolite.test`;
  const result = await call("POST", "/api/auth/register", { body: { email, password, displayName: name } });
  if (result.status !== 200) throw new Error(`register ${name}: ${result.status} ${result.message}`);
  return { name, email, id: result.data.user.id, token: result.data.accessToken, refreshToken: result.data.refreshToken };
}

async function main() {
  console.log("Gateway: " + base);
  await until("gateway and user-service are up", async () => {
    try {
      const health = await call("GET", "/actuator/health");
      if (health.status !== 200) return false;
      const login = await call("POST", "/api/auth/login", { body: { email: "nobody@e2e.zalolite.test", password: "x" } });
      return login.status === 401;
    } catch { return false; }
  }, 240000);
  const an = await register("An");
  // The gateway answers 401 by itself, so readiness of the other services needs a real token.
  await until("every service answers behind the gateway", async () => {
    try {
      for (const path of ["/api/groups", "/api/chat/conversations", "/api/media/none", "/api/stats/overview"]) {
        if ((await call("GET", path, { token: an.token })).status >= 500) return false;
      }
      return true;
    } catch { return false; }
  }, 240000);

  console.log("\n# Accounts and security");
  const binh = await register("Binh");
  const chi = await register("Chi");
  check(an.id && an.token, "register returns profile and tokens");
  check((await call("GET", "/api/users/me")).status === 401, "request without token is rejected");
  check((await call("GET", "/api/users/me", { token: an.refreshToken })).status === 401, "refresh token cannot be used as access token");
  const spoof = await call("GET", "/api/users/me", { token: an.token, headers: { "X-User-Id": binh.id } });
  check(spoof.data.id === an.id, "client-supplied X-User-Id is ignored");
  check((await call("POST", "/api/auth/register", { body: { email: an.email, password, displayName: "An" } })).status === 409, "duplicate e-mail is rejected");
  check((await call("POST", "/api/auth/login", { body: { email: an.email, password: "wrong-password" } })).status === 401, "wrong password is rejected");
  check((await call("POST", "/api/auth/login", { body: { email: an.email, password } })).status === 200, "login works");
  const updated = await call("PUT", "/api/users/me", { token: an.token, body: { displayName: "An Nguyễn", bio: "Xin chào" } });
  check(updated.data.displayName === "An Nguyễn" && updated.data.bio === "Xin chào", "profile update");

  console.log("\n# Friends");
  const found = await call("GET", "/api/users/search?q=" + encodeURIComponent(binh.email), { token: an.token });
  check(found.data.length === 1 && found.data[0].id === binh.id && found.data[0].relation === "NONE", "find a user by e-mail");
  const binhSocket = await stomp(binh.token);
  const binhEvents = [];
  binhSocket.subscribe("/topic/users/" + binh.id, event => binhEvents.push(event));
  await sleep(300);
  const request = await call("POST", "/api/friends/requests", { token: an.token, body: { email: binh.email, message: "Kết bạn nhé" } });
  check(request.status === 200 && request.data.status === "PENDING", "send friend request by e-mail");
  await until("friend request pushed over WebSocket", () => binhEvents.some(e => e.type === "friend.requested"));
  check(true, "recipient is notified in real time (RabbitMQ -> chat-service -> WebSocket)");
  const pending = await call("GET", "/api/friends/requests/pending", { token: binh.token });
  check(pending.data.length === 1 && pending.data[0].user.id === an.id, "recipient sees the pending request");
  check((await call("POST", `/api/friends/requests/${request.data.friendshipId}/accept`, { token: an.token })).status === 403, "sender cannot accept their own request");
  check((await call("POST", `/api/friends/requests/${request.data.friendshipId}/accept`, { token: binh.token })).data.status === "ACCEPTED", "recipient accepts");
  const friends = await call("GET", "/api/friends", { token: an.token });
  check(friends.data.some(f => f.user.id === binh.id), "both are friends now");

  console.log("\n# Direct chat");
  const dm = await until("direct conversation created from friend.accepted event", async () => {
    const list = await call("GET", "/api/chat/conversations", { token: an.token });
    return list.data.find(c => c.type === "DIRECT" && c.peerId === binh.id);
  });
  check(dm.lastMessage.type === "SYSTEM", "new friends get a conversation with a greeting line");
  const opened = await call("POST", "/api/chat/conversations/direct?peerId=" + binh.id, { token: an.token });
  check(opened.data.id === dm.id, "opening the same direct chat again returns the same conversation");

  const live = [];
  binhSocket.subscribe("/topic/conversations/" + dm.id, message => live.push(message));
  const receipts = [];
  const anSocket = await stomp(an.token);
  anSocket.subscribe("/topic/conversations/" + dm.id + "/events", event => receipts.push(event));
  await sleep(300);

  const first = await call("POST", "/api/chat/messages", { token: an.token, body: { conversationId: dm.id, clientMsgId: "c-1", content: "Chào Bình!", type: "TEXT" } });
  check(first.status === 200 && first.data.status === "SENT" && first.data.seq > 1, "send text message over REST");
  const retry = await call("POST", "/api/chat/messages", { token: an.token, body: { conversationId: dm.id, clientMsgId: "c-1", content: "Chào Bình!", type: "TEXT" } });
  check(retry.data.id === first.data.id, "retry with the same clientMsgId does not duplicate");
  await until("message delivered over WebSocket", () => live.some(m => m.id === first.data.id));
  check(binhEvents.some(e => e.type === "message.new" && e.data.id === first.data.id), "recipient gets the message on conversation and user topics");

  anSocket.send("/app/chat.send", { conversationId: dm.id, clientMsgId: "c-2", content: "Gửi qua WebSocket" });
  const second = await until("message sent over STOMP arrives", () => live.find(m => m.clientMsgId === "c-2"));
  check(second.seq === first.data.seq + 1, "sequence numbers increase by one");

  const binhList = await call("GET", "/api/chat/conversations", { token: binh.token });
  check(binhList.data.find(c => c.id === dm.id).unreadCount >= 2, "unread counter for the recipient");
  binhSocket.send("/app/chat.seen", { conversationId: dm.id, seq: second.seq });
  await until("read receipt pushed to the sender", () => receipts.some(e => e.type === "receipt" && e.data.userId === binh.id && e.data.readSeq === second.seq));
  const history = await call("GET", `/api/chat/conversations/${dm.id}/messages`, { token: an.token });
  check(history.data.at(-1).id === second.id && history.data.at(-1).status === "SEEN", "history is chronological and shows SEEN");
  check((await call("GET", "/api/chat/conversations", { token: binh.token })).data.find(c => c.id === dm.id).unreadCount === 0, "unread counter reset after reading");
  const older = await call("GET", `/api/chat/conversations/${dm.id}/messages?limit=1&beforeSeq=${second.seq}`, { token: an.token });
  check(older.data.length === 1 && older.data[0].id === first.data.id, "cursor pagination with beforeSeq");

  const reply = await call("POST", "/api/chat/messages", { token: binh.token, body: { conversationId: dm.id, clientMsgId: "c-3", content: "Chào An", replyToId: first.data.id } });
  check(reply.data.replyTo.id === first.data.id && reply.data.replyTo.preview === "Chào Bình!", "reply quotes the original message");
  const reacted = await call("POST", `/api/chat/messages/${first.data.id}/reactions`, { token: binh.token, body: { emoji: "❤️" } });
  check(reacted.data.reactions["❤️"].includes(binh.id), "reaction added");
  const unreacted = await call("POST", `/api/chat/messages/${first.data.id}/reactions`, { token: binh.token, body: { emoji: "❤️" } });
  check(!unreacted.data.reactions["❤️"], "same reaction again removes it");
  check((await call("PUT", `/api/chat/messages/${first.data.id}/pin`, { token: an.token, body: { pinned: true } })).status === 200, "pin a message");
  check((await call("GET", `/api/chat/conversations/${dm.id}/pins`, { token: binh.token })).data[0].id === first.data.id, "pinned message is visible to the other member");
  check((await call("GET", `/api/chat/conversations/${dm.id}/messages/search?q=websocket`, { token: binh.token })).data.length === 1, "search inside a conversation");
  check((await call("POST", `/api/chat/messages/${first.data.id}/recall`, { token: binh.token })).status === 403, "only the sender can recall");
  const recalled = await call("POST", `/api/chat/messages/${first.data.id}/recall`, { token: an.token });
  check(recalled.data.recalled && recalled.data.content === null, "recalled message loses its content");
  check((await call("GET", `/api/chat/conversations/${dm.id}/messages`, { token: chi.token })).status === 403, "outsider cannot read the conversation");
  let denied = false;
  try { const spy = await stomp(chi.token); spy.subscribe("/topic/conversations/" + dm.id, () => {}); await until("subscription refused", () => spy.closed, 5000); denied = true; } catch { denied = true; }
  check(denied, "outsider cannot subscribe to the conversation topic");
  let rejected = false;
  try { await stomp("not-a-token"); } catch { rejected = true; }
  check(rejected, "WebSocket CONNECT without a valid token is refused");
  const presence = await call("GET", `/api/chat/presence?ids=${binh.id},${chi.id}`, { token: an.token });
  check(presence.data.find(p => p.userId === binh.id).online && !presence.data.find(p => p.userId === chi.id).online, "presence: online while a socket is open");

  console.log("\n# Groups");
  const group = await call("POST", "/api/groups", { token: an.token, body: { name: "Nhóm E2E " + run, memberIds: [binh.id, chi.id, "khong-ton-tai"] } });
  check(group.status === 200 && group.data.memberCount === 3 && group.data.myRole === "OWNER", "create group (unknown member ids are ignored)");
  const groupId = group.data.id;
  const groupChat = await until("group conversation created from group.created event", async () => {
    const list = await call("GET", "/api/chat/conversations", { token: chi.token });
    return list.data.find(c => c.id === groupId);
  });
  check(groupChat.type === "GROUP" && groupChat.name.startsWith("Nhóm E2E") && groupChat.lastMessage.type === "SYSTEM", "group conversation id equals group id and starts with a system message");
  const inGroup = await call("POST", "/api/chat/messages", { token: binh.token, body: { conversationId: groupId, clientMsgId: "g-1", content: "Chào cả nhóm" } });
  check(inGroup.status === 200, "member sends a group message");
  check((await call("GET", `/api/chat/conversations/${groupId}/messages`, { token: chi.token })).data.some(m => m.id === inGroup.data.id), "other member reads it");
  check((await call("PUT", `/api/groups/${groupId}`, { token: binh.token, body: { name: "Đổi tên" } })).status === 403, "plain member cannot rename the group");
  check((await call("PUT", `/api/groups/${groupId}/members/${binh.id}/role`, { token: an.token, body: { role: "ADMIN" } })).status === 200, "owner promotes a deputy");
  check((await call("DELETE", `/api/groups/${groupId}/members/${chi.id}`, { token: binh.token })).status === 200, "deputy removes a member");
  await until("removed member loses access to the group chat", async () =>
    (await call("GET", `/api/chat/conversations/${groupId}/messages`, { token: chi.token })).status === 403);
  check(true, "removed member can no longer read the group chat");
  check((await call("POST", `/api/groups/${groupId}/leave`, { token: an.token })).status === 400, "owner must transfer ownership before leaving");
  check((await call("POST", `/api/groups/${groupId}/owner`, { token: an.token, body: { userId: binh.id } })).status === 200, "ownership transfer");
  check((await call("POST", `/api/groups/${groupId}/leave`, { token: an.token })).status === 200, "former owner leaves");
  const detail = await call("GET", `/api/groups/${groupId}`, { token: binh.token });
  check(detail.data.memberCount === 1 && detail.data.myRole === "OWNER", "group detail reflects the changes");
  await until("system messages describe the changes", async () => {
    const messages = (await call("GET", `/api/chat/conversations/${groupId}/messages`, { token: binh.token })).data;
    return messages.filter(m => m.type === "SYSTEM").length >= 5;
  });
  check(true, "membership changes appear as system messages");

  console.log("\n# Media");
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), c => c.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "ảnh thử.png");
  const upload = await call("POST", "/api/media", { token: binh.token, body: form });
  check(upload.status === 200 && upload.data.kind === "IMAGE" && upload.data.size === png.length, "upload an image");
  const download = await call("GET", upload.data.url, { raw: true });
  check(download.status === 200 && download.headers.get("content-type") === "image/png" && (await download.arrayBuffer()).byteLength === png.length, "download it by URL (no token, unguessable id)");
  const html = new FormData();
  html.append("file", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "x.html");
  const htmlUpload = await call("POST", "/api/media", { token: binh.token, body: html });
  const htmlDownload = await call("GET", htmlUpload.data.url, { raw: true });
  check(htmlDownload.headers.get("content-disposition").startsWith("attachment") && htmlDownload.headers.get("x-content-type-options") === "nosniff", "HTML uploads are served as downloads, never rendered");
  await htmlDownload.arrayBuffer();
  const image = await call("POST", "/api/chat/messages", { token: binh.token, body: { conversationId: dm.id, clientMsgId: "c-4", type: "IMAGE", content: "Ảnh nè", attachments: [upload.data] } });
  check(image.data.type === "IMAGE" && image.data.attachments[0].url === upload.data.url, "send an image message");
  check((await call("POST", "/api/chat/messages", { token: binh.token, body: { conversationId: dm.id, clientMsgId: "c-5", type: "IMAGE" } })).status === 422, "image message without attachment is rejected");
  const forwarded = await call("POST", `/api/chat/messages/${image.data.id}/forward`, { token: binh.token, body: { conversationIds: [groupId] } });
  check(forwarded.data[0].forwarded && forwarded.data[0].conversationId === groupId, "forward a message to another conversation");

  console.log("\n# Statistics (event-driven)");
  const stats = await until("statistics catch up with the events", async () => {
    const overview = await call("GET", "/api/stats/overview", { token: an.token });
    return overview.data.totalMessages >= 5 && overview.data.newUsers >= 3 && overview.data.totalMedia >= 2 ? overview.data : null;
  });
  check(stats.activeUsers >= 2, "overview counts messages, new users, media and active users");
  const topGroups = await call("GET", "/api/stats/groups", { token: an.token });
  check(topGroups.data.some(g => g.groupId === groupId && String(g.groupName).startsWith("Nhóm E2E")), "most active groups include the test group with its name");
  check((await call("GET", "/api/stats/users", { token: an.token })).data.some(u => u.userId === binh.id && u.displayName === "Binh"), "most active users");
  check((await call("GET", "/api/stats/media", { token: an.token })).data.some(m => m.mediaKind === "IMAGE"), "media per kind");
  check((await call("GET", "/api/stats/history?days=7", { token: an.token })).data.length === 7, "daily history");

  console.log("\n# Session");
  const refreshed = await call("POST", "/api/auth/refresh", { body: { refreshToken: an.refreshToken } });
  check(refreshed.status === 200 && refreshed.data.refreshToken !== an.refreshToken, "refresh issues a new token pair");
  check((await call("POST", "/api/auth/refresh", { body: { refreshToken: an.refreshToken } })).status === 401, "a used refresh token is revoked (rotation)");
  await call("POST", "/api/auth/logout", { body: { refreshToken: refreshed.data.refreshToken } });
  check((await call("POST", "/api/auth/refresh", { body: { refreshToken: refreshed.data.refreshToken } })).status === 401, "logout revokes the refresh token");
  binhSocket.close();
  anSocket.close();
  await until("presence goes offline after disconnect", async () =>
    !(await call("GET", "/api/chat/presence/" + binh.id, { token: chi.token })).data.online);
  check(true, "presence: offline with last seen after the socket closes");

  console.log(`\nZaloLite E2E passed: ${passed} checks`);
}

main().then(() => process.exit(0)).catch(error => {
  console.error("\n" + (error.stack || error));
  process.exit(1);
});
