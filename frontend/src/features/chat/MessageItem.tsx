import { Fragment, memo, ReactNode, useState } from "react";
import type { Conversation, Message, User } from "../../data/types";
import { ME_ID, store } from "../../data/store";
import { Avatar, Menu, MenuItem, askConfirm } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { clock, duration, fileExt, fileSize, URL_PATTERN } from "../../lib/format";
import { QUICK_REACTIONS } from "./messageUtils";
import { openProfile } from "../../app/AppShell";

export interface MessageItemProps {
  message: Message;
  conversation: Conversation;
  users: Record<string, User>;
  firstOfCluster: boolean;
  lastOfCluster: boolean;
  showStatus: boolean;
  highlight?: string;
  focused?: boolean;
  onReply: (m: Message) => void;
  onForward: (m: Message) => void;
  onOpenImage: (url: string) => void;
  onJumpTo: (id: string) => void;
}

function RichText({ text, users, highlight }: { text: string; users: Record<string, User>; highlight?: string }) {
  const names = Object.values(users).map(u => u.name).sort((a, b) => b.length - a.length);
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>;
        // Mentions: "@Full Name"
        const nodes: ReactNode[] = [];
        let rest = part;
        let k = 0;
        while (rest.length) {
          const at = rest.indexOf("@");
          if (at < 0) { nodes.push(mark(rest, highlight, `${i}-${k++}`)); break; }
          const name = names.find(n => rest.startsWith(n, at + 1));
          if (!name) { nodes.push(mark(rest.slice(0, at + 1), highlight, `${i}-${k++}`)); rest = rest.slice(at + 1); continue; }
          nodes.push(mark(rest.slice(0, at), highlight, `${i}-${k++}`));
          nodes.push(<span key={`${i}-m${k++}`} className="mention">@{name}</span>);
          rest = rest.slice(at + 1 + name.length);
        }
        return <Fragment key={i}>{nodes}</Fragment>;
      })}
    </>
  );
}

function mark(text: string, highlight: string | undefined, key: string): ReactNode {
  if (!highlight?.trim() || !text) return <Fragment key={key}>{text}</Fragment>;
  const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (idx < 0) return <Fragment key={key}>{text}</Fragment>;
  return <Fragment key={key}>{text.slice(0, idx)}<mark>{text.slice(idx, idx + highlight.length)}</mark>{text.slice(idx + highlight.length)}</Fragment>;
}

const STATUS_LABEL: Record<Message["status"], string> = { sending: "Đang gửi", sent: "Đã gửi", delivered: "Đã nhận", seen: "Đã xem", failed: "Gửi lỗi" };

