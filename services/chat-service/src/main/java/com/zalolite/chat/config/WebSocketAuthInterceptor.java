package com.zalolite.chat.config;

import com.zalolite.chat.service.ConversationService;
import com.zalolite.common.core.BusinessException;
import com.zalolite.common.security.JwtService;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;

/**
 * Security of the WebSocket channel:
 * CONNECT must carry a valid access token, and SUBSCRIBE is only allowed on the user's own
 * topic and on conversations the user belongs to.
 */
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {
    private static final String CONVERSATIONS = "/topic/conversations/";
    private static final String USERS = "/topic/users/";

    private final JwtService jwt;
    private final ConversationService conversations;

    // @Lazy breaks the cycle: broker config -> interceptor -> services -> messaging template.
    public WebSocketAuthInterceptor(JwtService jwt, @Lazy ConversationService conversations) {
        this.jwt = jwt;
        this.conversations = conversations;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscription(accessor.getUser(), accessor.getDestination());
        } else if (StompCommand.SEND.equals(accessor.getCommand()) && accessor.getUser() == null) {
            throw new MessagingException("Chưa đăng nhập");
        }
        return message;
    }

    private Principal authenticate(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new MessagingException("Thiếu access token");
        }
        try {
            String userId = jwt.accessUserId(authorization.substring(7));
            return () -> userId;
        } catch (RuntimeException invalid) {
            throw new MessagingException("Access token không hợp lệ hoặc đã hết hạn");
        }
    }

    private void authorizeSubscription(Principal user, String destination) {
        if (user == null || destination == null) {
            throw new MessagingException("Chưa đăng nhập");
        }
        if (destination.equals("/topic/presence")) {
            return;
        }
        if (destination.startsWith(USERS)) {
            if (!destination.substring(USERS.length()).equals(user.getName())) {
                throw new MessagingException("Không được theo dõi kênh của người khác");
            }
            return;
        }
        if (destination.startsWith(CONVERSATIONS)) {
            String conversationId = destination.substring(CONVERSATIONS.length());
            if (conversationId.endsWith("/events")) {
                conversationId = conversationId.substring(0, conversationId.length() - "/events".length());
            }
            try {
                conversations.require(conversationId, user.getName());
            } catch (BusinessException denied) {
                throw new MessagingException(denied.getMessage());
            }
            return;
        }
        throw new MessagingException("Kênh không hợp lệ");
    }
}
