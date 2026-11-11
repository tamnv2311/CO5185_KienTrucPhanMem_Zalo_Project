package com.zalolite.common.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Publishes domain events to the shared topic exchange.
 * Publishing is asynchronous and best effort: a broker outage must never fail a user request.
 */
public class EventPublisher {
    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);

    private final RabbitTemplate rabbit;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "event-publisher");
        thread.setDaemon(true);
        return thread;
    });

    public EventPublisher(RabbitTemplate rabbit) {
        this.rabbit = rabbit;
    }

    public void publish(String type, Map<String, ?> payload) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", UUID.randomUUID().toString());
        event.put("type", type);
        event.put("occurredAt", Instant.now().toString());
        event.putAll(payload);
        executor.execute(() -> {
            try {
                rabbit.convertAndSend(Events.EXCHANGE, type, event);
            } catch (RuntimeException exception) {
                log.warn("Could not publish event {}: {}", type, exception.getMessage());
            }
        });
    }
}
