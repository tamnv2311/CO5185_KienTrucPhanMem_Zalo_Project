import { ReactNode, useEffect, useRef, useState } from "react";
import type { Conversation, User } from "../data/types";
import { initials } from "../lib/format";
import { Icon } from "../lib/icons";
import { ME_ID, store, useApp } from "../data/store";

export function Avatar({ user, size = 44, showStatus = false }: { user?: Pick<User, "name" | "avatar" | "color" | "online">; size?: number; showStatus?: boolean }) {
  const name = user?.name ?? "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: user?.avatar ? undefined : user?.color }}>
      {user?.avatar ? <img src={user.avatar} alt="" /> : initials(name)}
      {showStatus && user?.online && <i className="avatar-dot" />}
    </span>
  );
}

/** Group avatar: custom image, or a 2x2 mosaic of member avatars. */
export function ConversationAvatar({ conversation, size = 48 }: { conversation: Conversation; size?: number }) {
  const users = useApp(s => s.db.users);
  if (conversation.type === "self") {
    return <span className="avatar cloud-avatar" style={{ width: size, height: size }}><Icon name="cloud" size={size * 0.5} /></span>;
  }
  if (conversation.type === "direct") {
    const other = users[conversation.memberIds.find(id => id !== ME_ID) ?? ""];
    return <Avatar user={other} size={size} showStatus />;
  }
  if (conversation.avatar) return <Avatar user={{ name: conversation.name ?? "", avatar: conversation.avatar, color: conversation.color ?? "#888", online: false }} size={size} />;
  const members = conversation.memberIds.slice(0, 4).map(id => users[id]).filter(Boolean);
  const extra = conversation.memberIds.length - 3;
  const cell = size * 0.52;
  return (
    <span className="avatar-mosaic" style={{ width: size, height: size }}>
      {members.slice(0, extra > 1 ? 3 : 4).map(m => <Avatar key={m.id} user={m} size={cell} />)}
      {extra > 1 && <span className="avatar mosaic-more" style={{ width: cell, height: cell, fontSize: cell * 0.36 }}>+{extra}</span>}
    </span>
  );
}

export function conversationTitle(conversation: Conversation, users: Record<string, User>): string {
  if (conversation.type === "self") return "Cloud của tôi";
  if (conversation.type === "group") return conversation.name ?? "Nhóm";
  return users[conversation.memberIds.find(id => id !== ME_ID) ?? ""]?.name ?? "Người dùng";
}

export function Modal({ title, onClose, children, width = 440, footer, className = "" }: { title?: ReactNode; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${className}`} style={{ width }} role="dialog" aria-modal="true">
        {title !== undefined && (
          <header className="modal-header">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Đóng"><Icon name="close" /></button>
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function Toasts({ onOpen }: { onOpen: (conversationId: string) => void }) {
  const toasts = useApp(s => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => (
        <button key={t.id} className={`toast ${t.tone ?? "info"}`} onClick={() => { if (t.conversationId) onOpen(t.conversationId); store.dismissToast(t.id); }}>
          {t.tone === "success" && <Icon name="check" size={18} />}
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}

export interface MenuItem {
  label: string;
  icon?: Parameters<typeof Icon>[0]["name"];
  danger?: boolean;
  onClick: () => void;
}

/** Popover menu anchored where it is rendered; closes on outside click. */
export function Menu({ items, onClose, align = "right" }: { items: MenuItem[]; onClose: () => void; align?: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("mousedown", onDown));
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div ref={ref} className={`menu menu-${align}`} role="menu">
      {items.map(item => (
        <button key={item.label} role="menuitem" className={item.danger ? "danger" : ""} onClick={() => { item.onClick(); onClose(); }}>
          {item.icon && <Icon name={item.icon} size={18} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button>
    </label>
  );
}

export function Empty({ icon, title, text, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={34} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

interface ConfirmRequest { message: string; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void }
let pushConfirm: ((r: ConfirmRequest | undefined) => void) | undefined;

/** In-app replacement for window.confirm (keeps the look consistent and never blocks the page). */
export function askConfirm(message: string, confirmLabel = "Đồng ý", danger = true): Promise<boolean> {
  return new Promise(resolve => {
    if (!pushConfirm) { resolve(true); return; }
    pushConfirm({ message, confirmLabel, danger, resolve });
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest>();
  useEffect(() => { pushConfirm = setRequest; return () => { pushConfirm = undefined; }; }, []);
  if (!request) return null;
  const finish = (ok: boolean) => { request.resolve(ok); setRequest(undefined); };
  return (
    <Modal title="Xác nhận" onClose={() => finish(false)} width={380}
      footer={<>
        <button className="btn ghost" onClick={() => finish(false)}>Hủy</button>
        <button className={`btn ${request.danger ? "danger" : "primary"}`} onClick={() => finish(true)} autoFocus>{request.confirmLabel}</button>
      </>}>
      <p className="confirm-text">{request.message}</p>
    </Modal>
  );
}
