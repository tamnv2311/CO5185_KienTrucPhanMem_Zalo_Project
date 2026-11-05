package com.zalolite.chat.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Document("conversations")
public class Conversation {
    @Id
    private String id;
    private ConversationType type;
    private List<String> memberIds = new ArrayList<>();
    private Message lastMessage;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public ConversationType getType() { return type; }
    public void setType(ConversationType type) { this.type = type; }
    public List<String> getMemberIds() { return memberIds; }
    public void setMemberIds(List<String> memberIds) { this.memberIds = memberIds; }
    public Message getLastMessage() { return lastMessage; }
    public void setLastMessage(Message lastMessage) { this.lastMessage = lastMessage; }
}
