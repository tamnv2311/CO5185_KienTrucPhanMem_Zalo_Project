import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "./features/auth/AuthPage";
import { ChatPage } from "./features/chat/ChatPage";
import { ContactsPage } from "./features/contacts/ContactsPage";
import { DashboardPage } from "./features/stats/DashboardPage";
import { AppShell } from "./app/AppShell";
import { useApp } from "./data/store";
import "./styles.css";

function RequireSession({ children }: { children: React.ReactNode }) {
  const session = useApp(s => s.session);
  if (!session) return <Navigate to="/auth" replace />;
  return <AppShell>{children}</AppShell>;
}

function App() {
  const session = useApp(s => s.session);
  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? "/chat" : "/auth"} replace />} />
      <Route path="/auth" element={session ? <Navigate to="/chat" replace /> : <AuthPage />} />
      <Route path="/chat/:conversationId?" element={<RequireSession><ChatPage /></RequireSession>} />
      <Route path="/contacts/:tab?" element={<RequireSession><ContactsPage /></RequireSession>} />
      <Route path="/stats" element={<RequireSession><DashboardPage /></RequireSession>} />
      <Route path="/groups" element={<Navigate to="/contacts/groups" replace />} />
      <Route path="/profile" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
