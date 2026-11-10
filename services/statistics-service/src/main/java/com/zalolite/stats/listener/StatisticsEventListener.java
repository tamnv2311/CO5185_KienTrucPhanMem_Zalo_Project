package com.zalolite.stats.listener;

import com.zalolite.stats.processor.IdempotencyService;
import com.zalolite.stats.service.AggregationService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class StatisticsEventListener {
    private final IdempotencyService idempotency;
    private final AggregationService aggregation;

    public StatisticsEventListener(IdempotencyService idempotency, AggregationService aggregation) {
        this.idempotency = idempotency;
        this.aggregation = aggregation;
    }

    @RabbitListener(queues = "stats.events")
    public void consume(@Payload Map<String, Object> event,
                        @Header(name = "type", required = false) String eventType) {
        String eventId = String.valueOf(event.getOrDefault("eventId", event.get("id")));
        if (!idempotency.markProcessed(eventId)) return;

        String type = eventType == null ? String.valueOf(event.get("type")) : eventType;
        if ("message.sent".equals(type)) aggregation.recordMessage(asString(event.get("groupId")));
        else if ("user.registered".equals(type)) aggregation.recordUserRegistered();
        else if ("media.uploaded".equals(type)) aggregation.recordMedia(asString(event.getOrDefault("kind", "DOCUMENT")));
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
