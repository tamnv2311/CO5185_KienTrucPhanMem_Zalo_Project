package com.zalolite.chat.message;

import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessageType;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;
import com.zalolite.common.core.BusinessException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** The remaining concrete strategies. Each one is a bean so the factory discovers it automatically. */
@Configuration
public class MediaMessageHandlers {
    @Bean
    MessageHandler imageMessageHandler() {
        return new AttachmentMessageHandler() {
            @Override public MessageType type() { return MessageType.IMAGE; }
            @Override String label() { return "Hình ảnh"; }
        };
    }

    @Bean
    MessageHandler videoMessageHandler() {
        return new AttachmentMessageHandler() {
            @Override public MessageType type() { return MessageType.VIDEO; }
            @Override String label() { return "Video"; }
        };
    }

    @Bean
    MessageHandler fileMessageHandler() {
        return new AttachmentMessageHandler() {
            @Override public MessageType type() { return MessageType.FILE; }
            @Override String label() { return "Tệp"; }
            @Override String suffix(Message message) {
                String name = message.getAttachments().isEmpty() ? null : message.getAttachments().get(0).name();
                return name == null ? "" : " " + name;
            }
        };
    }

    @Bean
    MessageHandler stickerMessageHandler() {
        return new MessageHandler() {
            @Override public MessageType type() { return MessageType.STICKER; }

            @Override
            public void apply(Message message, SendMessageRequest request) {
                if (request.content() == null || request.content().isBlank() || request.content().length() > 200) {
                    throw new BusinessException(422, "Sticker không hợp lệ");
                }
                message.setContent(request.content());
            }

            @Override public String preview(Message message) { return "[Sticker]"; }
        };
    }

    @Bean
    MessageHandler systemMessageHandler() {
        return new MessageHandler() {
            @Override public MessageType type() { return MessageType.SYSTEM; }

            @Override
            public void apply(Message message, SendMessageRequest request) {
                throw BusinessException.forbidden("Không thể gửi tin nhắn hệ thống");
            }

            @Override public String preview(Message message) { return message.getContent(); }
        };
    }
}
