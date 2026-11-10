import type { Message, User } from "../../data/types";
import { ME_ID } from "../../data/store";
import { duration } from "../../lib/format";

export function messagePreview(m: Message | undefined, users: Record<string, User>, withSender = false): string {
  if (!m) return "";
  if (m.recalled) return `${m.senderId === ME_ID ? "Bạn" : users[m.senderId]?.name ?? ""} đã thu hồi một tin nhắn`;
  let body = "";
  switch (m.kind) {
    case "text": body = m.text ?? ""; break;
    case "image": body = m.attachments && m.attachments.length > 1 ? `[${m.attachments.length} hình ảnh]` : "[Hình ảnh]"; break;
    case "video": body = "[Video]"; break;
    case "file": body = `[File] ${m.attachments?.[0]?.name ?? ""}`; break;
    case "sticker": body = "[Sticker]"; break;
    case "poll": body = `[Bình chọn] ${m.poll?.question ?? ""}`; break;
    case "call": body = m.call?.missed ? "Cuộc gọi nhỡ" : `${m.call?.video ? "Cuộc gọi video" : "Cuộc gọi thoại"} · ${duration(m.call?.durationSec ?? 0)}`; break;
    case "system": return m.text ?? "";
  }
  if (!withSender) return body;
  const sender = m.senderId === ME_ID ? "Bạn" : users[m.senderId]?.name.split(" ").slice(-1)[0];
  return sender ? `${sender}: ${body}` : body;
}

export function visibleMessages(list: Message[] | undefined): Message[] {
  return (list ?? []).filter(m => !m.deletedFor?.includes(ME_ID));
}

export const QUICK_REACTIONS = ["👍", "❤️", "😆", "😮", "😢", "😡"];

export const EMOJI_GROUPS: { name: string; items: string[] }[] = [
  { name: "Mặt cười", items: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😗 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🥵 🥶 😵 🤯 🥳 😎 🤓 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬".split(" ") },
  { name: "Cử chỉ", items: "👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🙏 💪 🫶 ✍️ 🤝".split(" ") },
  { name: "Trái tim", items: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝".split(" ") },
  { name: "Đồ vật", items: "🎉 🎊 🎁 🎂 🍰 ☕ 🍜 🍕 🍔 🍺 🌹 🌸 🌈 ☀️ 🌙 ⭐ 🔥 💯 ✅ ❌ 📌 📎 💻 📱 📚 ✏️ 🚀 ⚽ 🎵 🐶 🐱".split(" ") },
];

/** Sticker packs are large emoji compositions – no third-party artwork. */
export const STICKER_PACKS: { name: string; items: string[] }[] = [
  { name: "Cảm xúc", items: ["😄", "🥰", "😂", "😭", "😡", "😴", "🤔", "😎", "🥳", "🤯", "😱", "🙄"] },
  { name: "Thú cưng", items: ["🐶", "🐱", "🐼", "🐨", "🦊", "🐰", "🐻", "🐧", "🐥", "🐸", "🐯", "🦄"] },
  { name: "Lời chúc", items: ["👍", "👏", "🙏", "💪", "🎉", "❤️", "🌹", "☕", "🍀", "✨", "🔥", "💯"] },
];
