import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../data/store";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { BrandMark } from "../../lib/icons";

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const conversation = useApp(s => (conversationId ? s.db.conversations[conversationId] : undefined));
  const syncing = useApp(s => s.syncing);

  useEffect(() => {
    // After a reload the conversations are still on their way from the backend: wait before giving up.
    if (conversationId && !conversation && !syncing) navigate("/chat", { replace: true });
  }, [conversationId, conversation, syncing, navigate]);

  return (
    <div className={`chat-page ${conversation ? "has-active" : ""}`}>
      <ConversationList activeId={conversationId} />
      {conversation ? <ChatWindow key={conversation.id} conversation={conversation} /> : <Welcome />}
    </div>
  );
}

function Welcome() {
  return (
    <section className="welcome">
      <BrandMark size={72} />
      <h2>Chào mừng đến với <b>ZaloLite</b>!</h2>
      <p>Khám phá những tiện ích hỗ trợ làm việc và trò chuyện cùng người thân, bạn bè được tối ưu hoá cho máy tính của bạn.</p>
      <ul className="welcome-tips">
        <li><b>Nhắn tin nhiều hơn, soạn thảo ít hơn</b><span>Dùng tin nhắn nhanh, sticker và cảm xúc để trả lời trong tích tắc.</span></li>
        <li><b>Trò chuyện nhóm hiệu quả</b><span>Nhắc tên bằng @, ghim tin nhắn quan trọng và tạo bình chọn.</span></li>
        <li><b>Gửi file dung lượng lớn</b><span>Kéo thả ảnh, video, tài liệu tới 100 MB vào khung chat.</span></li>
      </ul>
    </section>
  );
}
