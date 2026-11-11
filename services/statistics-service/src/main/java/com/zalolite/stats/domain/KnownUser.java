package com.zalolite.stats.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Display names learnt from user.registered events, for the "most active users" chart. */
@Entity
@Table(name = "known_users")
public class KnownUser {
    @Id
    private String userId;
    private String displayName;

    protected KnownUser() {}
    public KnownUser(String userId, String displayName) { this.userId = userId; this.displayName = displayName; }
    public String getUserId() { return userId; }
    public String getDisplayName() { return displayName; }
}
