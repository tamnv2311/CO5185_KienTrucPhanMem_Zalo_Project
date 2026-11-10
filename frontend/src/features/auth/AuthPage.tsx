import { FormEvent, useState } from "react";
import { api } from "../../api/client";

interface AuthData {
  accessToken: string;
  refreshToken: string;
}

export function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const path = register ? "/auth/register" : "/auth/login";
      const data = await api<AuthData>(path, {
        method: "POST",
        body: JSON.stringify(register ? { email, password, displayName } : { email, password }),
      });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      window.location.href = "/chat";
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Authentication failed");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <div className="brand-mark">Z</div>
        <div>
          <h1>ZaloLite</h1>
          <p>Kết nối mọi cuộc trò chuyện của bạn.</p>
        </div>
        <div className="auth-bubbles" aria-hidden="true">
          <span>Xin chào! 👋</span>
          <span>Hôm nay bạn thế nào?</span>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-card-header">
          <span className="eyebrow">CHÀO MỪNG</span>
          <h2>{register ? "Tạo tài khoản mới" : "Đăng nhập"}</h2>
          <p>{register ? "Chỉ vài bước để bắt đầu kết nối." : "Đăng nhập để tiếp tục cuộc trò chuyện."}</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {register && <label>Tên hiển thị<input aria-label="Tên hiển thị" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Nguyễn Văn An" required /></label>}
          <label>Email<input aria-label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="ban@example.com" required /></label>
          <label>Mật khẩu<input aria-label="Mật khẩu" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Tối thiểu 8 ký tự" minLength={8} required /></label>
          <button className="primary-button" type="submit">{register ? "Tạo tài khoản" : "Đăng nhập"}</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="text-button" type="button" onClick={() => setRegister(value => !value)}>
          {register ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Tạo tài khoản mới"}
        </button>
      </section>
    </main>
  );
}
