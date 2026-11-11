import { KeyboardEvent, forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Attachment, Conversation, Message, User } from "../../data/types";
import { ME_ID, store, useApp } from "../../data/store";
import { Icon } from "../../lib/icons";
import { Avatar } from "../../components/ui";
import { fileExt, fileSize, matches, uid } from "../../lib/format";
import { EMOJI_GROUPS, STICKER_PACKS, messagePreview } from "./messageUtils";

export interface ComposerHandle {
  addFiles: (files: FileList | File[]) => void;
  focus: () => void;
}

interface Props {
  conversation: Conversation;
  users: Record<string, User>;
  title: string;
  replyTo?: Message;
  onCancelReply: () => void;
  onCreatePoll: () => void;
}

const MAX_FILE = 100 * 1024 * 1024;

function toAttachment(file: File): Attachment {
  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
  return { id: uid("a"), name: file.name, size: file.size, mime: file.type || "application/octet-stream", url: URL.createObjectURL(file), kind };
}

/** Small images become data URLs so they survive a page reload in demo mode. */
function inlineSmallImage(file: File, attachment: Attachment): Promise<Attachment> {
  if (attachment.kind !== "image" || file.size > 1.5 * 1024 * 1024) return Promise.resolve(attachment);
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({ ...attachment, url: String(reader.result) });
    reader.onerror = () => resolve(attachment);
    reader.readAsDataURL(file);
  });
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ conversation, users, title, replyTo, onCancelReply, onCreatePoll }, ref) {
  const settings = useApp(s => s.db.settings);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ file: File; attachment: Attachment }[]>([]);
  const [panel, setPanel] = useState<"emoji" | "sticker" | undefined>();
  const [mentionQuery, setMentionQuery] = useState<string>();
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cid = conversation.id;

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const tooBig = list.filter(f => f.size > MAX_FILE);
    if (tooBig.length) store.toast(`Tệp vượt quá 100 MB: ${tooBig.map(f => f.name).join(", ")}`, "error");
    setPending(p => [...p, ...list.filter(f => f.size <= MAX_FILE).map(file => ({ file, attachment: toAttachment(file) }))]);
  }

  useImperativeHandle(ref, () => ({ addFiles, focus: () => textareaRef.current?.focus() }));

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === undefined || conversation.type !== "group") return [];
    return conversation.memberIds.filter(id => id !== ME_ID).map(id => users[id]).filter(u => u && matches(u.name, mentionQuery)).slice(0, 6);
  }, [mentionQuery, conversation, users]);

  function updateText(value: string) {
    setText(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = /(^|\s)@([^\s@]{0,20})$/.exec(before);
    setMentionQuery(match && conversation.type === "group" ? match[2] : undefined);
    setMentionIndex(0);
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }
  }

  function insertMention(user: User) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([^\s@]*)$/, `@${user.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setMentionQuery(undefined);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(before.length, before.length); });
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }

  function replyRef() {
    if (!replyTo) return undefined;
    return { id: replyTo.id, senderName: replyTo.senderId === ME_ID ? "Bạn" : users[replyTo.senderId]?.name ?? "", preview: messagePreview(replyTo, users) };
  }

  async function submit() {
    const body = text.trim();
    if (!body && pending.length === 0) {
      store.send(cid, { kind: "sticker", sticker: "👍", replyTo: replyRef() });
      onCancelReply();
      return;
    }
    const attachments = await Promise.all(pending.map(p => inlineSmallImage(p.file, p.attachment)));
    const images = attachments.filter(a => a.kind === "image");
    const videos = attachments.filter(a => a.kind === "video");
    const files = attachments.filter(a => a.kind === "file");
    const reply = replyRef();
    const mentions = conversation.memberIds.filter(id => body.includes(`@${users[id]?.name}`));
    let usedText = false;
    if (images.length) { store.send(cid, { kind: "image", attachments: images, text: body || undefined, replyTo: reply }); usedText = !!body; }
    videos.forEach(v => store.send(cid, { kind: "video", attachments: [v] }));
    files.forEach(f => store.send(cid, { kind: "file", attachments: [f] }));
    if (body && !usedText) store.send(cid, { kind: "text", text: body, replyTo: images.length ? undefined : reply, mentions });
    setText("");
    setPending([]);
    onCancelReply();
    setPanel(undefined);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionCandidates.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionCandidates.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionIndex]); return; }
      if (e.key === "Escape") { setMentionQuery(undefined); return; }
    }
    const sendKey = settings.enterToSend ? e.key === "Enter" && !e.shiftKey : e.key === "Enter" && (e.ctrlKey || e.metaKey);
    if (sendKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
    if (e.key === "Escape" && replyTo) onCancelReply();
  }

  const hasContent = text.trim().length > 0 || pending.length > 0;

  return (
    <div className="composer">
      <div className="composer-toolbar">
        <button className={`tool ${panel === "sticker" ? "on" : ""}`} title="Gửi Sticker" aria-label="Sticker" onClick={() => setPanel(panel === "sticker" ? undefined : "sticker")}><Icon name="sticker" /></button>
        <button className="tool" title="Gửi hình ảnh / video" aria-label="Hình ảnh" onClick={() => imageInput.current?.click()}><Icon name="image" /></button>
        <button className="tool" title="Đính kèm File" aria-label="Đính kèm file" onClick={() => fileInput.current?.click()}><Icon name="attach" /></button>
        {conversation.type === "group" && <button className="tool" title="Tạo bình chọn" aria-label="Bình chọn" onClick={onCreatePoll}><Icon name="poll" /></button>}
        {conversation.type === "group" && <button className="tool" title="Nhắc tên (@)" aria-label="Nhắc tên" onClick={() => { updateText(`${text}${text && !text.endsWith(" ") ? " " : ""}@`); textareaRef.current?.focus(); }}><Icon name="at" /></button>}
        <input ref={imageInput} type="file" accept="image/*,video/*" multiple hidden onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileInput} type="file" multiple hidden onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {replyTo && (
        <div className="reply-bar">
          <Icon name="reply" size={16} />
          <div><b>Trả lời {replyTo.senderId === ME_ID ? "chính bạn" : users[replyTo.senderId]?.name}</b><span>{messagePreview(replyTo, users)}</span></div>
          <button className="icon-btn" aria-label="Hủy trả lời" onClick={onCancelReply}><Icon name="close" size={16} /></button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="pending-files">
          {pending.map(({ attachment: a }) => (
            <div key={a.id} className="pending-item">
              {a.kind === "image" ? <img src={a.url} alt={a.name} /> : a.kind === "video" ? <video src={a.url} muted /> : <span className="file-ext">{fileExt(a.name)}</span>}
              <small title={a.name}>{a.kind === "file" ? `${a.name} · ${fileSize(a.size)}` : fileSize(a.size)}</small>
              <button aria-label="Bỏ tệp" onClick={() => setPending(p => p.filter(x => x.attachment.id !== a.id))}><Icon name="close" size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="composer-input-row">
        <div className="composer-input">
          {mentionCandidates.length > 0 && (
            <div className="mention-pop">
              {mentionCandidates.map((u, i) => (
                <button key={u.id} className={i === mentionIndex ? "active" : ""} onMouseDown={e => { e.preventDefault(); insertMention(u); }}>
                  <Avatar user={u} size={28} /> {u.name}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            placeholder={`Nhập @, tin nhắn tới ${title}`}
            aria-label="Nội dung tin nhắn"
            onChange={e => { updateText(e.target.value); store.notifyTyping(cid); }}
            onKeyDown={onKeyDown}
            onPaste={e => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) { e.preventDefault(); addFiles(files); }
            }}
          />
          <button className={`tool emoji-tool ${panel === "emoji" ? "on" : ""}`} aria-label="Biểu tượng cảm xúc" title="Biểu tượng cảm xúc" onClick={() => setPanel(panel === "emoji" ? undefined : "emoji")}><Icon name="smile" /></button>
        </div>
        {hasContent
          ? <button className="send-btn" aria-label="Gửi" title="Gửi" onClick={() => void submit()}><Icon name="send" size={22} /></button>
          : <button className="send-btn like" aria-label="Gửi nhanh biểu tượng thích" title="Gửi nhanh 👍" onClick={() => void submit()}>👍</button>}
      </div>

      {panel && (
        <EmojiPanel
          mode={panel}
          onMode={setPanel}
          onEmoji={insertEmoji}
          onSticker={s => { store.send(cid, { kind: "sticker", sticker: s, replyTo: replyRef() }); onCancelReply(); setPanel(undefined); }}
          onClose={() => setPanel(undefined)}
        />
      )}
    </div>
  );
});

function EmojiPanel({ mode, onMode, onEmoji, onSticker, onClose }: { mode: "emoji" | "sticker"; onMode: (m: "emoji" | "sticker") => void; onEmoji: (e: string) => void; onSticker: (s: string) => void; onClose: () => void }) {
  const [group, setGroup] = useState(0);
  const groups = mode === "emoji" ? EMOJI_GROUPS : STICKER_PACKS;
  const active = groups[Math.min(group, groups.length - 1)];
  return (
    <div className="emoji-panel" role="dialog" aria-label={mode === "emoji" ? "Biểu tượng cảm xúc" : "Sticker"}>
      <div className="emoji-panel-tabs">
        <button className={mode === "sticker" ? "on" : ""} onClick={() => { onMode("sticker"); setGroup(0); }}>STICKER</button>
        <button className={mode === "emoji" ? "on" : ""} onClick={() => { onMode("emoji"); setGroup(0); }}>EMOJI</button>
        <button className="icon-btn" aria-label="Đóng" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      <div className="emoji-groups">
        {groups.map((g, i) => <button key={g.name} className={i === group ? "on" : ""} onClick={() => setGroup(i)}>{g.name}</button>)}
      </div>
      <div className={`emoji-grid ${mode}`}>
        {active.items.map(e => <button key={e} onClick={() => mode === "emoji" ? onEmoji(e) : onSticker(e)}>{e}</button>)}
      </div>
    </div>
  );
}
