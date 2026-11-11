package com.zalolite.chat.message;

import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessageType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** Factory: picks the strategy for a message type. Adding a type means adding one handler bean. */
@Component
public class MessageHandlerFactory {
    private final Map<MessageType, MessageHandler> handlers = new EnumMap<>(MessageType.class);

    public MessageHandlerFactory(List<MessageHandler> all) {
        all.forEach(handler -> handlers.put(handler.type(), handler));
    }

    public MessageHandler forType(MessageType type) {
        MessageHandler handler = handlers.get(type);
        if (handler == null) {
            throw new IllegalStateException("No handler for message type " + type);
        }
        return handler;
    }

    public String preview(Message message) {
        if (message.isRecalled()) {
            return "Tin nhắn đã được thu hồi";
        }
        return forType(message.getType()).preview(message);
    }
}
