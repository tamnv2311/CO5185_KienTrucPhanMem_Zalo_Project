import { useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { ME_ID, store, useApp } from "../../data/store";
import { Avatar, ConversationAvatar, Empty, Menu, askConfirm } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { dayLabel, firstLetter, matches } from "../../lib/format";
import { AddFriendModal } from "./AddFriendModal";
import { MemberPicker } from "../chat/ChatModals";
import { openProfile } from "../../app/AppShell";

type Tab = "friends" | "groups" | "requests";

export function ContactsPage() {
  const { tab: routeTab } = useParams<{ tab: Tab }>();
  const tab: Tab = routeTab ?? "friends";
  const navigate = useNavigate();
  const requests = useApp(s => s.db.requests);
  const [modal, setModal] = useState<"friend" | "group">();
  const incoming = requests.filter(r => r.toId === ME_ID).length;

  return (
    <div className={`contacts-page tab-${routeTab ?? "none"}`}>
      <aside className="list-panel contacts-nav">
        <div className="list-header">
          <h1 className="panel-title">Danh bạ</h1>
          <button className="icon-btn" title="Thêm bạn" aria-label="Thêm bạn" onClick={() => setModal("friend")}><Icon name="userPlus" /></button>
          <button className="icon-btn" title="Tạo nhóm" aria-label="Tạo nhóm" onClick={() => setModal("group")}><Icon name="groupPlus" /></button>
        </div>
        <NavLink to="/contacts/friends" className="contacts-link"><Icon name="user" /> Danh sách bạn bè</NavLink>
        <NavLink to="/contacts/groups" className="contacts-link"><Icon name="users" /> Danh sách nhóm và cộng đồng</NavLink>
        <NavLink to="/contacts/requests" className="contacts-link"><Icon name="userPlus" /> Lời mời kết bạn {incoming > 0 && <b className="badge inline">{incoming}</b>}</NavLink>
      </aside>
      <section className="contacts-main">
        {tab === "friends" && <FriendsList />}
        {tab === "groups" && <GroupsList onCreate={() => setModal("group")} />}
        {tab === "requests" && <RequestsList />}
      </section>
      {modal === "friend" && <AddFriendModal onClose={() => setModal(undefined)} onOpenChat={id => navigate(`/chat/${store.ensureDirect(id)}`)} />}
      {modal === "group" && <MemberPicker title="Tạo nhóm" confirmLabel="Tạo nhóm" minimum={2} withGroupName onClose={() => setModal(undefined)}
        onConfirm={async (ids, name, avatar) => { setModal(undefined); navigate(`/chat/${await store.createGroup(name, ids, avatar)}`); }} />}
    </div>
  );
}

function PageHeader({ icon, title }: { icon: Parameters<typeof Icon>[0]["name"]; title: string }) {
  const navigate = useNavigate();
  return (
    <header className="contacts-header">
      <button className="icon-btn back-btn" aria-label="Quay lại" onClick={() => navigate("/contacts")}><Icon name="arrowLeft" /></button>
      <Icon name={icon} /> <h2>{title}</h2>
    </header>
  );
}

function FriendsList() {
  const navigate = useNavigate();
  const users = useApp(s => s.db.users);
  const friendIds = useApp(s => s.db.friendIds);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "za">("az");
  const [filter, setFilter] = useState<"all" | "online">("all");
  const [menu, setMenu] = useState<string>();

  const groups = useMemo(() => {
    const list = friendIds.map(id => users[id]).filter(u => u && matches(u.name, query) && (filter === "all" || u.online))
      .sort((a, b) => a.name.split(" ").slice(-1)[0].localeCompare(b.name.split(" ").slice(-1)[0], "vi") * (sort === "az" ? 1 : -1));
    const map = new Map<string, typeof list>();
    list.forEach(u => { const k = firstLetter(u.name.split(" ").slice(-1)[0]); map.set(k, [...(map.get(k) ?? []), u]); });
    return Array.from(map.entries());
  }, [friendIds, users, query, sort, filter]);

  return (
    <>
      <PageHeader icon="user" title="Danh sách bạn bè" />
      <div className="contacts-body">
        <p className="count-line">Bạn bè ({friendIds.length})</p>
        <div className="card">
          <div className="filter-bar">
            <label className="search-field compact"><Icon name="search" size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm bạn" aria-label="Tìm bạn" /></label>
            <select value={sort} onChange={e => setSort(e.target.value as "az" | "za")} aria-label="Sắp xếp"><option value="az">Tên (A-Z)</option><option value="za">Tên (Z-A)</option></select>
            <select value={filter} onChange={e => setFilter(e.target.value as "all" | "online")} aria-label="Lọc"><option value="all">Tất cả</option><option value="online">Đang hoạt động</option></select>
          </div>
          {groups.length === 0 && <Empty icon="user" title="Không có bạn bè phù hợp" text="Hãy thêm bạn bằng số điện thoại hoặc email." />}
          {groups.map(([letter, list]) => (
            <div key={letter}>
              <div className="letter">{letter}</div>
              {list.map(u => (
                <div key={u.id} className="contact-row" onClick={() => navigate(`/chat/${store.ensureDirect(u.id)}`)}>
                  <Avatar user={u} size={48} showStatus />
                  <span className="contact-name">{u.name}</span>
                  <div className="menu-anchor" onClick={e => e.stopPropagation()}>
                    <button className="icon-btn small" aria-label={`Tùy chọn ${u.name}`} onClick={() => setMenu(menu === u.id ? undefined : u.id)}><Icon name="more" size={16} /></button>
                    {menu === u.id && <Menu onClose={() => setMenu(undefined)} items={[
                      { label: "Xem thông tin", icon: "user", onClick: () => openProfile(u.id) },
                      { label: "Nhắn tin", icon: "chat", onClick: () => navigate(`/chat/${store.ensureDirect(u.id)}`) },
                      { label: "Xóa bạn", icon: "trash", danger: true, onClick: async () => { if (await askConfirm(`Xóa ${u.name} khỏi danh sách bạn bè?`, "Xóa bạn")) store.unfriend(u.id); } },
                    ]} />}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function GroupsList({ onCreate }: { onCreate: () => void }) {
  const navigate = useNavigate();
  const conversations = useApp(s => s.db.conversations);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "az">("recent");
  const groups = useMemo(() => Object.values(conversations)
    .filter(c => c.type === "group" && c.memberIds.includes(ME_ID) && matches(c.name, query))
    .sort((a, b) => sort === "az" ? (a.name ?? "").localeCompare(b.name ?? "", "vi") : b.updatedAt - a.updatedAt), [conversations, query, sort]);
  return (
    <>
      <PageHeader icon="users" title="Danh sách nhóm và cộng đồng" />
      <div className="contacts-body">
        <p className="count-line">Nhóm và cộng đồng ({groups.length})</p>
        <div className="card">
          <div className="filter-bar">
            <label className="search-field compact"><Icon name="search" size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm nhóm" aria-label="Tìm nhóm" /></label>
            <select value={sort} onChange={e => setSort(e.target.value as "recent" | "az")} aria-label="Sắp xếp nhóm"><option value="recent">Hoạt động (mới → cũ)</option><option value="az">Tên (A-Z)</option></select>
          </div>
          {groups.length === 0 && <Empty icon="users" title="Chưa có nhóm nào" text="Tạo nhóm để trò chuyện cùng bạn bè, đồng nghiệp."><button className="btn primary" onClick={onCreate}>Tạo nhóm</button></Empty>}
          {groups.map(c => (
            <div key={c.id} className="contact-row" onClick={() => navigate(`/chat/${c.id}`)}>
              <ConversationAvatar conversation={c} size={48} />
              <span className="contact-name"><b>{c.name}</b><small>{c.memberIds.length} thành viên{c.roles[ME_ID] === "owner" ? " · Trưởng nhóm" : c.roles[ME_ID] === "deputy" ? " · Phó nhóm" : ""}</small></span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function RequestsList() {
  const navigate = useNavigate();
  const users = useApp(s => s.db.users);
  const requests = useApp(s => s.db.requests);
  const incoming = requests.filter(r => r.toId === ME_ID);
  const sent = requests.filter(r => r.fromId === ME_ID);
  return (
    <>
      <PageHeader icon="userPlus" title="Lời mời kết bạn" />
      <div className="contacts-body">
        <p className="count-line">Lời mời đã nhận ({incoming.length})</p>
        {incoming.length === 0 && <div className="card"><Empty icon="mail" title="Bạn không có lời mời nào" /></div>}
        <div className="request-grid">
          {incoming.map(r => {
            const u = users[r.fromId];
            return (
              <div key={r.id} className="card request-card">
                <div className="request-top">
                  <button className="plain" onClick={() => openProfile(u.id)}><Avatar user={u} size={48} /></button>
                  <div><b>{u?.name}</b><small>{dayLabel(r.createdAt)} · Từ tìm kiếm</small></div>
                  <button className="icon-btn small" aria-label="Nhắn tin" onClick={() => navigate(`/chat/${store.ensureDirect(u.id)}`)}><Icon name="chat" size={18} /></button>
                </div>
                <p className="request-msg">{r.message}</p>
                <div className="request-actions">
                  <button className="btn soft" onClick={() => store.declineRequest(r.id)}>Từ chối</button>
                  <button className="btn primary" onClick={() => store.acceptRequest(r.id)}>Đồng ý</button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="count-line">Lời mời đã gửi ({sent.length})</p>
        <div className="request-grid">
          {sent.map(r => {
            const u = users[r.toId];
            return (
              <div key={r.id} className="card request-card">
                <div className="request-top">
                  <Avatar user={u} size={48} />
                  <div><b>{u?.name}</b><small>Bạn đã gửi lời mời · {dayLabel(r.createdAt)}</small></div>
                </div>
                <div className="request-actions"><button className="btn soft block" onClick={() => store.declineRequest(r.id)}>Thu hồi lời mời</button></div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
