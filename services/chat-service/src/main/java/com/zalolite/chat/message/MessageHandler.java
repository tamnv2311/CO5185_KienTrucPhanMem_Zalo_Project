package com.zalolite.chat.message;

import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessageType;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;

/**
 * Strategy for one message type: validates what the client sent, copies it onto the
 * message and knows how that type is summarised in the conversation list.
 */
public interface MessageHandler {
    MessageType type();

    /** Validates the request and fills content/attachments. Throws BusinessException(422) when invalid. */
    void apply(Message message, SendMessageRequest request);

    /** One-line text for the conversation list, replies and notifications. */
    String preview(Message message);
}
