import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "../../data/store";
import { BrandMark, Icon } from "../../lib/icons";

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = register ? await store.register(email, password, displayName) : await store.login(email, password);
      if (result === "demo") store.toast("Không kết nối được backend – đang chạy chế độ Demo với dữ liệu mẫu");
      navigate("/chat", { replace: true });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  function demo() {
    store.demoLogin();
    navigate("/chat", { replace: true });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <BrandMark size={56} />
          <h1>ZaloLite</h1>
          <p>Đăng nhập tài khoản ZaloLite<br />để kết nối với ứng dụng ZaloLite Web</p>
        </div>
        <div className="auth-tabs" role="tablist">
          <button role="tab" aria-selected={!register} className={!register ? "active" : ""} onClick={() => setMode("login")} type="button">Đăng nhập</button>
          <button role="tab" aria-selected={register} className={register ? "active" : ""} onClick={() => setMode("register")} type="button">Tạo tài khoản</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {register && (
            <label className="field-with-icon">
              <Icon name="user" size={18} />
              <input aria-label="Tên hiển thị" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Tên hiển thị" required />
            </label>
          )}
          <label className="field-with-icon">
            <Icon name="mail" size={18} />
            <input aria-label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required autoComplete="email" />
          </label>
          <label className="field-with-icon">
            <Icon name="lock" size={18} />
            <input aria-label="Mật khẩu" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu (tối thiểu 8 ký tự)" minLength={8} required autoComplete={register ? "new-password" : "current-password"} />
            <button type="button" className="link-btn" onClick={() => setShowPassword(v => !v)}>{showPassword ? "Ẩn" : "Hiện"}</button>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn primary block" type="submit" disabled={busy}>{busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập với mật khẩu"}</button>
        </form>
        <div className="auth-divider"><span>hoặc</span></div>
        <button className="btn ghost block" type="button" onClick={demo}>Dùng thử với dữ liệu mẫu (Demo)</button>
        <p className="auth-note">Nếu backend chưa chạy, ứng dụng tự chuyển sang chế độ Demo để bạn trải nghiệm đầy đủ tính năng.</p>
      </section>
      <footer className="auth-footer">CO5185 · Kiến trúc phần mềm · HK1 2026–2027</footer>
    </main>
  );
}
