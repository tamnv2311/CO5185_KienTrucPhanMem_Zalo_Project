package com.zalolite.stats.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

/** One row per user and day: the number of rows of a day is that day's active users. */
@Entity
@Table(name = "daily_user_activity", uniqueConstraints = @UniqueConstraint(columnNames = {"stat_date", "user_id"}))
public class DailyUserActivity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "stat_date", nullable = false)
    private LocalDate date;
    @Column(name = "user_id", nullable = false)
    private String userId;
    private long messageCount;

    protected DailyUserActivity() {}
    public DailyUserActivity(LocalDate date, String userId) { this.date = date; this.userId = userId; }
    public Long getId() { return id; }
    public LocalDate getDate() { return date; }
    public String getUserId() { return userId; }
    public long getMessageCount() { return messageCount; }
    public void addMessage() { messageCount++; }
}
