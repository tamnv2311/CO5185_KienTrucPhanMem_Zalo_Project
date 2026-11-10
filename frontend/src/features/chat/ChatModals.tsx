import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, Message, User } from "../../data/types";
import { ME_ID, store, useApp } from "../../data/store";
import { Avatar, ConversationAvatar, Modal, conversationTitle } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { duration, matches, uid } from "../../lib/format";
import { messagePreview } from "./messageUtils";

/** Choose people from friends (used to create a group or add members). */
export function MemberPicker({ title, confirmLabel, exclude = [], minimum = 1, withGroupName = false, onConfirm, onClose }: {
  title: string; confirmLabel: string; exclude?: string[]; minimum?: number; withGroupName?: boolean;
  onConfirm: (ids: string[], name: string, avatar?: string) => void; onClose: () => void;
}) {
  const users = useApp(s => s.db.users);
  const friendIds = useApp(s => s.db.friendIds);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const candidates = friendIds.filter(id => !exclude.includes(id)).map(id => users[id]).filter(u => u && matches(u.name + " " + (u.phone ?? ""), query))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const valid = picked.length >= minimum && (!withGroupName || name.trim().length > 0);

  return (
    <Modal title={title} onClose={onClose} width={520} className="picker-modal" footer={<>
      <button className="btn ghost" onClick={onClose}>Hủy</button>
      <button className="btn primary" disabled={!valid} onClick={() => onConfirm(picked, name.trim(), avatar)}>{confirmLabel}</button>
    </>}>
      {withGroupName && (
        <div className="group-name-row">
          <button className="avatar-upload" onClick={() => fileRef.current?.click()} aria-label="Chọn ảnh nhóm">
            {avatar ? <img src={avatar} alt="" /> : <Icon name="camera" size={22} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => readImage(e.target.files?.[0], setAvatar)} />
          <input className="underline-input" placeholder="Nhập tên nhóm…" value={name} onChange={e => setName(e.target.value)} autoFocus aria-label="Tên nhóm" />
        </div>
      )}
      <label className="search-field"><Icon name="search" size={18} /><input placeholder="Nhập tên, số điện thoại" value={query} onChange={e => setQuery(e.target.value)} aria-label="Tìm bạn bè" /></label>
      {picked.length > 0 && (
        <div className="picked-chips">
          {picked.map(id => <button key={id} className="chip" onClick={() => toggle(id)}><Avatar user={users[id]} size={22} />{users[id]?.name}<Icon name="close" size={12} /></button>)}
        </div>
      )}
      <div className="picker-list">
        <div className="list-caption">Bạn bè</div>
        {candidates.length === 0 && <p className="muted-text pad">Không tìm thấy bạn bè phù hợp</p>}
        {candidates.map(u => (
          <label key={u.id} className="picker-row">
            <input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />
            <Avatar user={u} size={40} />
            <span>{u.name}</span>
          </label>
        ))}
      </div>
      {minimum > 1 && <p className="hint">Chọn ít nhất {minimum} người để tạo nhóm.</p>}
    </Modal>
  );
}

export function readImage(file: File | undefined, done: (url: string) => void) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { store.toast("Vui lòng chọn tệp hình ảnh", "error"); return; }
  const reader = new FileReader();
  reader.onload = () => done(String(reader.result));
  reader.readAsDataURL(file);
}

export function ForwardModal({ message, onClose }: { message: Message; onClose: () => void }) {
  const users = useApp(s => s.db.users);
  const conversations = useApp(s => s.db.conversations);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const list = useMemo(() => Object.values(conversations).filter(c => !c.hidden && matches(conversationTitle(c, users), query))
    .sort((a, b) => b.updatedAt - a.updatedAt), [conversations, users, query]);
  return (
    <Modal title="Chia sẻ" onClose={onClose} width={500} footer={<>
      <button className="btn ghost" onClick={onClose}>Hủy</button>
      <button className="btn primary" disabled={!picked.length} onClick={() => { store.forward(message.conversationId, message.id, picked); onClose(); }}>Chia sẻ</button>
    </>}>
      <label className="search-field"><Icon name="search" size={18} /><input placeholder="Tìm kiếm hội thoại" value={query} onChange={e => setQuery(e.target.value)} autoFocus aria-label="Tìm hội thoại" /></label>
      <div className="picker-list">
        <div className="list-caption">Trò chuyện gần đây</div>
        {list.map(c => (
          <label key={c.id} className="picker-row">
            <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])} />
            <ConversationAvatar conversation={c} size={40} />
            <span>{conversationTitle(c, users)}</span>
          </label>
        ))}
      </div>
      <div className="forward-preview"><small>Nội dung chia sẻ</small><p>{messagePreview(message, users)}</p></div>
    </Modal>
  );
}

