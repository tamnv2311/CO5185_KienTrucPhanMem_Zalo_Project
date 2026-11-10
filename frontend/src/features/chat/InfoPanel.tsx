import { ReactNode, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Conversation, Role } from "../../data/types";
import { ME_ID, store, useApp } from "../../data/store";
import { Avatar, ConversationAvatar, Menu, askConfirm, conversationTitle } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { clock, dayLabel, extractLinks, fileExt, fileSize } from "../../lib/format";
import { visibleMessages } from "./messageUtils";
import { openProfile } from "../../app/AppShell";
import { MemberPicker, readImage } from "./ChatModals";

const ROLE_LABEL: Record<Role, string> = { owner: "Trưởng nhóm", deputy: "Phó nhóm", member: "" };

export function InfoPanel({ conversation: c, onClose, onOpenImage, onAddMembers, onJump, onSearch }: {
  conversation: Conversation; onClose: () => void; onOpenImage: (url: string) => void; onAddMembers: () => void; onJump: (id: string) => void; onSearch: () => void;
}) {
  const navigate = useNavigate();
  const users = useApp(s => s.db.users);
  const raw = useApp(s => s.db.messages[c.id]);
  const messages = useMemo(() => visibleMessages(raw).filter(m => !m.recalled), [raw]);
  const [view, setView] = useState<"main" | "media" | "files" | "links" | "members">("main");
  const [memberMenu, setMemberMenu] = useState<string>();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(c.name ?? "");
  const [creating, setCreating] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const myRole = c.roles[ME_ID];
  const isAdmin = myRole === "owner" || myRole === "deputy";
  const other = c.type === "direct" ? c.memberIds.find(id => id !== ME_ID) : undefined;

  const media = messages.flatMap(m => (m.kind === "image" || m.kind === "video") ? (m.attachments ?? []).map(a => ({ a, m })) : []).reverse();
  const files = messages.flatMap(m => m.kind === "file" ? (m.attachments ?? []).map(a => ({ a, m })) : []).reverse();
  const links = messages.flatMap(m => extractLinks(m.text).map(url => ({ url, m }))).reverse();

  if (view !== "main") {
    const titles = { media: "Ảnh/Video", files: "File", links: "Link", members: "Thành viên" };
    return (
      <aside className="info-panel">
        <header className="info-header">
          <button className="icon-btn" aria-label="Quay lại" onClick={() => setView("main")}><Icon name="arrowLeft" /></button>
          <h3>{titles[view]}</h3>
        </header>
        <div className="info-scroll">
          {view === "media" && <div className="media-grid big">{media.map(({ a, m }) => <MediaThumb key={a.id} url={a.url} kind={a.kind} onClick={() => a.kind === "image" ? onOpenImage(a.url) : onJump(m.id)} />)}</div>}
          {view === "files" && files.map(({ a, m }) => <FileRow key={a.id} name={a.name} size={a.size} when={m.createdAt} onClick={() => onJump(m.id)} />)}
          {view === "links" && links.map(({ url, m }, i) => <LinkRow key={i} url={url} when={m.createdAt} />)}
          {view === "members" && (
            <>
              {isAdmin && <button className="btn ghost block" onClick={onAddMembers}><Icon name="groupPlus" size={18} /> Thêm thành viên</button>}
              <div className="list-caption">Danh sách thành viên ({c.memberIds.length})</div>
              {[...c.memberIds].sort((a, b) => rank(c.roles[a]) - rank(c.roles[b])).map(id => {
                const u = users[id];
                const role = c.roles[id] ?? "member";
                return (
                  <div key={id} className="member-row">
                    <button className="member-main" onClick={() => openProfile(id)}>
                      <Avatar user={u} size={40} showStatus />
                      <span><b>{id === ME_ID ? "Bạn" : u?.name}</b>{role !== "member" && <small className={`role-tag ${role}`}>{role === "owner" && <Icon name="crown" size={12} />} {ROLE_LABEL[role]}</small>}</span>
                    </button>
                    {id !== ME_ID && (
                      <div className="menu-anchor">
                        <button className="icon-btn small" aria-label="Tùy chọn thành viên" onClick={() => setMemberMenu(memberMenu === id ? undefined : id)}><Icon name="more" size={16} /></button>
                        {memberMenu === id && <Menu onClose={() => setMemberMenu(undefined)} items={[
                          { label: "Nhắn tin", icon: "chat", onClick: () => navigate(`/chat/${store.ensureDirect(id)}`) },
                          ...(myRole === "owner" && role !== "deputy" ? [{ label: "Bổ nhiệm phó nhóm", icon: "shield" as const, onClick: () => store.setRole(c.id, id, "deputy") }] : []),
                          ...(myRole === "owner" && role === "deputy" ? [{ label: "Xóa quyền phó nhóm", icon: "shield" as const, onClick: () => store.setRole(c.id, id, "member") }] : []),
                          ...(myRole === "owner" ? [{ label: "Chuyển quyền trưởng nhóm", icon: "crown" as const, onClick: async () => { if (await askConfirm(`Chuyển quyền trưởng nhóm cho ${u?.name}? Bạn sẽ trở thành phó nhóm.`, "Chuyển quyền", false)) store.setRole(c.id, id, "owner"); } }] : []),
                          ...(isAdmin && role === "member" || myRole === "owner" ? [{ label: "Xóa khỏi nhóm", icon: "trash" as const, danger: true, onClick: async () => { if (await askConfirm(`Xóa ${u?.name} khỏi nhóm?`, "Xóa")) store.removeMember(c.id, id); } }] : []),
                        ]} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {((view === "media" && !media.length) || (view === "files" && !files.length) || (view === "links" && !links.length)) && <p className="muted-text pad center">Chưa có nội dung được chia sẻ</p>}
        </div>
      </aside>
    );
  }

  return (
    <aside className="info-panel">
      <header className="info-header">
        <h3>{c.type === "group" ? "Thông tin nhóm" : "Thông tin hội thoại"}</h3>
        <button className="icon-btn info-close" aria-label="Đóng thông tin" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="info-scroll">
        <div className="info-hero">
          <div className="info-avatar">
            <ConversationAvatar conversation={c} size={72} />
            {c.type === "group" && isAdmin && (
              <>
                <button className="avatar-edit" aria-label="Đổi ảnh nhóm" onClick={() => avatarInput.current?.click()}><Icon name="camera" size={14} /></button>
                <input ref={avatarInput} type="file" accept="image/*" hidden onChange={e => readImage(e.target.files?.[0], url => store.updateGroup(c.id, { avatar: url }))} />
              </>
            )}
          </div>
          {editingName ? (
            <form className="rename-form" onSubmit={e => { e.preventDefault(); if (name.trim()) store.updateGroup(c.id, { name: name.trim() }); setEditingName(false); }}>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus aria-label="Tên nhóm mới" maxLength={60} />
              <button className="btn primary small" type="submit">Lưu</button>
            </form>
          ) : (
            <h2>{conversationTitle(c, users)} {c.type === "group" && <button className="icon-btn small" aria-label="Đổi tên nhóm" onClick={() => { setName(c.name ?? ""); setEditingName(true); }}><Icon name="edit" size={15} /></button>}</h2>
          )}
          {c.description && <p className="muted-text">{c.description}</p>}
          <div className="quick-actions">
            <QuickAction icon={c.muted ? "bell" : "bellOff"} label={c.muted ? "Bật thông báo" : "Tắt thông báo"} onClick={() => store.toggleMute(c.id)} active={c.muted} />
            <QuickAction icon="pin" label={c.pinned ? "Bỏ ghim" : "Ghim hội thoại"} onClick={() => store.togglePin(c.id)} active={c.pinned} />
            {c.type === "group" && <QuickAction icon="groupPlus" label="Thêm thành viên" onClick={onAddMembers} />}
            {c.type === "direct" && <QuickAction icon="groupPlus" label="Tạo nhóm trò chuyện" onClick={() => setCreating(true)} />}
            <QuickAction icon="search" label="Tìm tin nhắn" onClick={onSearch} />
          </div>
        </div>

        {c.type === "group" && (
          <Section title="Thành viên nhóm">
            <button className="info-link" onClick={() => setView("members")}><Icon name="users" size={18} /> {c.memberIds.length} thành viên</button>
          </Section>
        )}
        {other && (
          <Section title="Thông tin">
            <button className="info-link" onClick={() => openProfile(other)}><Icon name="user" size={18} /> Xem trang cá nhân</button>
          </Section>
        )}

        <Section title="Ảnh/Video" onMore={media.length ? () => setView("media") : undefined}>
          {media.length ? <div className="media-grid">{media.slice(0, 8).map(({ a, m }) => <MediaThumb key={a.id} url={a.url} kind={a.kind} onClick={() => a.kind === "image" ? onOpenImage(a.url) : onJump(m.id)} />)}</div>
            : <p className="muted-text small">Chưa có Ảnh/Video được chia sẻ trong hội thoại này</p>}
        </Section>
        <Section title="File" onMore={files.length ? () => setView("files") : undefined}>
          {files.length ? files.slice(0, 3).map(({ a, m }) => <FileRow key={a.id} name={a.name} size={a.size} when={m.createdAt} onClick={() => onJump(m.id)} />)
            : <p className="muted-text small">Chưa có File được chia sẻ trong hội thoại này</p>}
        </Section>
        <Section title="Link" onMore={links.length ? () => setView("links") : undefined}>
          {links.length ? links.slice(0, 3).map(({ url, m }, i) => <LinkRow key={i} url={url} when={m.createdAt} />)
            : <p className="muted-text small">Chưa có Link được chia sẻ trong hội thoại này</p>}
        </Section>

        <Section title="Thiết lập bảo mật">
          <button className="info-link danger" onClick={async () => { if (await askConfirm("Xóa toàn bộ lịch sử trò chuyện ở phía bạn?", "Xóa")) store.clearHistory(c.id); }}><Icon name="trash" size={18} /> Xóa lịch sử trò chuyện</button>
          {c.type === "group" && myRole === "owner" && (
            <button className="info-link danger" onClick={async () => { if (await askConfirm(`Giải tán nhóm "${c.name}"? Mọi thành viên sẽ bị xóa khỏi nhóm.`, "Giải tán nhóm")) { store.dissolveGroup(c.id); navigate("/chat"); } }}><Icon name="close" size={18} /> Giải tán nhóm</button>
          )}
          {c.type === "group" && (
            <button className="info-link danger" onClick={async () => {
              if (myRole === "owner" && c.memberIds.length > 1) { store.toast("Hãy chuyển quyền trưởng nhóm trước khi rời nhóm", "error"); setView("members"); return; }
              if (await askConfirm(`Rời nhóm "${c.name}"?`, "Rời nhóm")) { store.leaveGroup(c.id); navigate("/chat"); }
            }}><Icon name="logout" size={18} /> Rời nhóm</button>
          )}
        </Section>
      </div>
      {creating && other && (
        <MemberPicker title="Tạo nhóm" confirmLabel="Tạo nhóm" minimum={1} withGroupName exclude={[other]} onClose={() => setCreating(false)}
          onConfirm={async (ids, groupName, avatar) => { setCreating(false); navigate(`/chat/${await store.createGroup(groupName, [other, ...ids], avatar)}`); }} />
      )}
    </aside>
  );
}

const rank = (r?: Role) => (r === "owner" ? 0 : r === "deputy" ? 1 : 2);

function Section({ title, children, onMore }: { title: string; children: ReactNode; onMore?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="info-section">
      <button className="info-section-title" onClick={() => setOpen(o => !o)}>{title}<Icon name={open ? "chevronDown" : "chevronRight"} size={16} /></button>
      {open && <div className="info-section-body">{children}{onMore && <button className="btn soft block small" onClick={onMore}>Xem tất cả</button>}</div>}
    </section>
  );
}

function QuickAction({ icon, label, onClick, active }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; onClick: () => void; active?: boolean }) {
  return <button className={`quick-action ${active ? "on" : ""}`} onClick={onClick}><span><Icon name={icon} size={18} /></span><small>{label}</small></button>;
}

function MediaThumb({ url, kind, onClick }: { url: string; kind: string; onClick: () => void }) {
  return (
    <button className="media-thumb" onClick={onClick}>
      {url === "#" ? <span className="expired small">N/A</span> : kind === "video" ? <><video src={url} muted preload="metadata" /><Icon name="play" size={20} className="play" /></> : <img src={url} alt="" loading="lazy" />}
    </button>
  );
}

function FileRow({ name, size, when, onClick }: { name: string; size: number; when: number; onClick: () => void }) {
  return (
    <button className="file-row" onClick={onClick}>
      <span className={`file-ext ext-${fileExt(name).toLowerCase()}`}>{fileExt(name)}</span>
      <span><b title={name}>{name}</b><small>{fileSize(size)} · {dayLabel(when)}</small></span>
    </button>
  );
}

function LinkRow({ url, when }: { url: string; when: number }) {
  let host = url;
  try { host = new URL(url).host; } catch { /* keep raw */ }
  return (
    <a className="file-row" href={url} target="_blank" rel="noreferrer">
      <span className="file-ext link"><Icon name="link" size={18} /></span>
      <span><b title={url}>{url}</b><small>{host} · {dayLabel(when)} {clock(when)}</small></span>
    </a>
  );
}
