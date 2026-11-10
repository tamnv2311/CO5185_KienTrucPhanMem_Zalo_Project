import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { store, useApp } from "../../data/store";
import { Modal, Toggle, askConfirm } from "../../components/ui";
import { Icon } from "../../lib/icons";

type Tab = "general" | "privacy" | "messages" | "notify" | "account";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const settings = useApp(s => s.db.settings);
  const session = useApp(s => s.session);
  const [tab, setTab] = useState<Tab>("general");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const tabs: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
    { id: "general", label: "Cài đặt chung", icon: "settings" },
    { id: "privacy", label: "Quyền riêng tư", icon: "lock" },
    { id: "messages", label: "Tin nhắn", icon: "chat" },
    { id: "notify", label: "Thông báo", icon: "bell" },
    { id: "account", label: "Tài khoản & dữ liệu", icon: "shield" },
  ];

  return (
    <Modal title="Cài đặt" onClose={onClose} width={720} className="settings-modal">
      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map(t => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}><Icon name={t.icon} size={18} /> {t.label}</button>)}
        </nav>
        <div className="settings-content">
          {tab === "general" && <>
            <h4>Giao diện</h4>
            <div className="theme-options">
              {(["light", "dark", "system"] as const).map(t => (
                <button key={t} className={`theme-card ${t} ${settings.theme === t ? "on" : ""}`} onClick={() => store.updateSettings({ theme: t })}>
                  <span className="theme-preview"><i /><i /><i /></span>
                  {t === "light" ? "Sáng" : t === "dark" ? "Tối" : "Theo hệ thống"}
                </button>
              ))}
            </div>
            <h4>Cỡ chữ tin nhắn</h4>
            <div className="segmented">
              {(["sm", "md", "lg"] as const).map(f => <button key={f} className={settings.fontSize === f ? "on" : ""} onClick={() => store.updateSettings({ fontSize: f })}>{f === "sm" ? "Nhỏ" : f === "md" ? "Vừa" : "Lớn"}</button>)}
            </div>
            <h4>Ngôn ngữ</h4>
            <select value="vi" onChange={() => undefined} aria-label="Ngôn ngữ"><option value="vi">Tiếng Việt</option></select>
          </>}
          {tab === "privacy" && <>
            <h4>Trạng thái hoạt động</h4>
            <Toggle label="Hiển thị trạng thái truy cập" checked={settings.showOnline} onChange={v => store.updateSettings({ showOnline: v })} />
            <h4>Tin nhắn</h4>
            <Toggle label="Hiện trạng thái “Đã xem”" checked={settings.readReceipts} onChange={v => store.updateSettings({ readReceipts: v })} />
          </>}
          {tab === "messages" && <>
            <h4>Phím tắt gửi tin</h4>
            <div className="radio-col">
              <label><input type="radio" checked={settings.enterToSend} onChange={() => store.updateSettings({ enterToSend: true })} /> Nhấn <kbd>Enter</kbd> để gửi, <kbd>Shift</kbd>+<kbd>Enter</kbd> để xuống dòng</label>
              <label><input type="radio" checked={!settings.enterToSend} onChange={() => store.updateSettings({ enterToSend: false })} /> Nhấn <kbd>Ctrl</kbd>+<kbd>Enter</kbd> để gửi, <kbd>Enter</kbd> để xuống dòng</label>
            </div>
          </>}
          {tab === "notify" && <>
            <h4>Âm thanh</h4>
            <Toggle label="Phát âm thanh khi có tin nhắn mới" checked={settings.notifySound} onChange={v => store.updateSettings({ notifySound: v })} />
            <p className="muted-text small">Hội thoại đã tắt thông báo sẽ không phát âm thanh và không hiện cửa sổ thông báo.</p>
          </>}
          {tab === "account" && <>
            <h4>Kết nối máy chủ</h4>
            <p className={`mode-pill ${session?.mode}`}>{session?.mode === "live" ? "Đang dùng API thật (API Gateway :8080)" : "Chế độ Demo – dữ liệu lưu trên trình duyệt"}</p>
            <h4>Đổi mật khẩu</h4>
            <form className="pw-form" onSubmit={e => {
              e.preventDefault();
              if (pw.next.length < 8) { store.toast("Mật khẩu mới tối thiểu 8 ký tự", "error"); return; }
              if (pw.next !== pw.confirm) { store.toast("Mật khẩu xác nhận không khớp", "error"); return; }
              setPw({ current: "", next: "", confirm: "" });
              store.toast(session?.mode === "live" ? "Backend chưa hỗ trợ đổi mật khẩu" : "Đã đổi mật khẩu (demo)", session?.mode === "live" ? "error" : "success");
            }}>
              <input type="password" placeholder="Mật khẩu hiện tại" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} aria-label="Mật khẩu hiện tại" required />
              <input type="password" placeholder="Mật khẩu mới" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} aria-label="Mật khẩu mới" required />
              <input type="password" placeholder="Nhập lại mật khẩu mới" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} aria-label="Nhập lại mật khẩu mới" required />
              <button className="btn primary" type="submit">Cập nhật mật khẩu</button>
            </form>
            {session?.mode === "demo" && <>
              <h4>Dữ liệu mẫu</h4>
              <button className="btn soft" onClick={async () => { if (await askConfirm("Khôi phục toàn bộ dữ liệu mẫu? Tin nhắn bạn đã gửi trong chế độ Demo sẽ bị xóa.", "Khôi phục")) store.resetDemoData(); }}><Icon name="refresh" size={16} /> Khôi phục dữ liệu mẫu</button>
            </>}
            <h4>Phiên đăng nhập</h4>
            <button className="btn danger" onClick={() => { store.logout(); onClose(); navigate("/auth"); }}><Icon name="logout" size={16} /> Đăng xuất</button>
          </>}
        </div>
      </div>
    </Modal>
  );
}