export const MessageItem = memo(function MessageItem(props: MessageItemProps) {
  const { message: m, conversation, users, firstOfCluster, lastOfCluster, showStatus, highlight, focused } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mine = m.senderId === ME_ID;
  const sender = users[m.senderId];
  const cid = conversation.id;

  if (m.kind === "system") {
    return <div className="system-msg" id={`msg-${m.id}`}><span>{m.text}</span></div>;
  }

  const isMedia = (m.kind === "image" || m.kind === "video" || m.kind === "sticker") && !m.recalled;
  const canRecall = mine && !m.recalled && Date.now() - m.createdAt < 24 * 3600_000;
  const pinned = conversation.pinnedMessageIds.includes(m.id);
  const reactionEntries = Object.entries(m.reactions).filter(([, v]) => v.length);
  const totalReactions = reactionEntries.reduce((n, [, v]) => n + v.length, 0);
  const myReaction = reactionEntries.find(([, v]) => v.includes(ME_ID))?.[0];

  const items: MenuItem[] = [];
  if (m.text && !m.recalled) items.push({ label: "Sao chép tin nhắn", icon: "copy", onClick: () => { void navigator.clipboard?.writeText(m.text ?? ""); store.toast("Đã sao chép"); } });
  if (!m.recalled) items.push(pinned
    ? { label: "Bỏ ghim tin nhắn", icon: "pin", onClick: () => store.unpinMessage(cid, m.id) }
    : { label: "Ghim tin nhắn", icon: "pin", onClick: () => store.pinMessage(cid, m.id) });
  if (m.attachments?.length && !m.recalled) items.push({ label: "Tải xuống", icon: "download", onClick: () => m.attachments!.forEach(download) });
  if (canRecall) items.push({ label: "Thu hồi", icon: "undo", danger: true, onClick: async () => { if (await askConfirm("Thu hồi tin nhắn này với mọi người?", "Thu hồi")) store.recall(cid, m.id); } });
  items.push({ label: "Xóa chỉ ở phía tôi", icon: "trash", danger: true, onClick: () => store.deleteForMe(cid, m.id) });

  return (
    <div id={`msg-${m.id}`} className={`msg-row ${mine ? "mine" : ""} ${firstOfCluster ? "first" : ""} ${lastOfCluster ? "last" : ""} ${focused ? "focused" : ""}`}>
      {!mine && (
        <div className="msg-avatar">
          {firstOfCluster && conversation.type !== "self" && <button onClick={() => openProfile(m.senderId)} aria-label={sender?.name}><Avatar user={sender} size={34} /></button>}
        </div>
      )}
      <div className="msg-stack">
        <div className="msg-line">
          <div className={`bubble ${isMedia ? "media" : ""} ${m.kind === "sticker" ? "sticker" : ""} ${m.recalled ? "recalled" : ""}`}>
            {!mine && firstOfCluster && conversation.type === "group" && <div className="msg-sender">{sender?.name}</div>}
            {m.forwarded && !m.recalled && <div className="forwarded"><Icon name="forward" size={13} /> Đã chuyển tiếp</div>}
            {m.replyTo && !m.recalled && (
              <button className="reply-quote" onClick={() => props.onJumpTo(m.replyTo!.id)}>
                <b>{m.replyTo.senderName}</b>
                <span>{m.replyTo.preview}</span>
              </button>
            )}
            {m.recalled ? <span className="muted-text">Tin nhắn đã được thu hồi</span> : <Body m={m} users={users} highlight={highlight} onOpenImage={props.onOpenImage} cid={cid} />}
            {lastOfCluster && !isMedia && <time className="msg-time">{clock(m.createdAt)}</time>}
            {reactionEntries.length > 0 && (
              <button className="reaction-summary" onClick={() => setPickerOpen(true)} title={reactionEntries.map(([e, v]) => `${e} ${v.map(u => users[u]?.name).join(", ")}`).join("\n")}>
                {reactionEntries.slice(0, 3).map(([e]) => <span key={e}>{e}</span>)}
                <small>{totalReactions}</small>
              </button>
            )}
            {!m.recalled && m.kind !== "call" && (
              <div className="react-anchor">
                <button className={`react-btn ${myReaction ? "active" : ""}`} aria-label="Thả cảm xúc" onClick={() => store.react(cid, m.id, myReaction ?? "❤️")} onMouseEnter={() => setPickerOpen(true)}>
                  {myReaction ?? <Icon name="heart" size={15} />}
                </button>
                {pickerOpen && (
                  <div className="reaction-picker" onMouseLeave={() => setPickerOpen(false)}>
                    {QUICK_REACTIONS.map(e => <button key={e} onClick={() => { store.react(cid, m.id, e); setPickerOpen(false); }} className={m.reactions[e]?.includes(ME_ID) ? "on" : ""}>{e}</button>)}
                    {myReaction && <button className="clear" title="Bỏ cảm xúc" onClick={() => { store.clearMyReactions(cid, m.id); setPickerOpen(false); }}><Icon name="close" size={14} /></button>}
                  </div>
                )}
              </div>
            )}
          </div>
          {!m.recalled && (
            <div className="msg-actions">
              <button title="Trả lời" aria-label="Trả lời" onClick={() => props.onReply(m)}><Icon name="reply" size={16} /></button>
              {m.kind !== "poll" && m.kind !== "call" && <button title="Chuyển tiếp" aria-label="Chuyển tiếp" onClick={() => props.onForward(m)}><Icon name="forward" size={16} /></button>}
              <div className="menu-anchor">
                <button title="Thêm" aria-label="Thêm" onClick={() => setMenuOpen(v => !v)}><Icon name="more" size={16} /></button>
                {menuOpen && <Menu items={items} onClose={() => setMenuOpen(false)} align={mine ? "right" : "left"} />}
              </div>
            </div>
          )}
        </div>
        {isMedia && lastOfCluster && <time className="msg-time outside">{clock(m.createdAt)}</time>}
        {mine && showStatus && (
          <div className={`msg-status ${m.status}`}>
            {m.status === "failed"
              ? <button className="link-btn" onClick={() => store.retry(cid, m.id)}>Gửi lỗi · Thử lại</button>
              : <>{m.status === "seen" ? <Icon name="checks" size={14} /> : <Icon name="check" size={14} />}{STATUS_LABEL[m.status]}</>}
          </div>
        )}
      </div>
    </div>
  );
});

