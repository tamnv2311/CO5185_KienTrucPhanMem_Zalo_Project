package com.zalolite.chat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zalolite.chat.dto.ChatDtos.RealtimeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Collection;

/**
 * Pushes data to WebSocket clients. Every push goes through a Redis pub/sub channel that all
 * chat-service instances subscribe to, so a client connected to another instance still gets it.
 *
 * Destinations:
 *   /topic/conversations/{id}         new messages of one conversation (plain message JSON)
 *   /topic/conversations/{id}/events  typing, receipts, message updates of one conversation
 *   /topic/users/{userId}             everything a user must know about, whatever screen is open
 *   /topic/presence                   online/offline changes
 */
@Service
public class RealtimeService implements MessageListener {
    public static final String CHANNEL = "chat:fanout";
    private static final Logger log = LoggerFactory.getLogger(RealtimeService.class);

    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate broker;
    private final ObjectMapper mapper;

    public RealtimeService(StringRedisTemplate redis, SimpMessagingTemplate broker, ObjectMapper mapper) {
        this.redis = redis;
        this.broker = broker;
        this.mapper = mapper;
    }

    public void newMessage(String conversationId, Object message) {
        send("/topic/conversations/" + conversationId, message);
    }

    public void conversationEvent(String conversationId, String type, Object data) {
        send("/topic/conversations/" + conversationId + "/events", RealtimeEvent.of(type, conversationId, data));
    }

    public void toUsers(Collection<String> userIds, String type, String conversationId, Object data) {
        RealtimeEvent event = RealtimeEvent.of(type, conversationId, data);
        userIds.forEach(userId -> send("/topic/users/" + userId, event));
    }

    public void presence(Object data) {
        send("/topic/presence", RealtimeEvent.of("presence", null, data));
    }

    private void send(String destination, Object payload) {
        JsonNode body = mapper.valueToTree(payload);
        try {
            ObjectNode envelope = mapper.createObjectNode();
            envelope.put("destination", destination);
            envelope.set("payload", body);
            redis.convertAndSend(CHANNEL, mapper.writeValueAsString(envelope));
        } catch (Exception redisDown) {
            // Degrade to this instance only rather than dropping the push.
            log.warn("Redis fan-out failed ({}), delivering locally", redisDown.getMessage());
            broker.convertAndSend(destination, body);
        }
    }

    /** Called on every instance for every fan-out message. */
    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            JsonNode envelope = mapper.readTree(new String(message.getBody(), StandardCharsets.UTF_8));
            broker.convertAndSend(envelope.get("destination").asText(), envelope.get("payload"));
        } catch (Exception exception) {
            log.warn("Could not deliver fan-out message: {}", exception.getMessage());
        }
    }
}
