import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useChatSocket } from "./useChatSocket";

interface Message {
  id: string;
  seq: number;
  senderId: string;
  content: string;
  status: "SENT" | "DELIVERED" | "SEEN";
}

const contacts = [
  { id: "family", name: "Gia đình", preview: "Mai: Nhớ họp vào tối nay nhé", time: "10:24", color: "#f97316", initials: "GĐ" },
  { id: "team", name: "Nhóm đồ án", preview: "Minh: Mình vừa cập nhật bản mới", time: "09:18", color: "#2563eb", initials: "DA" },
  { id: "anhlinh", name: "Anh Linh", preview: "Cảm ơn bạn!", time: "Hôm qua", color: "#8b5cf6", initials: "AL" },
  { id: "cloud", name: "Zalo Cloud", preview: "Thông báo từ dịch vụ đám mây", time: "Hôm qua", color: "#0ea5e9", initials: "C" },
];

export function ChatPage() {
  const [conversationId, setConversationId] = useState("family");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome-1", seq: 1, senderId: "other", content: "Chào cả nhà, cuối tuần có ai rảnh không?", status: "SEEN" },
    { id: "welcome-2", seq: 2, senderId: "me", content: "Mình rảnh nhé! Cuối tuần đi ăn cơm nhà?", status: "SEEN" },
    { id: "welcome-3", seq: 3, senderId: "other", content: "Đồng ý luôn. Nhớ họp vào tối nay nhé", status: "SEEN" },
  ]);
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const active = useMemo(() => contacts.find(item => item.id === conversationId) ?? contacts[0], [conversationId]);

  useChatSocket(conversationId, message => {
    setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
  });

  async function load(id: string) {
    try {
      const history = await api<Message[]>(`/chat/conversations/${id}/messages`);
      setMessages(history);
    } catch {
      // Keep the demo conversation visible when this conversation is not in the API yet.
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (!text) return;
    try {
      const message = await api<Message>("/chat/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId, clientMsgId: crypto.randomUUID(), content: text }),
      });
      setMessages(current => [...current, message]);
    } catch {
      setMessages(current => [...current, { id: crypto.randomUUID(), seq: current.length + 1, senderId: "me", content: text, status: "SENT" }]);
    }
    setContent("");
  }

  const filteredContacts = contacts.filter(contact => contact.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="messenger-shell">
      <aside className="rail">
        <Link className="rail-avatar" to="/profile" title="Trang cá nhân">NV</Link>
        <nav>
          <Link className="rail-button active" to="/chat" title="Tin nhắn">💬</Link>
          <Link className="rail-button" to="/groups" title="Danh bạ">👥</Link>
          <Link className="rail-button" to="/stats" title="Thống kê">▦</Link>
        </nav>
        <button className="rail-button" title="Cài đặt" type="button">⚙</button>
      </aside>
      <aside className="conversation-panel">
        <div className="conversation-heading"><h1>Tin nhắn</h1><button type="button" title="Tin nhắn mới">＋</button></div>
        <label className="search-box"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm kiếm" /></label>
        <div className="contact-list">
          {filteredContacts.map(contact => (
            <button className={`contact ${contact.id === conversationId ? "active" : ""}`} key={contact.id} type="button"
              onClick={() => { setConversationId(contact.id); void load(contact.id); }}>
              <span className="contact-avatar" style={{ background: contact.color }}>{contact.initials}</span>
              <span className="contact-copy"><strong>{contact.name}</strong><small>{contact.preview}</small></span>
              <time>{contact.time}</time>
            </button>
          ))}
        </div>
      </aside>
      <section className="chat-panel">
        <header className="chat-header">
          <div className="contact-avatar" style={{ background: active.color }}>{active.initials}</div>
          <div><h2>{active.name}</h2><p><span className="online-dot"></span> Đang hoạt động</p></div>
          <div className="chat-actions"><button type="button">⌕</button><button type="button">▣</button><button type="button">ⓘ</button></div>
        </header>
        <div className="message-area">
          <div className="day-divider"><span>Hôm nay</span></div>
          {messages.map(message => (
            <div className={`message-row ${message.senderId === "me" ? "mine" : ""}`} key={message.id}>
              {message.senderId !== "me" && <span className="mini-avatar" style={{ background: active.color }}>{active.initials}</span>}
              <div><div className="message-bubble">{message.content}</div><small>{message.senderId === "me" ? (message.status === "SEEN" ? "Đã xem" : "Đã gửi") : "10:24"}</small></div>
            </div>
          ))}
        </div>
        <form className="composer" onSubmit={send}>
          <button type="button">▧</button><button type="button">📎</button>
          <label className="message-input"><input value={content} onChange={event => setContent(event.target.value)} placeholder={`Nhắn tin tới ${active.name}`} /><span>☺</span></label>
          <button className="send-button" type="submit">➤</button>
        </form>
      </section>
    </main>
  );
}