function Body({ m, users, highlight, onOpenImage, cid }: { m: Message; users: Record<string, User>; highlight?: string; onOpenImage: (url: string) => void; cid: string }) {
  switch (m.kind) {
    case "text":
      return <div className="msg-text"><RichText text={m.text ?? ""} users={users} highlight={highlight} /></div>;
    case "sticker":
      return <div className="sticker-glyph" aria-label="Sticker">{m.sticker}</div>;
    case "image": {
      const list = m.attachments ?? [];
      return (
        <div className={`image-grid n${Math.min(list.length, 4)}`}>
          {list.map(a => (
            <button key={a.id} className="image-cell" onClick={() => a.url !== "#" && onOpenImage(a.url)}>
              {a.url === "#" ? <span className="expired">Ảnh không còn khả dụng</span> : <img src={a.url} alt={a.name} loading="lazy" />}
            </button>
          ))}
          {m.text && <div className="msg-text caption"><RichText text={m.text} users={users} highlight={highlight} /></div>}
        </div>
      );
    }
    case "video":
      return (
        <div className="video-wrap">
          {m.attachments?.map(a => a.url === "#"
            ? <span key={a.id} className="expired">Video không còn khả dụng</span>
            : <video key={a.id} src={a.url} controls preload="metadata" />)}
        </div>
      );
    case "file":
      return (
        <div className="file-list">
          {m.attachments?.map(a => (
            <div key={a.id} className="file-card">
              <span className={`file-ext ext-${fileExt(a.name).toLowerCase()}`}>{fileExt(a.name)}</span>
              <span className="file-meta"><b title={a.name}>{a.name}</b><small>{fileSize(a.size)}</small></span>
              <button className="icon-btn" aria-label="Tải xuống" onClick={() => download(a)}><Icon name="download" size={18} /></button>
            </div>
          ))}
        </div>
      );
    case "call": {
      const c = m.call!;
      return (
        <div className={`call-card ${c.missed ? "missed" : ""}`}>
          <span className="call-icon"><Icon name={c.video ? "video" : "phone"} size={18} /></span>
          <span><b>{c.missed ? "Cuộc gọi nhỡ" : c.video ? "Cuộc gọi video" : "Cuộc gọi thoại"}</b><small>{c.missed ? "Không trả lời" : duration(c.durationSec)}</small></span>
        </div>
      );
    }
    case "poll": {
      const poll = m.poll!;
      const total = new Set(poll.options.flatMap(o => o.voterIds)).size;
      return (
        <div className="poll">
          <div className="poll-title"><Icon name="poll" size={16} /> <b>{poll.question}</b></div>
          <small>{poll.multiple ? "Chọn nhiều phương án" : "Chọn một phương án"} · {total} người đã bình chọn</small>
          {poll.options.map(o => {
            const pct = total ? Math.round((o.voterIds.length / total) * 100) : 0;
            const mine = o.voterIds.includes(ME_ID);
            return (
              <button key={o.id} className={`poll-option ${mine ? "voted" : ""}`} onClick={() => store.vote(cid, m.id, o.id)}>
                <i style={{ width: `${pct}%` }} />
                <span className="poll-check">{mine && <Icon name="check" size={13} />}</span>
                <span className="poll-text">{o.text}</span>
                <span className="poll-count">{o.voterIds.length}</span>
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}

function download(a: { url: string; name: string }) {
  if (a.url === "#") { store.toast("Tệp mẫu không có nội dung để tải", "error"); return; }
  const link = document.createElement("a");
  link.href = a.url;
  link.download = a.name;
  link.click();
}
