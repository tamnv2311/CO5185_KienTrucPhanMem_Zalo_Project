package com.zalolite.stats.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

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
    /** Copied from the event so the dashboard never has to call group-service. */
    private String groupName;
    private long messageCount;

    protected DailyGroupActivity() {}
    public DailyGroupActivity(LocalDate date, String groupId) { this.date = date; this.groupId = groupId; }
    public Long getId() { return id; }
    public LocalDate getDate() { return date; }
    public String getGroupId() { return groupId; }
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public long getMessageCount() { return messageCount; }
    public void addMessage() { messageCount++; }
}