export function PollModal({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const valid = question.trim() && options.filter(o => o.trim()).length >= 2;
  return (
    <Modal title="Tạo bình chọn" onClose={onClose} width={460} footer={<>
      <button className="btn ghost" onClick={onClose}>Hủy</button>
      <button className="btn primary" disabled={!valid} onClick={() => {
        store.send(conversationId, { kind: "poll", poll: { question: question.trim(), multiple, options: options.filter(o => o.trim()).map(text => ({ id: uid("o"), text: text.trim(), voterIds: [] })) } });
        onClose();
      }}>Tạo bình chọn</button>
    </>}>
      <label className="field"><span>Chủ đề bình chọn</span><textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Đặt câu hỏi bình chọn" maxLength={200} autoFocus /></label>
      <div className="field"><span>Các lựa chọn</span>
        {options.map((o, i) => (
          <div key={i} className="poll-input">
            <input value={o} placeholder={`Lựa chọn ${i + 1}`} onChange={e => setOptions(list => list.map((x, j) => j === i ? e.target.value : x))} aria-label={`Lựa chọn ${i + 1}`} />
            {options.length > 2 && <button className="icon-btn" aria-label="Xóa lựa chọn" onClick={() => setOptions(list => list.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button>}
          </div>
        ))}
        {options.length < 10 && <button className="link-btn" onClick={() => setOptions(list => [...list, ""])}><Icon name="plus" size={16} /> Thêm lựa chọn</button>}
      </div>
      <label className="check-row"><input type="checkbox" checked={multiple} onChange={e => setMultiple(e.target.checked)} /> Cho phép chọn nhiều phương án</label>
    </Modal>
  );
}

export function ImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="viewer" onClick={onClose} role="dialog" aria-label="Xem ảnh">
      <img src={url} alt="" onClick={e => e.stopPropagation()} />
      <div className="viewer-actions" onClick={e => e.stopPropagation()}>
        <a className="icon-btn light" href={url} download="zalolite-image" aria-label="Tải ảnh"><Icon name="download" /></a>
        <button className="icon-btn light" onClick={onClose} aria-label="Đóng"><Icon name="close" /></button>
      </div>
    </div>
  );
}

/** Call screen. Media is captured locally (camera preview); signalling is out of scope for the course demo. */
export function CallModal({ conversation, video, onClose }: { conversation: Conversation; video: boolean; onClose: () => void }) {
  const users = useApp(s => s.db.users);
  const [phase, setPhase] = useState<"ringing" | "connected">("ringing");
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(video);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream>();
  const title = conversationTitle(conversation, users);
  const other: User | undefined = conversation.type === "direct" ? users[conversation.memberIds.find(id => id !== ME_ID) ?? ""] : undefined;
  const reachable = conversation.type === "group" || other?.online;

  useEffect(() => {
    let cancelled = false;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true, video }).then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      }).catch(() => undefined);
    }
    const answer = setTimeout(() => {
      if (reachable) setPhase("connected"); else finish(true);
    }, reachable ? 2500 : 9000);
    return () => { cancelled = true; clearTimeout(answer); streamRef.current?.getTracks().forEach(t => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "connected") return;
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = micOn; }); }, [micOn]);
  useEffect(() => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOn; }); }, [camOn]);

  function finish(missed = false) {
    store.logCall(conversation.id, { video, durationSec: seconds, missed: missed || phase === "ringing" });
    onClose();
  }

  return (
    <div className="call-screen" role="dialog" aria-label="Cuộc gọi">
      <div className="call-peer">
        <ConversationAvatar conversation={conversation} size={112} />
        <h2>{title}</h2>
        <p>{phase === "ringing" ? (reachable ? "Đang đổ chuông…" : "Đang gọi…") : duration(seconds)}</p>
      </div>
      {video && <video ref={videoRef} className={`self-view ${camOn ? "" : "off"}`} autoPlay muted playsInline />}
      <div className="call-controls">
        <button className={`round ${micOn ? "" : "off"}`} onClick={() => setMicOn(v => !v)} aria-label={micOn ? "Tắt micro" : "Bật micro"}><Icon name={micOn ? "mic" : "micOff"} /></button>
        {video && <button className={`round ${camOn ? "" : "off"}`} onClick={() => setCamOn(v => !v)} aria-label={camOn ? "Tắt camera" : "Bật camera"}><Icon name={camOn ? "video" : "videoOff"} /></button>}
        <button className="round hangup" onClick={() => finish()} aria-label="Kết thúc cuộc gọi"><Icon name="phoneOff" /></button>
      </div>
    </div>
  );
}
