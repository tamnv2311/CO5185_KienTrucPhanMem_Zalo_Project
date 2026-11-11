package com.zalolite.group.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(name = "group_members",
        uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "user_id"}),
        indexes = @Index(columnList = "user_id"))
public class GroupMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "group_id", nullable = false)
    private String groupId;
    @Column(name = "user_id", nullable = false)
    private String userId;
    @Enumerated(EnumType.STRING)
    private GroupRole role;
    private Instant joinedAt = Instant.now();

    public Long getId() { return id; }
    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public GroupRole getRole() { return role; }
    public void setRole(GroupRole role) { this.role = role; }
    public Instant getJoinedAt() { return joinedAt; }
}
