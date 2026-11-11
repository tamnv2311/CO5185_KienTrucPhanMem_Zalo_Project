import { FormEvent, useState } from "react";
import type { User } from "../../data/types";
import { ME_ID, store, useApp } from "../../data/store";
import { Avatar, Modal } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { openProfile } from "../../app/AppShell";

export function AddFriendModal({ onClose, onOpenChat }: { onClose: () => void; onOpenChat: (userId: string) => void }) {
  const friendIds = useApp(s => s.db.friendIds);
  const requests = useApp(s => s.db.requests);
  const users = useApp(s => s.db.users);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>();
  const [target, setTarget] = useState<User>();
  const [greeting, setGreeting] = useState(`Xin chào, mình là ${users[ME_ID]?.name}. Kết bạn với mình nhé!`);

  const live = useApp(s => s.session?.mode === "live");

  async function search(e: FormEvent) {
    e.preventDefault();
    setResults(await store.findUsers(query));
  }

  const status = (u: User) => friendIds.includes(u.id) ? "friend" : requests.some(r => r.fromId === ME_ID && r.toId === u.id) ? "sent" : requests.some(r => r.toId === ME_ID && r.fromId === u.id) ? "incoming" : "none";

  if (target) {
    return (
      <Modal title="Gửi lời mời kết bạn" onClose={onClose} width={420} footer={<>
        <button className="btn ghost" onClick={() => setTarget(undefined)}>Quay lại</button>
        <button className="btn primary" onClick={() => { void store.sendFriendRequest(target.id, greeting); onClose(); }}>Kết bạn</button>
      </>}>
        <div className="friend-target"><Avatar user={target} size={64} /><h3>{target.name}</h3>{target.phone && <small>{target.phone}</small>}</div>
        <label className="field"><span>Lời chào</span><textarea value={greeting} onChange={e => setGreeting(e.target.value)} maxLength={150} /></label>
        <small className="hint right">{greeting.length}/150</small>
      </Modal>
    );
  }

  return (
    <Modal title="Thêm bạn" onClose={onClose} width={420}>
      <form className="phone-search" onSubmit={search}>
        <label className="search-field"><Icon name="phone" size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Số điện thoại, email hoặc tên" aria-label="Số điện thoại hoặc email" /></label>
        <button className="btn primary" type="submit" disabled={!query.trim()}>Tìm kiếm</button>
      </form>
      {live
        ? <p className="hint">Nhập chính xác email hoặc số điện thoại, hoặc một phần tên hiển thị.</p>
        : <p className="hint">Thử: <code>0987 654 321</code>, <code>vy@zalolite.dev</code> hoặc <code>Ngân</code></p>}
      {results && results.length === 0 && <p className="muted-text pad center">Không tìm thấy người dùng nào</p>}
      <div className="picker-list">
        {results?.map(u => {
          const s = status(u);
          return (
            <div key={u.id} className="result-row static">
              <button className="plain" onClick={() => openProfile(u.id)}><Avatar user={u} size={44} /></button>
              <span><b>{u.name}</b><small>{u.phone ?? u.email}</small></span>
              {s === "friend" && <button className="btn soft small" onClick={() => onOpenChat(u.id)}>Nhắn tin</button>}
              {s === "sent" && <span className="pill">Đã gửi lời mời</span>}
              {s === "incoming" && <button className="btn primary small" onClick={() => { const r = requests.find(x => x.fromId === u.id); if (r) store.acceptRequest(r.id); }}>Đồng ý</button>}
              {s === "none" && <button className="btn primary small" onClick={() => setTarget(u)}>Kết bạn</button>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
