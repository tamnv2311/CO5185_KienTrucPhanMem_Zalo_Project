package com.zalolite.stats.domain;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "daily_group_activity", uniqueConstraints = @UniqueConstraint(columnNames = {"stat_date", "group_id"}))
public class DailyGroupActivity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "stat_date", nullable = false)
    private LocalDate date;
    @Column(name = "group_id", nullable = false)
    private String groupId;
    private long messageCount;
    protected DailyGroupActivity() {}
    public DailyGroupActivity(LocalDate date, String groupId) { this.date = date; this.groupId = groupId; }
    public Long getId() { return id; }
    public LocalDate getDate() { return date; }
    public String getGroupId() { return groupId; }
    public long getMessageCount() { return messageCount; }
    public void addMessage() { messageCount++; }
}
