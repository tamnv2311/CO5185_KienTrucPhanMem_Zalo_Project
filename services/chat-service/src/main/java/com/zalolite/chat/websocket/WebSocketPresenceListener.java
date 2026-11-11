package com.zalolite.chat.websocket;

import com.zalolite.chat.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/** Observer of the WebSocket session lifecycle: open/close of a session drives presence. */
@Component
public class WebSocketPresenceListener {
    private final PresenceService presence;

    public WebSocketPresenceListener(PresenceService presence) {
        this.presence = presence;
    }

    @EventListener
    public void connected(SessionConnectedEvent event) {
        Principal user = event.getUser();
        String sessionId = SimpMessageHeaderAccessor.getSessionId(event.getMessage().getHeaders());
        if (user != null && sessionId != null) {
            presence.connected(user.getName(), sessionId);
        }
    }

    @EventListener
    public void disconnected(SessionDisconnectEvent event) {
        Principal user = event.getUser();
        if (user != null) {
            presence.disconnected(user.getName(), event.getSessionId());
        }
    }
}
