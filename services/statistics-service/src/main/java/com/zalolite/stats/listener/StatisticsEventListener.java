package com.zalolite.stats.listener;

import com.zalolite.stats.processor.IdempotencyService;
import com.zalolite.stats.service.AggregationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Idempotent consumer: every event is counted once, however often the broker redelivers it. */
@Component
public class StatisticsEventListener {
    private static final Logger log = LoggerFactory.getLogger(StatisticsEventListener.class);

    private final IdempotencyService idempotency;
    private final AggregationService aggregation;

    public StatisticsEventListener(IdempotencyService idempotency, AggregationService aggregation) {
        this.idempotency = idempotency;
        this.aggregation = aggregation;
    }

    @RabbitListener(queues = "stats.events")
    public void consume(@Payload Map<String, Object> event,
                        @Header(name = "type", required = false) String eventType) {
        String type = eventType == null ? String.valueOf(event.get("type")) : eventType;
        try {
            String eventId = String.valueOf(event.getOrDefault("eventId", event.get("id")));
            if (!idempotency.markProcessed(eventId)) {
                return;
            }
            switch (type) {
                case "message.sent" -> aggregation.recordMessage(
                        text(event.get("senderId")), text(event.get("groupId")), text(event.get("groupName")));
                case "user.registered" -> aggregation.recordUserRegistered(
                        text(event.get("userId")), text(event.get("displayName")));
                case "media.uploaded" -> aggregation.recordMedia(text(event.getOrDefault("kind", "FILE")));
                default -> { /* not a statistics event */ }
            }
        } catch (RuntimeException exception) {
            log.error("Could not aggregate event {}: {}", type, exception.getMessage(), exception);
        }
    }

    private static String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
