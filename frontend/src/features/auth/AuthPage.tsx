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
    <main>
      <h1>{register ? "Đăng ký" : "Đăng nhập"}</h1>
      <form onSubmit={submit}>
        {register && <input aria-label="Tên hiển thị" value={displayName} onChange={event => setDisplayName(event.target.value)} required />}
        <input aria-label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
        <input aria-label="Mật khẩu" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required />
        <button type="submit">{register ? "Tạo tài khoản" : "Đăng nhập"}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => setRegister(value => !value)}>
        {register ? "Đã có tài khoản?" : "Tạo tài khoản mới"}
      </button>
    </main>
  );
}
