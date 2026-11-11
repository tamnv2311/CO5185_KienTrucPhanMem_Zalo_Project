package com.zalolite.chat.websocket;

import com.zalolite.chat.dto.ChatDtos.ReceiptRequest;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;
import com.zalolite.chat.dto.ChatDtos.TypingRequest;
import com.zalolite.chat.service.ConversationService;
import com.zalolite.chat.service.MessageService;
import com.zalolite.chat.service.RealtimeService;
import com.zalolite.common.core.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * STOMP entry points (client sends to /app/...). Results are never returned on the socket
 * directly: the services push them to the topics every interested client listens on.
 */
@Controller
public class ChatWebSocketController {
    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketController.class);

    private final MessageService messages;
    private final ConversationService conversations;
    private final RealtimeService realtime;

    public ChatWebSocketController(MessageService messages, ConversationService conversations,
                                   RealtimeService realtime) {
        this.messages = messages;
        this.conversations = conversations;
        this.realtime = realtime;
    }

    @MessageMapping("/chat.send")
    public void send(@Payload SendMessageRequest request, Principal principal) {
        try {
            messages.send(principal.getName(), request);
        } catch (BusinessException rejected) {
            // Tell the sender which optimistic message failed.
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("message", rejected.getMessage());
            error.put("clientMsgId", request.clientMsgId());
            realtime.toUsers(List.of(principal.getName()), "message.failed", request.conversationId(), error);
        }
    }

    @MessageMapping("/chat.typing")
    public void typing(@Payload TypingRequest request, Principal principal) {
        conversations.require(request.conversationId(), principal.getName());
        realtime.conversationEvent(request.conversationId(), "typing",
                Map.of("userId", principal.getName(), "typing", request.typing()));
    }

    @MessageMapping("/chat.seen")
    public void seen(@Payload ReceiptRequest request, Principal principal) {
        messages.receipt(principal.getName(), request, true);
    }

    @MessageMapping("/chat.delivered")
    public void delivered(@Payload ReceiptRequest request, Principal principal) {
        messages.receipt(principal.getName(), request, false);
    }

    @MessageExceptionHandler
    public void onError(Exception exception, Principal principal) {
        if (!(exception instanceof BusinessException)) {
            log.warn("WebSocket message failed", exception);
        }
        if (principal != null) {
            realtime.toUsers(List.of(principal.getName()), "error", null,
                    Map.of("message", exception instanceof BusinessException ? exception.getMessage() : "Yêu cầu không hợp lệ"));
        }
    }
}
