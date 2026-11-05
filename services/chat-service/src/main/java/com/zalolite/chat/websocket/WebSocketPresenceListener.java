package com.zalolite.chat.websocket;

import com.zalolite.chat.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
public class WebSocketPresenceListener {
    private final PresenceService presence;

    public WebSocketPresenceListener(PresenceService presence) {
        this.presence = presence;
    }

    @EventListener
    public void connected(SessionConnectedEvent event) {
        Principal user = StompHeaderAccessor.wrap(event.getMessage()).getUser();
        if (user != null) {
            presence.connected(user.getName());
        }
    }

    @EventListener
    public void disconnected(SessionDisconnectEvent event) {
        Principal user = StompHeaderAccessor.wrap(event.getMessage()).getUser();
        if (user != null) {
            presence.disconnected(user.getName());
        }
    }
}
