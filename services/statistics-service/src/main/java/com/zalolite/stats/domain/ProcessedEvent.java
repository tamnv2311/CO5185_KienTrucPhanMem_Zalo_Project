package com.zalolite.stats.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "processed_events")
public class ProcessedEvent {
    @Id private String eventId;
    private Instant processedAt;
    protected ProcessedEvent() {}
    public ProcessedEvent(String eventId) { this.eventId = eventId; this.processedAt = Instant.now(); }
    public String getEventId() { return eventId; }
}
