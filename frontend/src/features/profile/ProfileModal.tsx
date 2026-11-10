import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Gender, User } from "../../data/types";
import { ME_ID, store, useApp } from "../../data/store";
import { Avatar, Modal, askConfirm } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { lastSeenText } from "../../lib/format";
import { readImage } from "../chat/ChatModals";

const GENDER: Record<Gender, string> = { male: "Nam", female: "Nữ", other: "Khác" };

function formatBirthday(value?: string) {
  if (!value) return "Chưa cập nhật";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function ProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const user = useApp(s => s.db.users[userId]);
  const friendIds = useApp(s => s.db.friendIds);
  const requests = useApp(s => s.db.requests);
  const [editing, setEditing] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const isMe = userId === ME_ID;
  if (!user) return null;
  const isFriend = friendIds.includes(userId);
  const pending = requests.some(r => r.fromId === ME_ID && r.toId === userId);

  if (editing) return <EditProfile user={user} onBack={() => setEditing(false)} onClose={onClose} />;

  return (
    <Modal title={isMe ? "Thông tin tài khoản" : "Thông tin tài khoản"} onClose={onClose} width={400} className="profile-modal">
      <div className="profile-cover" style={user.cover ? { backgroundImage: `url(${user.cover})` } : { background: `linear-gradient(135deg, ${user.color}, #7fb6f5)` }}>
        {isMe && <>
          <button className="cover-edit" aria-label="Đổi ảnh bìa" onClick={() => coverInput.current?.click()}><Icon name="camera" size={16} /></button>
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={e => readImage(e.target.files?.[0], url => void store.updateMe({ cover: url }))} />
        </>}
      </div>
      <div className="profile-head">
        <div className="profile-avatar">
          <Avatar user={user} size={84} />
          {isMe && <>
            <button className="avatar-edit" aria-label="Đổi ảnh đại diện" onClick={() => avatarInput.current?.click()}><Icon name="camera" size={14} /></button>
            <input ref={avatarInput} type="file" accept="image/*" hidden onChange={e => readImage(e.target.files?.[0], url => void store.updateMe({ avatar: url }))} />
          </>}
        </div>
        <h3>{user.name} {isMe && <button className="icon-btn small" aria-label="Chỉnh sửa tên" onClick={() => setEditing(true)}><Icon name="edit" size={15} /></button>}</h3>
        {!isMe && <p className="muted-text small">{lastSeenText(user.online, user.lastSeen)}</p>}
        {user.bio && <p className="bio">{user.bio}</p>}
        {!isMe && (
          <div className="profile-actions">
            {isFriend
              ? <button className="btn soft" onClick={async () => { if (await askConfirm(`Hủy kết bạn với ${user.name}?`, "Hủy kết bạn")) store.unfriend(userId); }}>Hủy kết bạn</button>
              : pending ? <button className="btn soft" disabled>Đã gửi lời mời</button>
                : <button className="btn soft" onClick={() => void store.sendFriendRequest(userId, `Xin chào ${user.name}, kết bạn nhé!`)}>Kết bạn</button>}
            <button className="btn primary" onClick={() => { onClose(); navigate(`/chat/${store.ensureDirect(userId)}`); }}>Nhắn tin</button>
          </div>
        )}
      </div>
      <div className="profile-section">
        <h4>Thông tin cá nhân</h4>
        <dl>
          <dt>Giới tính</dt><dd>{user.gender ? GENDER[user.gender] : "Chưa cập nhật"}</dd>
          <dt>Ngày sinh</dt><dd>{formatBirthday(user.birthday)}</dd>
          <dt>Điện thoại</dt><dd>{user.phone ?? "Chưa cập nhật"}</dd>
          {user.email && <><dt>Email</dt><dd>{user.email}</dd></>}
        </dl>
        {isMe && <p className="muted-text small">Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này</p>}
      </div>
      {isMe && <div className="profile-footer"><button className="btn soft block" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Cập nhật</button></div>}
    </Modal>
  );
}

function EditProfile({ user, onBack, onClose }: { user: User; onBack: () => void; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [gender, setGender] = useState<Gender>(user.gender ?? "male");
  const [birthday, setBirthday] = useState(user.birthday ?? "2000-01-01");
  const [bio, setBio] = useState(user.bio ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  return (
    <Modal title={<><button className="icon-btn small" aria-label="Quay lại" onClick={onBack}><Icon name="arrowLeft" size={18} /></button> Cập nhật thông tin cá nhân</>} onClose={onClose} width={420}
      footer={<>
        <button className="btn ghost" onClick={onBack}>Hủy</button>
        <button className="btn primary" disabled={!name.trim()} onClick={async () => { await store.updateMe({ name: name.trim(), gender, birthday, bio: bio.trim(), phone: phone.trim() || undefined }); onBack(); }}>Cập nhật</button>
      </>}>
      <label className="field"><span>Tên hiển thị</span><input value={name} onChange={e => setName(e.target.value)} maxLength={40} /></label>
      <label className="field"><span>Giới thiệu</span><textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={120} placeholder="Viết vài dòng về bạn" /></label>
      <div className="field"><span>Giới tính</span>
        <div className="radio-row">
          {(Object.keys(GENDER) as Gender[]).map(g => <label key={g}><input type="radio" name="gender" checked={gender === g} onChange={() => setGender(g)} /> {GENDER[g]}</label>)}
        </div>
      </div>
      <label className="field"><span>Ngày sinh</span><input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} /></label>
      <label className="field"><span>Số điện thoại</span><input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" /></label>
    </Modal>
  );
}
