package com.zalolite.chat.websocket;

import com.zalolite.chat.domain.Message;
import com.zalolite.chat.dto.request.SendMessageRequest;
import com.zalolite.chat.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatWebSocketController {
    private final MessageService messages;
    private final SimpMessagingTemplate broker;

    public ChatWebSocketController(MessageService messages, SimpMessagingTemplate broker) {
        this.messages = messages;
        this.broker = broker;
    }

    @MessageMapping("/chat.send")
    public void send(@Valid SendMessageRequest request, Principal principal) {
        String userId = principal.getName();
        Message message = messages.send(request.conversationId(), userId,
                request.clientMsgId(), request.content());
        broker.convertAndSend("/topic/conversations/" + request.conversationId(), message);
    }

    @MessageMapping("/chat.seen")
    public void seen(String messageId, Principal principal) {
        broker.convertAndSend("/topic/messages/" + messageId, messages.markSeen(messageId, principal.getName()));
    }

    @MessageMapping("/chat.delivered")
    public void delivered(String messageId, Principal principal) {
        broker.convertAndSend("/topic/messages/" + messageId,
                messages.markDelivered(messageId, principal.getName()));
    }
}
