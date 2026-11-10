package com.zalolite.stats.domain;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "daily_system_stats", uniqueConstraints = @UniqueConstraint(columnNames = "stat_date"))
public class DailySystemStats {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "stat_date", nullable = false)
    private LocalDate date;
    private long totalMessages;
    private long activeUsers;
    private long newUsers;
    private long totalMedia;

    protected DailySystemStats() {}
    public DailySystemStats(LocalDate date) { this.date = date; }
    public Long getId() { return id; }
    public LocalDate getDate() { return date; }
    public long getTotalMessages() { return totalMessages; }
    public long getActiveUsers() { return activeUsers; }
    public long getNewUsers() { return newUsers; }
    public long getTotalMedia() { return totalMedia; }
    public void addMessage() { totalMessages++; }
    public void addNewUser() { newUsers++; }
    public void addMedia() { totalMedia++; }
    public void setActiveUsers(long activeUsers) { this.activeUsers = activeUsers; }
}
