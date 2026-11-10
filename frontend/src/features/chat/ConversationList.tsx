import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Conversation, Message, User } from "../../data/types";
import { ME_ID, store, useApp } from "../../data/store";
import { Avatar, ConversationAvatar, Menu, askConfirm, conversationTitle } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { clock, dayLabel, matches, shortAgo } from "../../lib/format";
import { messagePreview, visibleMessages } from "./messageUtils";
import { AddFriendModal } from "../contacts/AddFriendModal";
import { MemberPicker } from "./ChatModals";

export function ConversationList({ activeId }: { activeId?: string }) {
  const navigate = useNavigate();
  const users = useApp(s => s.db.users);
  const conversations = useApp(s => s.db.conversations);
  const messages = useApp(s => s.db.messages);
  const friendIds = useApp(s => s.db.friendIds);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [modal, setModal] = useState<"friend" | "group">();
  const [menuFor, setMenuFor] = useState<string>();
  const [, setTick] = useState(0);

  const sorted = useMemo(() => Object.values(conversations)
    .filter(c => !c.hidden && (c.type !== "group" || c.memberIds.includes(ME_ID)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt), [conversations]);
  const shown = tab === "unread" ? sorted.filter(c => c.unread > 0) : sorted;
  const unreadCount = sorted.filter(c => c.unread > 0).length;

  const open = (id: string) => { setSearching(false); setQuery(""); navigate(`/chat/${id}`); };

  return (
    <aside className="list-panel">
      <div className="list-header">
        <label className="search-field compact">
          <Icon name="search" size={17} />
          <input value={query} placeholder="Tìm kiếm" aria-label="Tìm kiếm"
            onFocus={() => setSearching(true)} onChange={e => { setQuery(e.target.value); setSearching(true); }} />
        </label>
        {searching
          ? <button className="text-btn" onClick={() => { setSearching(false); setQuery(""); }}>Đóng</button>
          : <>
            <button className="icon-btn" title="Thêm bạn" aria-label="Thêm bạn" onClick={() => setModal("friend")}><Icon name="userPlus" /></button>
            <button className="icon-btn" title="Tạo nhóm chat" aria-label="Tạo nhóm chat" onClick={() => setModal("group")}><Icon name="groupPlus" /></button>
          </>}
      </div>

      {searching ? (
        <SearchResults query={query} users={users} friendIds={friendIds} conversations={sorted} messages={messages} onOpenConversation={open}
          onOpenUser={id => open(store.ensureDirect(id))} />
      ) : (
        <>
          <div className="list-tabs">
            <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>Tất cả</button>
            <button className={tab === "unread" ? "on" : ""} onClick={() => setTab("unread")}>Chưa đọc{unreadCount > 0 && ` (${unreadCount})`}</button>
            <span className="spacer" />
            <div className="menu-anchor">
              <button className="text-btn small" onClick={() => setMenuFor(menuFor === "__list" ? undefined : "__list")}>Phân loại <Icon name="chevronDown" size={14} /></button>
              {menuFor === "__list" && <Menu onClose={() => setMenuFor(undefined)} items={[
                { label: "Đánh dấu tất cả đã đọc", icon: "checks", onClick: () => sorted.forEach(c => store.markRead(c.id)) },
              ]} />}
            </div>
          </div>
          <div className="conversation-list" role="list" onMouseEnter={() => setTick(t => t + 1)}>
            {shown.length === 0 && <p className="muted-text pad center">{tab === "unread" ? "Không có tin nhắn chưa đọc" : "Chưa có cuộc trò chuyện nào"}</p>}
            {shown.map(c => (
              <ConversationRow key={c.id} conversation={c} users={users} last={lastVisible(messages[c.id])} typing={false}
                active={c.id === activeId} menuOpen={menuFor === c.id}
                onOpen={() => open(c.id)} onMenu={() => setMenuFor(menuFor === c.id ? undefined : c.id)} onCloseMenu={() => setMenuFor(undefined)} />
            ))}
          </div>
        </>
      )}

      {modal === "friend" && <AddFriendModal onClose={() => setModal(undefined)} onOpenChat={id => { setModal(undefined); open(store.ensureDirect(id)); }} />}
      {modal === "group" && (
        <MemberPicker title="Tạo nhóm" confirmLabel="Tạo nhóm" minimum={2} withGroupName onClose={() => setModal(undefined)}
          onConfirm={async (ids, name, avatar) => { setModal(undefined); open(await store.createGroup(name, ids, avatar)); }} />
      )}
    </aside>
  );
}

function lastVisible(list: Message[] | undefined): Message | undefined {
  const v = visibleMessages(list);
  return v[v.length - 1];
}

function ConversationRow({ conversation: c, users, last, active, menuOpen, onOpen, onMenu, onCloseMenu }: {
  conversation: Conversation; users: Record<string, User>; last?: Message; typing: boolean; active: boolean; menuOpen: boolean;
  onOpen: () => void; onMenu: () => void; onCloseMenu: () => void;
}) {
  const typing = useApp(s => s.db.typing[c.id]);
  const title = conversationTitle(c, users);
  const mentioned = c.unread > 0 && last?.mentions?.includes(ME_ID);
  const preview = typing?.length ? `${users[typing[0]]?.name.split(" ").slice(-1)[0]} đang soạn tin…` : messagePreview(last, users, c.type === "group" || last?.senderId === ME_ID);
  return (
    <div role="listitem" className={`conv-row ${active ? "active" : ""} ${c.unread > 0 ? "unread" : ""}`} onClick={onOpen}>
      <ConversationAvatar conversation={c} size={48} />
      <div className="conv-main">
        <div className="conv-top">
          <strong>{title}</strong>
          <time>{last ? shortAgo(last.createdAt) : ""}</time>
        </div>
        <div className="conv-bottom">
          <span className={`conv-preview ${typing?.length ? "typing" : ""}`}>{mentioned && <b className="mention-tag">@</b>}{preview || "Bắt đầu trò chuyện"}</span>
          {c.muted && <Icon name="bellOff" size={14} className="conv-flag" />}
          {c.pinned && <Icon name="pin" size={14} className="conv-flag" />}
          {c.unread > 0 && <b className={`badge inline ${c.muted ? "muted" : ""}`}>{c.unread > 5 ? "5+" : c.unread}</b>}
        </div>
      </div>
      <div className="menu-anchor conv-more" onClick={e => e.stopPropagation()}>
        <button className="icon-btn small" aria-label="Tùy chọn hội thoại" onClick={onMenu}><Icon name="more" size={16} /></button>
        {menuOpen && <Menu onClose={onCloseMenu} items={[
          { label: c.pinned ? "Bỏ ghim hội thoại" : "Ghim hội thoại", icon: "pin", onClick: () => store.togglePin(c.id) },
          { label: c.unread > 0 ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc", icon: "checks", onClick: () => c.unread > 0 ? store.markRead(c.id) : store.markUnread(c.id) },
          { label: c.muted ? "Bật thông báo" : "Tắt thông báo", icon: c.muted ? "bell" : "bellOff", onClick: () => store.toggleMute(c.id) },
          ...(c.type !== "self" ? [{ label: "Xóa hội thoại", icon: "trash" as const, danger: true, onClick: async () => { if (await askConfirm(`Xóa toàn bộ nội dung trò chuyện với ${title}?`, "Xóa")) store.deleteConversation(c.id); } }] : []),
        ]} />}
      </div>
    </div>
  );
}

function SearchResults({ query, users, friendIds, conversations, messages, onOpenConversation, onOpenUser }: {
  query: string; users: Record<string, User>; friendIds: string[]; conversations: Conversation[]; messages: Record<string, Message[]>;
  onOpenConversation: (id: string) => void; onOpenUser: (id: string) => void;
}) {
  const q = query.trim();
  const people = useMemo(() => {
    if (!q) return conversations.filter(c => c.type === "direct").slice(0, 6).map(c => users[c.memberIds.find(id => id !== ME_ID) ?? ""]).filter(Boolean);
    const byPhone = store.searchUsers(q);
    const byName = friendIds.map(id => users[id]).filter(u => u && matches(u.name, q));
    return Array.from(new Map([...byName, ...byPhone].map(u => [u.id, u])).values()).slice(0, 8);
  }, [q, conversations, users, friendIds]);
  const groups = q ? conversations.filter(c => c.type === "group" && matches(c.name, q)) : [];
  const hits = useMemo(() => {
    if (q.length < 2) return [];
    return conversations.flatMap(c => visibleMessages(messages[c.id]).filter(m => !m.recalled && m.kind !== "system" && matches(m.text, q)).map(m => ({ c, m })))
      .sort((a, b) => b.m.createdAt - a.m.createdAt).slice(0, 20);
  }, [q, conversations, messages]);

  return (
    <div className="search-results">
      <div className="list-caption">{q ? "Liên hệ" : "Tìm gần đây"}</div>
      {people.length === 0 && <p className="muted-text pad">Không tìm thấy liên hệ. Thử nhập số điện thoại hoặc email đầy đủ.</p>}
      {people.map(u => (
        <button key={u.id} className="result-row" onClick={() => onOpenUser(u.id)}>
          <Avatar user={u} size={40} showStatus />
          <span><b>{u.name}</b>{!friendIds.includes(u.id) && <small>{u.phone ? `Số điện thoại: ${u.phone}` : "Người lạ"}</small>}</span>
        </button>
      ))}
      {groups.length > 0 && <div className="list-caption">Nhóm trò chuyện</div>}
      {groups.map(c => (
        <button key={c.id} className="result-row" onClick={() => onOpenConversation(c.id)}>
          <ConversationAvatar conversation={c} size={40} />
          <span><b>{c.name}</b><small>{c.memberIds.length} thành viên</small></span>
        </button>
      ))}
      {hits.length > 0 && <div className="list-caption">Tin nhắn ({hits.length})</div>}
      {hits.map(({ c, m }) => (
        <button key={m.id} className="result-row" onClick={() => { onOpenConversation(c.id); setTimeout(() => window.dispatchEvent(new CustomEvent("zalolite:jump", { detail: m.id })), 120); }}>
          <ConversationAvatar conversation={c} size={40} />
          <span><b>{conversationTitle(c, users)}</b><small>{users[m.senderId]?.name}: {m.text}</small></span>
          <time>{dayLabel(m.createdAt) === "Hôm nay" ? clock(m.createdAt) : dayLabel(m.createdAt)}</time>
        </button>
      ))}
    </div>
  );
}
