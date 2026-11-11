package com.zalolite.chat.service;

import com.zalolite.chat.client.GroupClient;
import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.ConversationType;
import com.zalolite.chat.domain.MessagePreview;
import com.zalolite.chat.dto.ChatDtos.ConversationResponse;
import com.zalolite.chat.repository.ConversationRepository;
import com.zalolite.chat.repository.MessageRepository;
import com.zalolite.common.core.BusinessException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Conversation state is changed with targeted MongoDB updates ($set/$max/$addToSet) instead of
 * load-modify-save, so concurrent senders and readers never overwrite each other's cursors.
 */
@Service
public class ConversationServiceImpl implements ConversationService {
    private static final int MAX_PINNED_MESSAGES = 3;

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final MongoTemplate mongo;
    private final GroupClient groups;
    private final RealtimeService realtime;

    public ConversationServiceImpl(ConversationRepository conversations, MessageRepository messages,
                                   MongoTemplate mongo, GroupClient groups, RealtimeService realtime) {
        this.conversations = conversations;
        this.messages = messages;
        this.mongo = mongo;
        this.groups = groups;
        this.realtime = realtime;
    }

    @Override
    public Conversation require(String conversationId, String userId) {
        if (conversationId == null || conversationId.isBlank()) {
            throw new BusinessException(422, "Thiếu mã cuộc trò chuyện");
        }
        Conversation conversation = find(conversationId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy cuộc trò chuyện"));
        if (!conversation.getMemberIds().contains(userId)) {
            // The membership event may not have arrived yet: ask group-service before refusing.
            boolean member = conversation.getType() == ConversationType.GROUP
                    && groups.canAccess(conversation.getGroupId(), userId);
            if (!member) {
                throw BusinessException.forbidden("Bạn không ở trong cuộc trò chuyện này");
            }
            update(conversationId, new Update().addToSet("memberIds", userId));
            conversation.getMemberIds().add(userId);
        }
        return conversation;
    }

    /** A group conversation is created on first use when its group.created event has not been seen. */
    @Override
    public Optional<Conversation> find(String conversationId) {
        Optional<Conversation> existing = conversations.findById(conversationId);
        if (existing.isPresent() || conversationId.startsWith("dm_")) {
            return existing;
        }
        return groups.find(conversationId)
                .map(group -> syncGroup(group.id(), group.name(), group.avatar(), group.memberIds()));
    }

    @Override
    public ConversationResponse openDirect(String userId, String peerId) {
        if (peerId == null || peerId.isBlank()) {
            throw new BusinessException(422, "Thiếu người nhận");
        }
        if (userId.equals(peerId)) {
            throw new BusinessException("Không thể tự trò chuyện với chính mình");
        }
        String id = Conversation.directId(userId, peerId);
        Instant now = Instant.now();
        Conversation conversation = mongo.findAndModify(byId(id), new Update()
                        .setOnInsert("type", ConversationType.DIRECT)
                        .setOnInsert("memberIds", List.of(userId, peerId))
                        .setOnInsert("lastSeq", 0L)
                        .setOnInsert("createdAt", now)
                        .setOnInsert("updatedAt", now),
                FindAndModifyOptions.options().upsert(true).returnNew(true), Conversation.class);
        update(id, new Update().pull("hiddenBy", userId));
        return ConversationResponse.of(conversation, userId);
    }

    @Override
    public ConversationResponse openGroup(String userId, String groupId) {
        return ConversationResponse.of(require(groupId, userId), userId);
    }

    @Override
    public List<ConversationResponse> list(String userId) {
        List<ConversationResponse> result = new ArrayList<>();
        for (Conversation conversation : conversations.findByMemberIdsContainingOrderByUpdatedAtDesc(userId)) {
            boolean empty = conversation.getLastSeq() <= conversation.clearedSeqOf(userId);
            boolean hidden = conversation.getHiddenBy().contains(userId);
            if (hidden || (empty && conversation.getType() == ConversationType.DIRECT)) {
                continue;
            }
            result.add(ConversationResponse.of(conversation, userId));
        }
        // Pinned conversations stay on top, like in Zalo; the rest keep "newest first".
        result.sort(Comparator.comparing(ConversationResponse::pinned).reversed());
        return result;
    }

    @Override
    public ConversationResponse get(String userId, String conversationId) {
        return ConversationResponse.of(require(conversationId, userId), userId);
    }

    @Override
    public ConversationResponse updateSettings(String userId, String conversationId, Boolean pinned, Boolean muted) {
        require(conversationId, userId);
        if (pinned != null) {
            update(conversationId, pinned ? new Update().addToSet("pinnedBy", userId) : new Update().pull("pinnedBy", userId));
        }
        if (muted != null) {
            update(conversationId, muted ? new Update().addToSet("mutedBy", userId) : new Update().pull("mutedBy", userId));
        }
        return get(userId, conversationId);
    }

    @Override
    public void clearHistory(String userId, String conversationId) {
        Conversation conversation = require(conversationId, userId);
        update(conversationId, new Update()
                .set("clearedSeq." + userId, conversation.getLastSeq())
                .max("readSeq." + userId, conversation.getLastSeq())
                .addToSet("hiddenBy", userId));
    }

    @Override
    public Conversation markRead(String userId, String conversationId, Long seq) {
        Conversation conversation = require(conversationId, userId);
        long target = seq == null ? conversation.getLastSeq() : Math.min(seq, conversation.getLastSeq());
        if (target <= conversation.readSeqOf(userId)) {
            return conversation;
        }
        update(conversationId, new Update().max("readSeq." + userId, target).max("deliveredSeq." + userId, target));
        conversation.getReadSeq().put(userId, target);
        publishReceipt(conversation, userId);
        return conversation;
    }

    @Override
    public Conversation markDelivered(String userId, String conversationId, Long seq) {
        Conversation conversation = require(conversationId, userId);
        long target = seq == null ? conversation.getLastSeq() : Math.min(seq, conversation.getLastSeq());
        if (target <= conversation.deliveredSeqOf(userId)) {
            return conversation;
        }
        update(conversationId, new Update().max("deliveredSeq." + userId, target));
        conversation.getDeliveredSeq().put(userId, target);
        publishReceipt(conversation, userId);
        return conversation;
    }

    private void publishReceipt(Conversation conversation, String userId) {
        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("userId", userId);
        receipt.put("readSeq", conversation.readSeqOf(userId));
        receipt.put("deliveredSeq", conversation.deliveredSeqOf(userId));
        realtime.conversationEvent(conversation.getId(), "receipt", receipt);
        // Direct chats: both sides get it even with the conversation closed (ticks in the chat list).
        // Groups: only the reader's other devices, to keep big groups quiet.
        List<String> targets = conversation.getType() == ConversationType.DIRECT
                ? conversation.getMemberIds() : List.of(userId);
        realtime.toUsers(targets, "receipt", conversation.getId(), receipt);
    }

    @Override
    public void setMessagePinned(Conversation conversation, String messageId, boolean pinned) {
        List<String> pins = new ArrayList<>(conversation.getPinnedMessageIds());
        if (pinned) {
            if (pins.contains(messageId)) {
                return;
            }
            if (pins.size() >= MAX_PINNED_MESSAGES) {
                throw BusinessException.conflict("Chỉ ghim được tối đa " + MAX_PINNED_MESSAGES + " tin nhắn");
            }
            pins.add(0, messageId);
        } else if (!pins.remove(messageId)) {
            return;
        }
        update(conversation.getId(), new Update().set("pinnedMessageIds", pins));
        conversation.setPinnedMessageIds(pins);
        Map<String, Object> data = Map.of("pinnedMessageIds", pins);
        realtime.conversationEvent(conversation.getId(), "conversation.pins", data);
        realtime.toUsers(conversation.getMemberIds(), "conversation.pins", conversation.getId(), data);
    }

    @Override
    public void afterMessage(Conversation conversation, MessagePreview preview, String senderId) {
        Update update = new Update()
                .set("lastMessage", preview)
                .max("lastSeq", preview.seq())
                .set("updatedAt", preview.createdAt())
                .set("hiddenBy", List.of());
        if (conversation.getMemberIds().contains(senderId)) {
            update.max("readSeq." + senderId, preview.seq());
            conversation.getReadSeq().put(senderId, preview.seq());
        } else {
            // A system line ("An đã thêm Bình vào nhóm") must not show up as an unread message:
            // members who had read everything stay fully read.
            long previous = conversation.getLastSeq();
            for (String memberId : conversation.getMemberIds()) {
                if (conversation.readSeqOf(memberId) >= previous) {
                    update.max("readSeq." + memberId, preview.seq());
                    conversation.getReadSeq().put(memberId, preview.seq());
                }
            }
        }
        update(conversation.getId(), update);
        conversation.setLastMessage(preview);
        conversation.setLastSeq(Math.max(conversation.getLastSeq(), preview.seq()));
        conversation.setUpdatedAt(preview.createdAt());
    }

    @Override
    public void replaceLastMessage(Conversation conversation, MessagePreview preview) {
        update(conversation.getId(), new Update().set("lastMessage", preview));
        conversation.setLastMessage(preview);
    }

    @Override
    public Conversation syncGroup(String groupId, String name, String avatar, List<String> memberIds) {
        Instant now = Instant.now();
        Update update = new Update()
                .setOnInsert("type", ConversationType.GROUP)
                .setOnInsert("groupId", groupId)
                .setOnInsert("lastSeq", 0L)
                .setOnInsert("createdAt", now)
                .setOnInsert("updatedAt", now)
                .set("name", name)
                .set("memberIds", memberIds);
        if (avatar != null) {
            update.set("avatar", avatar);
        }
        return mongo.findAndModify(byId(groupId), update,
                FindAndModifyOptions.options().upsert(true).returnNew(true), Conversation.class);
    }

    @Override
    public void updateGroupInfo(String groupId, String name, String avatar) {
        find(groupId).ifPresent(conversation -> {
            Update update = new Update().set("name", name);
            if (avatar == null) {
                update.unset("avatar");
            } else {
                update.set("avatar", avatar);
            }
            update(groupId, update);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("name", name);
            data.put("avatar", avatar);
            realtime.toUsers(conversation.getMemberIds(), "conversation.updated", groupId, data);
        });
    }

    @Override
    public void addGroupMembers(String groupId, List<String> userIds) {
        find(groupId).ifPresent(conversation -> {
            update(groupId, new Update().addToSet("memberIds").each(userIds.toArray()));
            realtime.toUsers(userIds, "conversation.added", groupId, Map.of("groupId", groupId));
        });
    }

    @Override
    public void removeGroupMember(String groupId, String userId) {
        update(groupId, new Update().pull("memberIds", userId)
                .unset("readSeq." + userId).unset("deliveredSeq." + userId).unset("clearedSeq." + userId)
                .pull("pinnedBy", userId).pull("mutedBy", userId).pull("hiddenBy", userId));
        realtime.toUsers(List.of(userId), "conversation.removed", groupId, Map.of("reason", "removed"));
    }

    @Override
    public void deleteGroup(String groupId, List<String> memberIds) {
        messages.deleteByConversationId(groupId);
        conversations.deleteById(groupId);
        realtime.toUsers(memberIds, "conversation.removed", groupId, Map.of("reason", "deleted"));
    }

    private void update(String conversationId, Update update) {
        mongo.updateFirst(byId(conversationId), update, Conversation.class);
    }

    private static Query byId(String id) {
        return Query.query(Criteria.where("_id").is(id));
    }
}
