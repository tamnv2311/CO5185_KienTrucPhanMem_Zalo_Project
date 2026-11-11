package com.zalolite.chat.dto;

import com.zalolite.chat.domain.Attachment;
import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.ConversationType;
import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessagePreview;
import com.zalolite.chat.domain.MessageStatus;
import com.zalolite.chat.domain.MessageType;
import com.zalolite.chat.domain.ReplyRef;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Request and response payloads of the chat service (REST and STOMP share them). */
public final class ChatDtos {
    private ChatDtos() {
    }

    public record SendMessageRequest(String conversationId, String clientMsgId, String content, String type,
                                     List<Attachment> attachments, String replyToId, List<String> mentions) {
    }

    /** Either seq, or messageId (the server resolves its seq). */
    public record ReceiptRequest(String conversationId, Long seq, String messageId) {
    }

    public record TypingRequest(String conversationId, boolean typing) {
    }

    public record ReactionRequest(String emoji) {
    }

    public record ForwardRequest(List<String> conversationIds) {
    }

    public record SettingsRequest(Boolean pinned, Boolean muted) {
    }

    public record PinRequest(boolean pinned) {
    }

    public record MessageResponse(String id, String conversationId, long seq, String clientMsgId, String senderId,
                                  MessageType type, String content, List<Attachment> attachments, ReplyRef replyTo,
                                  List<String> mentions, Map<String, List<String>> reactions, boolean recalled,
                                  boolean forwarded, MessageStatus status, Map<String, Object> meta,
                                  Instant createdAt) {
        public static MessageResponse of(Message message, Conversation conversation) {
            boolean recalled = message.isRecalled();
            return new MessageResponse(message.getId(), message.getConversationId(), message.getSeq(),
                    message.getClientMsgId(), message.getSenderId(), message.getType(),
                    recalled ? null : message.getContent(),
                    recalled ? List.of() : message.getAttachments(),
                    recalled ? null : message.getReplyTo(),
                    message.getMentions(), recalled ? Map.of() : message.getReactions(), recalled,
                    message.isForwarded(), MessageStatus.of(conversation, message), message.getMeta(),
                    message.getCreatedAt());
        }
    }

    public record ConversationResponse(String id, ConversationType type, String groupId, String peerId, String name,
                                       String avatar, List<String> memberIds, MessagePreview lastMessage,
                                       long lastSeq, long unreadCount, boolean pinned, boolean muted,
                                       List<String> pinnedMessageIds, Map<String, Long> readSeq,
                                       Instant createdAt, Instant updatedAt) {
        public static ConversationResponse of(Conversation conversation, String viewerId) {
            String peerId = conversation.getType() == ConversationType.DIRECT
                    ? conversation.getMemberIds().stream().filter(id -> !id.equals(viewerId)).findFirst().orElse(null)
                    : null;
            MessagePreview last = conversation.getLastMessage();
            if (last != null && last.seq() <= conversation.clearedSeqOf(viewerId)) {
                last = null;
            }
            return new ConversationResponse(conversation.getId(), conversation.getType(), conversation.getGroupId(),
                    peerId, conversation.getName(), conversation.getAvatar(), conversation.getMemberIds(), last,
                    conversation.getLastSeq(), conversation.unreadFor(viewerId),
                    conversation.getPinnedBy().contains(viewerId), conversation.getMutedBy().contains(viewerId),
                    conversation.getPinnedMessageIds(), conversation.getReadSeq(),
                    conversation.getCreatedAt(), conversation.getUpdatedAt());
        }
    }

    public record PresenceResponse(String userId, boolean online, Instant lastSeen) {
    }

    /** Envelope of everything pushed over WebSocket except new messages on a conversation topic. */
    public record RealtimeEvent(String type, String conversationId, Object data, Instant at) {
        public static RealtimeEvent of(String type, String conversationId, Object data) {
            return new RealtimeEvent(type, conversationId, data, Instant.now());
        }
    }
}
