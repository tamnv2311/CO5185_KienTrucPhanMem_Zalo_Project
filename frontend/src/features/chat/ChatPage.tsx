import { FormEvent, useState } from "react";
import { api } from "../../api/client";
import { useChatSocket } from "./useChatSocket";

interface Message {
  id: string;
  seq: number;
  senderId: string;
  content: string;
  status: "SENT" | "DELIVERED" | "SEEN";
}

export function ChatPage() {
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  useChatSocket(conversationId, message => {
    setMessages(current => current.some(item => item.id === message.id)
      ? current
      : [...current, message]);
  });

  async function load() {
    if (!conversationId) return;
    const history = await api<Message[]>(`/chat/conversations/${conversationId}/messages`);
    setMessages(history);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!conversationId || !content.trim()) return;
    const message = await api<Message>("/chat/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId,
        clientMsgId: crypto.randomUUID(),
        content: content.trim(),
      }),
    });
    setMessages(current => [...current, message]);
    setContent("");
  }

  return (
    <main>
      <label>Conversation ID
        <input value={conversationId} onChange={event => setConversationId(event.target.value)} />
      </label>
      <button type="button" onClick={load}>Tải lịch sử</button>
      <section aria-label="Tin nhắn">
        {messages.map(message => <p key={message.id}>{message.content} — {message.status}</p>)}
      </section>
      <form onSubmit={send}>
        <input value={content} onChange={event => setContent(event.target.value)} />
        <button type="submit">Gửi</button>
      </form>
    </main>
  );
}
