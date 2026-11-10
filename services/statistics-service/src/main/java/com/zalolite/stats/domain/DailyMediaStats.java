package com.zalolite.stats.domain;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "daily_media_stats", uniqueConstraints = @UniqueConstraint(columnNames = {"stat_date", "media_kind"}))
public class DailyMediaStats {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "stat_date", nullable = false)
    private LocalDate date;
    @Column(name = "media_kind", nullable = false)
    private String mediaKind;
    private long count;
    protected DailyMediaStats() {}
    public DailyMediaStats(LocalDate date, String mediaKind) { this.date = date; this.mediaKind = mediaKind; }
    public Long getId() { return id; }
    public LocalDate getDate() { return date; }
    public String getMediaKind() { return mediaKind; }
    public long getCount() { return count; }
    public void increment() { count++; }
}
