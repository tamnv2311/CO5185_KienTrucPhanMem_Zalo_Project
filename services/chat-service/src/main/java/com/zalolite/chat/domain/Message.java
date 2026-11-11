package com.zalolite.chat.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Document("messages")
public class Message {
    @Id
    private String id;
    private String conversationId;
    /** Monotonic per conversation: defines ordering and is the pagination cursor. */
    private long seq;
    /** Chosen by the client; (conversationId, clientMsgId) is unique so retries never duplicate. */
    private String clientMsgId;
    private String senderId;
    private MessageType type = MessageType.TEXT;
    private String content;
    private List<Attachment> attachments = new ArrayList<>();
    private ReplyRef replyTo;
    private List<String> mentions = new ArrayList<>();
    /** emoji -> user ids */
    private Map<String, List<String>> reactions = new LinkedHashMap<>();
    private boolean recalled;
    private boolean forwarded;
    /** Users who removed this message from their own view. */
    private Set<String> deletedFor = new HashSet<>();
    /** Extra data of system messages (actor, targets...). */
    private Map<String, Object> meta;
    private Instant createdAt = Instant.now();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public long getSeq() { return seq; }
    public void setSeq(long seq) { this.seq = seq; }
    public String getClientMsgId() { return clientMsgId; }
    public void setClientMsgId(String clientMsgId) { this.clientMsgId = clientMsgId; }
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public List<Attachment> getAttachments() { return attachments; }
    public void setAttachments(List<Attachment> attachments) { this.attachments = attachments; }
    public ReplyRef getReplyTo() { return replyTo; }
    public void setReplyTo(ReplyRef replyTo) { this.replyTo = replyTo; }
    public List<String> getMentions() { return mentions; }
    public void setMentions(List<String> mentions) { this.mentions = mentions; }
    public Map<String, List<String>> getReactions() { return reactions; }
    public void setReactions(Map<String, List<String>> reactions) { this.reactions = reactions; }
    public boolean isRecalled() { return recalled; }
    public void setRecalled(boolean recalled) { this.recalled = recalled; }
    public boolean isForwarded() { return forwarded; }
    public void setForwarded(boolean forwarded) { this.forwarded = forwarded; }
    public Set<String> getDeletedFor() { return deletedFor; }
    public void setDeletedFor(Set<String> deletedFor) { this.deletedFor = deletedFor; }
    public Map<String, Object> getMeta() { return meta; }
    public void setMeta(Map<String, Object> meta) { this.meta = meta; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
