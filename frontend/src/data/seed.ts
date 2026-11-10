import type { Conversation, DbState, Message, User } from "./types";
import { colorFor } from "../lib/format";

export const ME_ID = "u_me";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Simple generated illustration so the demo has image messages without external assets. */
export function sceneImage(seed: number, label = ""): string {
  const hues = [[205, 170], [25, 340], [150, 200], [265, 220], [45, 15]][seed % 5];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hues[0]},75%,72%)"/><stop offset="1" stop-color="hsl(${hues[1]},70%,88%)"/></linearGradient></defs>
<rect width="640" height="420" fill="url(#g)"/><circle cx="${470 - seed * 37 % 200}" cy="120" r="46" fill="hsl(${hues[1]},90%,96%)" opacity=".9"/>
<path d="M0 320 L140 210 L250 290 L380 170 L520 280 L640 220 L640 420 L0 420Z" fill="hsl(${hues[0]},40%,40%)" opacity=".75"/>
<path d="M0 360 L180 280 L320 350 L470 270 L640 340 L640 420 L0 420Z" fill="hsl(${hues[0]},45%,28%)" opacity=".85"/>
${label ? `<text x="24" y="396" font-family="sans-serif" font-size="22" fill="#fff" opacity=".9">${label}</text>` : ""}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function user(id: string, name: string, extra: Partial<User> = {}): User {
  return { id, name, color: colorFor(id), online: false, lastSeen: Date.now() - 2 * HOUR, ...extra };
}

let seq = 0;
function msg(conversationId: string, senderId: string, minutesAgo: number, partial: Partial<Message>): Message {
  seq += 1;
  return {
    id: `m_seed_${seq}`,
    clientMsgId: `seed_${seq}`,
    conversationId,
    seq,
    senderId,
    kind: "text",
    reactions: {},
    status: "seen",
    createdAt: Date.now() - minutesAgo * 60_000,
    ...partial,
  };
}

function convo(id: string, type: Conversation["type"], memberIds: string[], extra: Partial<Conversation> = {}): Conversation {
  const roles: Conversation["roles"] = {};
  memberIds.forEach(m => { roles[m] = "member"; });
  return {
    id, type, memberIds, roles, pinned: false, muted: false, unread: 0, pinnedMessageIds: [],
    createdAt: Date.now() - 30 * DAY, updatedAt: Date.now(), color: colorFor(id), ...extra,
  };
}

