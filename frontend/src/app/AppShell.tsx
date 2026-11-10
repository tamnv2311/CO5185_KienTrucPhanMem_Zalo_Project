import { ReactNode, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ME_ID, store, useApp } from "../data/store";
import { Icon } from "../lib/icons";
import { Avatar, ConfirmHost, Menu, Toasts } from "../components/ui";
import { ProfileModal } from "../features/profile/ProfileModal";
import { SettingsModal } from "../features/settings/SettingsModal";

export type ShellModal = { kind: "profile"; userId: string } | { kind: "settings" } | undefined;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const users = useApp(s => s.db.users);
  const conversations = useApp(s => s.db.conversations);
  const requests = useApp(s => s.db.requests);
  const settings = useApp(s => s.db.settings);
  const mode = useApp(s => s.session?.mode);
  const me = users[ME_ID];
  const [menu, setMenu] = useState<"avatar" | "settings" | undefined>();
  const [modal, setModal] = useState<ShellModal>();

  const unread = useMemo(() => Object.values(conversations).filter(c => !c.hidden && !c.muted && c.unread > 0).reduce((n, c) => n + c.unread, 0), [conversations]);
  const incoming = requests.filter(r => r.toId === ME_ID).length;

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ZaloLite` : "ZaloLite";
  }, [unread]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    root.dataset.font = settings.fontSize;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme, settings.fontSize]);

  useEffect(() => {
    const open = (e: Event) => setModal({ kind: "profile", userId: (e as CustomEvent<string>).detail });
    window.addEventListener("zalolite:profile", open);
    return () => window.removeEventListener("zalolite:profile", open);
  }, []);

  return (
    <div className="app-shell">
      <nav className="nav-rail" aria-label="Điều hướng chính">
        <div className="rail-top">
          <div className="rail-avatar-wrap">
            <button className="rail-avatar" onClick={() => setMenu(menu === "avatar" ? undefined : "avatar")} title={me?.name} aria-label="Tài khoản">
              <Avatar user={me} size={46} />
            </button>
            {menu === "avatar" && (
              <div className="account-pop">
                <div className="account-pop-name">{me?.name}</div>
                <Menu align="left" onClose={() => setMenu(undefined)} items={[
                  { label: "Hồ sơ của bạn", icon: "user", onClick: () => setModal({ kind: "profile", userId: ME_ID }) },
                  { label: "Cài đặt", icon: "settings", onClick: () => setModal({ kind: "settings" }) },
                  { label: "Đăng xuất", icon: "logout", danger: true, onClick: () => { store.logout(); navigate("/auth"); } },
                ]} />
              </div>
            )}
          </div>
          {mode === "demo" && <span className="demo-pill" title="Chế độ Demo: backend chưa kết nối, dữ liệu lưu trên trình duyệt">DEMO</span>}
          <NavLink to="/chat" className="rail-btn" title="Tin nhắn" aria-label="Tin nhắn">
            <Icon name="chat" size={26} />
            {unread > 0 && <b className="badge">{unread > 99 ? "99+" : unread}</b>}
          </NavLink>
          <NavLink to="/contacts" className="rail-btn" title="Danh bạ" aria-label="Danh bạ">
            <Icon name="contacts" size={26} />
            {incoming > 0 && <b className="badge">{incoming}</b>}
          </NavLink>
        </div>
        <div className="rail-bottom">
          <NavLink to="/chat/c_self" className={() => "rail-btn"} title="Cloud của tôi" aria-label="Cloud của tôi"><Icon name="cloud" size={25} /></NavLink>
          <NavLink to="/stats" className="rail-btn" title="Thống kê" aria-label="Thống kê"><Icon name="chart" size={24} /></NavLink>
          <div className="rail-avatar-wrap">
            <button className="rail-btn" title="Cài đặt" aria-label="Cài đặt" onClick={() => setMenu(menu === "settings" ? undefined : "settings")}><Icon name="settings" size={25} /></button>
            {menu === "settings" && (
              <div className="account-pop bottom">
                <Menu align="left" onClose={() => setMenu(undefined)} items={[
                  { label: "Thông tin tài khoản", icon: "user", onClick: () => setModal({ kind: "profile", userId: ME_ID }) },
                  { label: "Cài đặt", icon: "settings", onClick: () => setModal({ kind: "settings" }) },
                  { label: settings.theme === "dark" ? "Giao diện sáng" : "Giao diện tối", icon: settings.theme === "dark" ? "sun" : "moon", onClick: () => store.updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" }) },
                  { label: "Đăng xuất", icon: "logout", danger: true, onClick: () => { store.logout(); navigate("/auth"); } },
                ]} />
              </div>
            )}
          </div>
        </div>
      </nav>
      <div className="shell-main">
        {children}
      </div>
      {modal?.kind === "profile" && <ProfileModal userId={modal.userId} onClose={() => setModal(undefined)} />}
      {modal?.kind === "settings" && <SettingsModal onClose={() => setModal(undefined)} />}
      <Toasts onOpen={id => navigate(`/chat/${id}`)} />
      <ConfirmHost />
    </div>
  );
}

/** Opens the profile modal from anywhere (e.g. clicking an avatar in a chat). */
export function openProfile(userId: string) {
  window.dispatchEvent(new CustomEvent("zalolite:profile", { detail: userId }));
}
