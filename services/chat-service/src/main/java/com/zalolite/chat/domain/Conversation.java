package com.zalolite.chat.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A chat thread. Ids are deterministic so "open conversation" is idempotent:
 * a group conversation uses the group id, a direct one is derived from both user ids.
 */
@Document("conversations")
public class Conversation {
    @Id
    private String id;
    private ConversationType type;
    private List<String> memberIds = new ArrayList<>();
    private String groupId;
    /** Group name/avatar, copied from group events so the chat list needs no extra call. */
    private String name;
    private String avatar;
    private MessagePreview lastMessage;
    private long lastSeq;
    /** Per member: highest seq read / delivered / removed with "delete history". */
    private Map<String, Long> readSeq = new HashMap<>();
    private Map<String, Long> deliveredSeq = new HashMap<>();
    private Map<String, Long> clearedSeq = new HashMap<>();
    /** Per-member list settings. */
    private Set<String> pinnedBy = new HashSet<>();
    private Set<String> mutedBy = new HashSet<>();
    private Set<String> hiddenBy = new HashSet<>();
    private List<String> pinnedMessageIds = new ArrayList<>();
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public static String directId(String a, String b) {
        return a.compareTo(b) < 0 ? "dm_" + a + "_" + b : "dm_" + b + "_" + a;
    }

    public long readSeqOf(String userId) {
        return readSeq.getOrDefault(userId, 0L);
    }

    public long deliveredSeqOf(String userId) {
        return Math.max(deliveredSeq.getOrDefault(userId, 0L), readSeqOf(userId));
    }

    public long clearedSeqOf(String userId) {
        return clearedSeq.getOrDefault(userId, 0L);
    }

    public long unreadFor(String userId) {
        return Math.max(0, lastSeq - Math.max(readSeqOf(userId), clearedSeqOf(userId)));
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public ConversationType getType() { return type; }
    public void setType(ConversationType type) { this.type = type; }
    public List<String> getMemberIds() { return memberIds; }
    public void setMemberIds(List<String> memberIds) { this.memberIds = memberIds; }
    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public MessagePreview getLastMessage() { return lastMessage; }
    public void setLastMessage(MessagePreview lastMessage) { this.lastMessage = lastMessage; }
    public long getLastSeq() { return lastSeq; }
    public void setLastSeq(long lastSeq) { this.lastSeq = lastSeq; }
    public Map<String, Long> getReadSeq() { return readSeq; }
    public void setReadSeq(Map<String, Long> readSeq) { this.readSeq = readSeq; }
    public Map<String, Long> getDeliveredSeq() { return deliveredSeq; }
    public void setDeliveredSeq(Map<String, Long> deliveredSeq) { this.deliveredSeq = deliveredSeq; }
    public Map<String, Long> getClearedSeq() { return clearedSeq; }
    public void setClearedSeq(Map<String, Long> clearedSeq) { this.clearedSeq = clearedSeq; }
    public Set<String> getPinnedBy() { return pinnedBy; }
    public void setPinnedBy(Set<String> pinnedBy) { this.pinnedBy = pinnedBy; }
    public Set<String> getMutedBy() { return mutedBy; }
    public void setMutedBy(Set<String> mutedBy) { this.mutedBy = mutedBy; }
    public Set<String> getHiddenBy() { return hiddenBy; }
    public void setHiddenBy(Set<String> hiddenBy) { this.hiddenBy = hiddenBy; }
    public List<String> getPinnedMessageIds() { return pinnedMessageIds; }
    public void setPinnedMessageIds(List<String> pinnedMessageIds) { this.pinnedMessageIds = pinnedMessageIds; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