export function createSeed(me: Partial<User> = {}): DbState {
  seq = 0;
  const users: Record<string, User> = {};
  const add = (u: User) => { users[u.id] = u; };
  add(user(ME_ID, me.name ?? "Nguyễn Văn Tâm", {
    email: me.email ?? "tam@zalolite.dev", phone: "0901 234 567", online: true, gender: "male",
    birthday: "1998-11-23", bio: "Học viên cao học CO5185 – Kiến trúc phần mềm", ...me, id: ME_ID,
  }));
  add(user("u_linh", "Trần Thùy Linh", { online: true, phone: "0912 000 111", gender: "female", bio: "Frontend & Analytics" }));
  add(user("u_minh", "Lê Quang Minh", { online: true, phone: "0913 222 333", gender: "male", bio: "Realtime backend" }));
  add(user("u_hoa", "Phạm Ngọc Hoa", { lastSeen: Date.now() - 25 * 60_000, gender: "female" }));
  add(user("u_khoa", "Đỗ Đăng Khoa", { lastSeen: Date.now() - 3 * HOUR, gender: "male" }));
  add(user("u_mai", "Mẹ", { online: true, gender: "female" }));
  add(user("u_an", "Võ Bình An", { lastSeen: Date.now() - DAY, gender: "male" }));
  add(user("u_thao", "Ngô Phương Thảo", { lastSeen: Date.now() - 5 * HOUR, gender: "female" }));
  add(user("u_phuoc", "Thầy Phước", { lastSeen: Date.now() - 50 * 60_000, gender: "male", bio: "Giảng viên" }));
  // Users that are not friends yet (for search / friend requests).
  add(user("u_duc", "Huỳnh Minh Đức", { phone: "0987 654 321", email: "duc@zalolite.dev", gender: "male" }));
  add(user("u_vy", "Bùi Tường Vy", { phone: "0977 111 222", email: "vy@zalolite.dev", gender: "female", online: true }));
  add(user("u_long", "Cao Thành Long", { phone: "0966 333 444", email: "long@zalolite.dev", gender: "male" }));
  add(user("u_ngan", "Lý Kim Ngân", { phone: "0955 888 999", email: "ngan@zalolite.dev", gender: "female" }));

  const friendIds = ["u_linh", "u_minh", "u_hoa", "u_khoa", "u_mai", "u_an", "u_thao", "u_phuoc"];

  const conversations: Record<string, Conversation> = {};
  const messages: Record<string, Message[]> = {};
  const put = (c: Conversation, list: Message[]) => {
    conversations[c.id] = { ...c, updatedAt: list.length ? list[list.length - 1].createdAt : c.updatedAt };
    messages[c.id] = list;
  };

  put(convo("c_self", "self", [ME_ID], { name: "Cloud của tôi", pinned: true }), [
    msg("c_self", ME_ID, 60 * 26, { text: "Link báo cáo giữa kỳ: https://lms.example.edu/co5185/report" }),
    msg("c_self", ME_ID, 60 * 25, { kind: "file", attachments: [{ id: "a_cloud_1", name: "Kien-truc-ZaloLite-v2.pdf", size: 2_480_000, mime: "application/pdf", url: "#", kind: "file" }] }),
  ]);

  const team = convo("c_team", "group", [ME_ID, "u_linh", "u_minh"], { name: "Nhóm đồ án CO5185", description: "Bài tập lớn Kiến trúc phần mềm – nhóm 3 người" });
  team.roles[ME_ID] = "owner";
  team.roles["u_linh"] = "deputy";
  const teamMsgs = [
    msg("c_team", ME_ID, 60 * 27, { kind: "system", text: "Nguyễn Văn Tâm đã tạo nhóm" }),
    msg("c_team", "u_minh", 60 * 5, { text: "Chat service đã có WebSocket + seq rồi nha mọi người 🎉" }),
    msg("c_team", "u_linh", 60 * 4.8, { text: "Ok để mình nối frontend vào luôn", reactions: { "❤️": [ME_ID, "u_minh"] } }),
    msg("c_team", ME_ID, 60 * 4.5, { kind: "image", attachments: [{ id: "a_t1", name: "c4-container.png", size: 312_000, mime: "image/svg+xml", url: sceneImage(0, "C4 – Container"), kind: "image" }] }),
    msg("c_team", ME_ID, 60 * 4.4, { text: "Sơ đồ C4 mức container, mọi người xem góp ý nhé" }),
    msg("c_team", "u_minh", 60 * 1.2, { kind: "file", attachments: [{ id: "a_t2", name: "openapi-chat.yml", size: 18_400, mime: "text/yaml", url: "#", kind: "file" }] }),
    msg("c_team", "u_linh", 35, {
      kind: "poll", poll: {
        question: "Chốt lịch họp tuần này?", multiple: false,
        options: [
          { id: "p1", text: "Tối thứ 4 (20h)", voterIds: ["u_linh", "u_minh"] },
          { id: "p2", text: "Tối thứ 6 (20h)", voterIds: [] },
          { id: "p3", text: "Sáng chủ nhật", voterIds: [] },
        ],
      },
    }),
    msg("c_team", "u_minh", 12, { text: "@Nguyễn Văn Tâm nhớ review PR #42 giúp mình nhé", mentions: [ME_ID] }),
  ];
  team.pinnedMessageIds = [teamMsgs[4].id];
  team.unread = 2;
  put(team, teamMsgs);

  put(convo("c_linh", "direct", [ME_ID, "u_linh"], { unread: 1 }), [
    msg("c_linh", "u_linh", 60 * 30, { text: "Chào Tâm, mai lên lab không?" }),
    msg("c_linh", ME_ID, 60 * 29.5, { text: "Có nhé, 9h nha" }),
    msg("c_linh", "u_linh", 60 * 29, { kind: "sticker", sticker: "👍" }),
    msg("c_linh", ME_ID, 60 * 2, { kind: "call", call: { video: true, durationSec: 312, missed: false } }),
    msg("c_linh", "u_linh", 8, { text: "Màn hình dashboard mình đẩy lên nhánh feature/stats rồi đó" }),
  ]);

  const family = convo("c_family", "group", [ME_ID, "u_mai", "u_an", "u_thao"], { name: "Gia đình ❤️", muted: true });
  family.roles["u_mai"] = "owner";
  put(family, [
    msg("c_family", "u_mai", 60 * 20, { text: "Cuối tuần về nhà ăn cơm nhé các con" }),
    msg("c_family", "u_an", 60 * 19.5, { text: "Dạ mẹ, con về chiều thứ 7" }),
    msg("c_family", "u_thao", 60 * 19, { kind: "image", attachments: [
      { id: "a_f1", name: "que-nha-1.jpg", size: 540_000, mime: "image/svg+xml", url: sceneImage(2), kind: "image" },
      { id: "a_f2", name: "que-nha-2.jpg", size: 610_000, mime: "image/svg+xml", url: sceneImage(4), kind: "image" },
    ] }),
    msg("c_family", ME_ID, 60 * 18, { text: "Đẹp quá 😍", reactions: { "😍": ["u_mai"] } }),
  ]);

  put(convo("c_minh", "direct", [ME_ID, "u_minh"]), [
    msg("c_minh", "u_minh", 60 * 50, { text: "Redis presence chạy ổn rồi" }),
    msg("c_minh", ME_ID, 60 * 49, { text: "Tuyệt, cảm ơn Minh!" }),
  ]);

  put(convo("c_phuoc", "direct", [ME_ID, "u_phuoc"]), [
    msg("c_phuoc", ME_ID, 60 * 72, { text: "Dạ thầy ơi, nhóm em xin nộp đăng ký đề tài ZaloLite ạ." }),
    msg("c_phuoc", "u_phuoc", 60 * 70, { text: "Thầy đã nhận. Nhớ release lên cloud theo tuần nhé." }),
  ]);

  put(convo("c_hoa", "direct", [ME_ID, "u_hoa"]), [
    msg("c_hoa", "u_hoa", 60 * 100, { text: "Gửi Tâm tài liệu ôn tập nhé" }),
    msg("c_hoa", "u_hoa", 60 * 99.8, { kind: "file", attachments: [{ id: "a_h1", name: "On-tap-Kien-truc.docx", size: 845_000, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", url: "#", kind: "file" }] }),
  ]);

  return {
    users,
    friendIds,
    requests: [
      { id: "fr_1", fromId: "u_vy", toId: ME_ID, message: "Xin chào, mình là Vy lớp CO5185, kết bạn nhé!", createdAt: Date.now() - 3 * HOUR },
      { id: "fr_2", fromId: "u_long", toId: ME_ID, message: "Mình biết bạn qua nhóm đồ án.", createdAt: Date.now() - DAY },
    ],
    conversations,
    messages,
    typing: {},
    settings: { theme: "light", fontSize: "md", enterToSend: true, showOnline: true, readReceipts: true, notifySound: true },
  };
}

export const CANNED_REPLIES = [
  "Ok bạn 👌",
  "Để mình xem rồi báo lại nhé",
  "Hay đấy!",
  "Chuẩn luôn 😄",
  "Mình đang bận chút, lát nhắn lại nha",
  "Cảm ơn nhé!",
  "Đã nhận 👍",
  "Haha 😂",
];
