package com.zalolite.chat.message;

import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessageType;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;
import com.zalolite.common.core.BusinessException;
import org.springframework.stereotype.Component;

@Component
public class TextMessageHandler implements MessageHandler {
    static final int MAX_LENGTH = 5000;

    @Override
    public MessageType type() {
        return MessageType.TEXT;
    }

    @Override
    public void apply(Message message, SendMessageRequest request) {
        String content = request.content();
        if (content == null || content.isBlank()) {
            throw new BusinessException(422, "Nội dung tin nhắn không được để trống");
        }
        if (content.length() > MAX_LENGTH) {
            throw new BusinessException(422, "Tin nhắn tối đa " + MAX_LENGTH + " ký tự");
        }
        message.setContent(content);
    }

    @Override
    public String preview(Message message) {
        String content = message.getContent() == null ? "" : message.getContent().strip();
        return content.length() > 120 ? content.substring(0, 120) + "…" : content;
    }
}
