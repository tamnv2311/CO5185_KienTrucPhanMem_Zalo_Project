import { DragEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Conversation, Message } from "../../data/types";
import { ME_ID, store, useApp } from "../../data/store";
import { ConversationAvatar, conversationTitle } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { dayLabel, lastSeenText, matches, sameDay } from "../../lib/format";
import { MessageItem } from "./MessageItem";
import { Composer, ComposerHandle } from "./Composer";
import { CallModal, ForwardModal, ImageViewer, MemberPicker, PollModal } from "./ChatModals";
import { InfoPanel } from "./InfoPanel";
import { messagePreview, visibleMessages } from "./messageUtils";
import { useChatSocket } from "./useChatSocket";
import { openProfile } from "../../app/AppShell";

const CLUSTER_GAP = 5 * 60_000;

export function ChatWindow({ conversation }: { conversation: Conversation }) {
  const navigate = useNavigate();
  const cid = conversation.id;
  const users = useApp(s => s.db.users);
  const rawMessages = useApp(s => s.db.messages[cid]);
  const typing = useApp(s => s.db.typing[cid]);
  const readReceipts = useApp(s => s.db.settings.readReceipts);
  const messages = useMemo(() => visibleMessages(rawMessages), [rawMessages]);
  const [infoOpen, setInfoOpen] = useState(() => window.innerWidth > 1180);
  const [replyTo, setReplyTo] = useState<Message>();
  const [forwarding, setForwarding] = useState<Message>();
  const [viewer, setViewer] = useState<string>();
  const [modal, setModal] = useState<"poll" | "add" | "voice" | "video">();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hitIndex, setHitIndex] = useState(0);
  const [focusId, setFocusId] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [pinsExpanded, setPinsExpanded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const title = conversationTitle(conversation, users);
  const other = conversation.type === "direct" ? users[conversation.memberIds.find(id => id !== ME_ID) ?? ""] : undefined;

  useEffect(() => {
    store.setActive(cid);
    void store.loadRemoteHistory(cid);
    setReplyTo(undefined); setSearchOpen(false); setSearch(""); setPinsExpanded(false);
    composer.current?.focus();
    return () => store.setActive(undefined);
  }, [cid]);

  useEffect(() => { if (messages.length) store.markRead(cid); }, [messages.length, cid]);

  useChatSocket(conversation.remoteId, cid);

  // Keep the view pinned to the bottom when new messages arrive.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typing?.length, cid]);

  // Images/videos load after first paint – keep following the bottom while content grows.
  const atBottomRef = useRef(true);
  atBottomRef.current = atBottom;
  useEffect(() => {
    const el = scroller.current;
    const list = el?.firstElementChild;
    if (!el || !list || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (atBottomRef.current) el.scrollTop = el.scrollHeight; });
    ro.observe(list);
    return () => ro.disconnect();
  }, [cid]);

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) { store.toast("Không tìm thấy tin nhắn gốc"); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFocusId(id);
    setTimeout(() => setFocusId(f => (f === id ? undefined : f)), 1800);
  }, []);

  useEffect(() => {
    const onJump = (e: Event) => jumpTo((e as CustomEvent<string>).detail);
    window.addEventListener("zalolite:jump", onJump);
    return () => window.removeEventListener("zalolite:jump", onJump);
  }, [jumpTo]);

  const hits = useMemo(() => search.trim() ? messages.filter(m => !m.recalled && matches(m.text, search)).map(m => m.id) : [], [messages, search]);
  useEffect(() => { setHitIndex(hits.length ? hits.length - 1 : 0); }, [hits.length, search]);
  useEffect(() => { if (hits[hitIndex]) jumpTo(hits[hitIndex]); }, [hitIndex, hits, jumpTo]);

  const lastMine = [...messages].reverse().find(m => m.senderId === ME_ID && m.kind !== "system");
  const pinned = conversation.pinnedMessageIds.map(id => messages.find(m => m.id === id)).filter((m): m is Message => !!m);

  const subtitle = conversation.type === "group"
    ? `${conversation.memberIds.length} thành viên`
    : conversation.type === "self" ? "Lưu trữ tin nhắn, tệp và ghi chú của bạn" : lastSeenText(!!other?.online, other?.lastSeen);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) composer.current?.addFiles(e.dataTransfer.files);
  }

  return (
    <div className="chat-area">
      <section className="chat-window" onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={onDrop}>
        <header className="chat-header">
          <button className="icon-btn back-btn" aria-label="Quay lại" onClick={() => navigate("/chat")}><Icon name="arrowLeft" /></button>
          <button className="chat-header-avatar" onClick={() => other ? openProfile(other.id) : setInfoOpen(true)} aria-label="Thông tin">
            <ConversationAvatar conversation={conversation} size={46} />
          </button>
          <div className="chat-title">
            <h2>{title}</h2>
            <p>{conversation.type === "group" ? <><Icon name="users" size={14} /> {subtitle}</> : <>{other?.online && <i className="online-dot" />}{subtitle}</>}</p>
          </div>
          <div className="chat-header-actions">
            {conversation.type === "group" && <button className="icon-btn" title="Thêm thành viên" aria-label="Thêm thành viên" onClick={() => setModal("add")}><Icon name="groupPlus" /></button>}
            <button className={`icon-btn ${searchOpen ? "on" : ""}`} title="Tìm kiếm tin nhắn" aria-label="Tìm kiếm tin nhắn" onClick={() => setSearchOpen(v => !v)}><Icon name="search" /></button>
            {conversation.type !== "self" && <>
              <button className="icon-btn" title="Cuộc gọi thoại" aria-label="Cuộc gọi thoại" onClick={() => setModal("voice")}><Icon name="phone" /></button>
              <button className="icon-btn" title="Cuộc gọi video" aria-label="Cuộc gọi video" onClick={() => setModal("video")}><Icon name="video" /></button>
            </>}
            <button className={`icon-btn ${infoOpen ? "on" : ""}`} title="Thông tin hội thoại" aria-label="Thông tin hội thoại" onClick={() => setInfoOpen(v => !v)}><Icon name="sidebar" /></button>
          </div>
        </header>

        {searchOpen && (
          <div className="chat-search">
            <label className="search-field compact"><Icon name="search" size={16} /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tin nhắn trong hội thoại" aria-label="Tìm tin nhắn trong hội thoại"
              onKeyDown={e => { if (e.key === "Enter" && hits.length) setHitIndex(i => (i - 1 + hits.length) % hits.length); if (e.key === "Escape") setSearchOpen(false); }} /></label>
            <span className="hit-count">{search.trim() ? (hits.length ? `${hitIndex + 1}/${hits.length}` : "0 kết quả") : ""}</span>
            <button className="icon-btn small" aria-label="Kết quả trước" disabled={!hits.length} onClick={() => setHitIndex(i => (i - 1 + hits.length) % hits.length)}><Icon name="chevronUp" size={16} /></button>
            <button className="icon-btn small" aria-label="Kết quả sau" disabled={!hits.length} onClick={() => setHitIndex(i => (i + 1) % hits.length)}><Icon name="chevronDown" size={16} /></button>
            <button className="text-btn small" onClick={() => { setSearchOpen(false); setSearch(""); }}>Đóng</button>
          </div>
        )}

        {pinned.length > 0 && (
          <div className={`pin-bar ${pinsExpanded ? "expanded" : ""}`}>
            {(pinsExpanded ? pinned : pinned.slice(0, 1)).map(p => (
              <div key={p.id} className="pin-item">
                <Icon name="pin" size={16} />
                <button className="pin-text" onClick={() => jumpTo(p.id)}>
                  <b>Tin nhắn</b><span>{users[p.senderId]?.name}: {messagePreview(p, users)}</span>
                </button>
                <button className="icon-btn small" aria-label="Bỏ ghim" title="Bỏ ghim" onClick={() => store.unpinMessage(cid, p.id)}><Icon name="close" size={14} /></button>
              </div>
            ))}
            {pinned.length > 1 && <button className="text-btn small" onClick={() => setPinsExpanded(v => !v)}>{pinsExpanded ? "Thu gọn" : `+${pinned.length - 1} ghim`}</button>}
          </div>
        )}

        <div className="message-scroll" ref={scroller} onScroll={e => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}>
          <div className="message-list">
            {messages.length === 0 && (
              <div className="chat-empty">
                <ConversationAvatar conversation={conversation} size={84} />
                <h3>{title}</h3>
                <p>{conversation.type === "self" ? "Gửi tin nhắn, ảnh, tệp cho chính mình để lưu trữ và đồng bộ." : "Hãy gửi lời chào để bắt đầu cuộc trò chuyện 👋"}</p>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const first = newDay || !prev || prev.senderId !== m.senderId || prev.kind === "system" || m.createdAt - prev.createdAt > CLUSTER_GAP;
              const last = !next || next.senderId !== m.senderId || next.kind === "system" || next.createdAt - m.createdAt > CLUSTER_GAP || !sameDay(next.createdAt, m.createdAt);
              return (
                <div key={m.id}>
                  {newDay && <div className="day-divider"><span>{dayLabel(m.createdAt)}</span></div>}
                  <MessageItem message={m} conversation={conversation} users={users} firstOfCluster={first} lastOfCluster={last}
                    showStatus={m.id === lastMine?.id && (readReceipts || m.status !== "seen") && conversation.type !== "self"}
                    highlight={searchOpen ? search : undefined} focused={focusId === m.id}
                    onReply={msg => { setReplyTo(msg); composer.current?.focus(); }} onForward={setForwarding} onOpenImage={setViewer} onJumpTo={jumpTo} />
                </div>
              );
            })}
            {typing && typing.length > 0 && (
              <div className="typing-row">
                <span className="typing-dots"><i /><i /><i /></span>
                {typing.map(id => users[id]?.name.split(" ").slice(-1)[0]).join(", ")} đang soạn tin…
              </div>
            )}
          </div>
        </div>
        {!atBottom && (
          <button className="jump-bottom" aria-label="Tin nhắn mới nhất" onClick={() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }}>
            <Icon name="chevronDown" />
          </button>
        )}

        <Composer ref={composer} conversation={conversation} users={users} title={title} replyTo={replyTo}
          onCancelReply={() => setReplyTo(undefined)} onCreatePoll={() => setModal("poll")} />

        {dragging && <div className="drop-overlay"><Icon name="attach" size={40} /><p>Thả tệp vào đây để gửi tới {title}</p></div>}
      </section>

      {infoOpen && <InfoPanel conversation={conversation} onClose={() => setInfoOpen(false)} onOpenImage={setViewer} onAddMembers={() => setModal("add")} onJump={jumpTo} onSearch={() => setSearchOpen(true)} />}

      {forwarding && <ForwardModal message={forwarding} onClose={() => setForwarding(undefined)} />}
      {viewer && <ImageViewer url={viewer} onClose={() => setViewer(undefined)} />}
      {modal === "poll" && <PollModal conversationId={cid} onClose={() => setModal(undefined)} />}
      {modal === "add" && <MemberPicker title="Thêm thành viên" confirmLabel="Xác nhận" exclude={conversation.memberIds} onClose={() => setModal(undefined)}
        onConfirm={ids => { store.addMembers(cid, ids); setModal(undefined); }} />}
      {(modal === "voice" || modal === "video") && <CallModal conversation={conversation} video={modal === "video"} onClose={() => setModal(undefined)} />}
    </div>
  );
}
