package com.zalolite.chat.service;

import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.MessagePreview;
import com.zalolite.chat.dto.ChatDtos.ConversationResponse;

import java.util.List;
import java.util.Optional;

public interface ConversationService {
    /** Loads a conversation the user may access; throws 404/403 otherwise. */
    Conversation require(String conversationId, String userId);
    Optional<Conversation> find(String conversationId);

    ConversationResponse openDirect(String userId, String peerId);
    ConversationResponse openGroup(String userId, String groupId);
    List<ConversationResponse> list(String userId);
    ConversationResponse get(String userId, String conversationId);
    ConversationResponse updateSettings(String userId, String conversationId, Boolean pinned, Boolean muted);
    /** Hides the conversation and everything sent so far from this user only. */
    void clearHistory(String userId, String conversationId);

    /** Moves the user's read cursor forward (null seq = everything). Returns the refreshed conversation. */
    Conversation markRead(String userId, String conversationId, Long seq);
    Conversation markDelivered(String userId, String conversationId, Long seq);

    void setMessagePinned(Conversation conversation, String messageId, boolean pinned);
    /** Records a stored message as the newest one of its conversation. */
    void afterMessage(Conversation conversation, MessagePreview preview, String senderId);
    void replaceLastMessage(Conversation conversation, MessagePreview preview);

    // --- kept in sync with group-service through events ---
    Conversation syncGroup(String groupId, String name, String avatar, List<String> memberIds);
    void updateGroupInfo(String groupId, String name, String avatar);
    void addGroupMembers(String groupId, List<String> userIds);
    void removeGroupMember(String groupId, String userId);
    void deleteGroup(String groupId, List<String> memberIds);
}
