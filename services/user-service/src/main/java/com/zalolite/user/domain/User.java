package com.zalolite.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {
    @Id
    private String id;
    @Column(unique = true, nullable = false)
    private String email;
    @Column(unique = true, length = 20)
    private String phone;
    @Column(nullable = false)
    private String passwordHash;
    private String displayName;
    /** URL from media-service, or a small data URL. */
    @Lob
    @Column(length = 16_000_000)
    private String avatar;
    @Lob
    @Column(length = 16_000_000)
    private String cover;
    @Column(length = 500)
    private String bio;
    @Column(length = 10)
    private String gender;
    @Column(length = 10)
    private String birthday;
    private String status = "ACTIVE";
    private Instant createdAt = Instant.now();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public String getCover() { return cover; }
    public void setCover(String cover) { this.cover = cover; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getBirthday() { return birthday; }
    public void setBirthday(String birthday) { this.birthday = birthday; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
