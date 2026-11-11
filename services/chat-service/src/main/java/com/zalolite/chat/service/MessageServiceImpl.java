package com.zalolite.chat.service;

import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.ConversationType;
import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessagePreview;
import com.zalolite.chat.domain.MessageType;
import com.zalolite.chat.domain.ReplyRef;
import com.zalolite.chat.dto.ChatDtos.MessageResponse;
import com.zalolite.chat.dto.ChatDtos.ReceiptRequest;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;
import com.zalolite.chat.message.MessageHandlerFactory;
import com.zalolite.chat.repository.MessageRepository;
import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.common.events.Events;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class MessageServiceImpl implements MessageService {
    public static final String SYSTEM_SENDER = "system";
    private static final int MAX_FORWARD_TARGETS = 10;

    private final ConversationService conversations;
    private final MessageRepository messages;
    private final MongoTemplate mongo;
    private final SequenceService sequences;
    private final MessageHandlerFactory handlers;
    private final RealtimeService realtime;
    private final EventPublisher events;

    public MessageServiceImpl(ConversationService conversations, MessageRepository messages, MongoTemplate mongo,
                              SequenceService sequences, MessageHandlerFactory handlers, RealtimeService realtime,
                              EventPublisher events) {
        this.conversations = conversations;
        this.messages = messages;
        this.mongo = mongo;
        this.sequences = sequences;
        this.handlers = handlers;
        this.realtime = realtime;
        this.events = events;
    }

    @Override
    public MessageResponse send(String senderId, SendMessageRequest request) {
        Conversation conversation = conversations.require(request.conversationId(), senderId);
        String clientMsgId = request.clientMsgId() == null || request.clientMsgId().isBlank()
                ? UUID.randomUUID().toString() : request.clientMsgId();
        Optional<Message> duplicate = messages.findByConversationIdAndClientMsgId(conversation.getId(), clientMsgId);
        if (duplicate.isPresent()) {
            return MessageResponse.of(duplicate.get(), conversation);
        }

        Message message = new Message();
        message.setConversationId(conversation.getId());
        message.setSenderId(senderId);
        message.setClientMsgId(clientMsgId);
        message.setType(MessageType.parse(request.type()));
        handlers.forType(message.getType()).apply(message, request);
        if (request.replyToId() != null && !request.replyToId().isBlank()) {
            messages.findById(request.replyToId())
                    .filter(original -> original.getConversationId().equals(conversation.getId()))
                    .ifPresent(original -> message.setReplyTo(new ReplyRef(original.getId(),
                            original.getSenderId(), original.getType(), handlers.preview(original))));
        }
        if (request.mentions() != null) {
            message.setMentions(request.mentions().stream()
                    .filter(id -> "all".equals(id) || conversation.getMemberIds().contains(id))
                    .distinct().toList());
        }
        return store(conversation, message);
    }

    @Override
    public void sendSystem(String conversationId, String content, Map<String, Object> meta) {
        conversations.find(conversationId).ifPresent(conversation -> {
            Message message = new Message();
            message.setConversationId(conversationId);
            message.setSenderId(SYSTEM_SENDER);
            message.setClientMsgId(UUID.randomUUID().toString());
            message.setType(MessageType.SYSTEM);
            message.setContent(content);
            message.setMeta(meta);
            store(conversation, message);
        });
    }

    /** Assigns the next seq, persists, updates the conversation, then pushes and publishes. */
    private MessageResponse store(Conversation conversation, Message message) {
        message.setSeq(sequences.next(conversation.getId(), conversation.getLastSeq()));
        Message saved;
        try {
            saved = messages.save(message);
        } catch (DuplicateKeyException retryRace) {
            // The unique (conversationId, clientMsgId) index caught a concurrent retry.
            Message existing = messages.findByConversationIdAndClientMsgId(
                    message.getConversationId(), message.getClientMsgId()).orElseThrow(() -> retryRace);
            return MessageResponse.of(existing, conversation);
        }
        conversations.afterMessage(conversation, preview(saved), saved.getSenderId());

        MessageResponse response = MessageResponse.of(saved, conversation);
        realtime.newMessage(conversation.getId(), response);
        realtime.toUsers(conversation.getMemberIds(), "message.new", conversation.getId(), response);

        if (saved.getType() != MessageType.SYSTEM) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("messageId", saved.getId());
            payload.put("conversationId", conversation.getId());
            payload.put("conversationType", conversation.getType().name());
            if (conversation.getType() == ConversationType.GROUP) {
                payload.put("groupId", conversation.getGroupId());
                payload.put("groupName", conversation.getName());
            }
            payload.put("senderId", saved.getSenderId());
            payload.put("messageType", saved.getType().name());
            events.publish(Events.MESSAGE_SENT, payload);
        }
        return response;
    }

    @Override
    public List<MessageResponse> history(String userId, String conversationId, int limit, Long beforeSeq, Long afterSeq) {
        Conversation conversation = conversations.require(conversationId, userId);
        int pageSize = Math.max(1, Math.min(limit, 100));
        long floor = conversation.clearedSeqOf(userId);
        boolean forward = afterSeq != null;
        if (forward) {
            floor = Math.max(floor, afterSeq);
        }
        Criteria seq = Criteria.where("seq").gt(floor);
        if (beforeSeq != null) {
            seq = seq.lt(beforeSeq);
        }
        Query query = new Query(new Criteria().andOperator(
                Criteria.where("conversationId").is(conversation.getId()), seq,
                Criteria.where("deletedFor").ne(userId)))
                .with(Sort.by(forward ? Sort.Direction.ASC : Sort.Direction.DESC, "seq"))
                .limit(pageSize);
        List<Message> page = new ArrayList<>(mongo.find(query, Message.class));
        if (!forward) {
            Collections.reverse(page);
        }
        return toResponses(page, conversation);
    }

    @Override
    public List<MessageResponse> search(String userId, String conversationId, String keyword) {
        Conversation conversation = conversations.require(conversationId, userId);
        if (keyword == null || keyword.isBlank()) {
            return List.of();
        }
        Query query = new Query(new Criteria().andOperator(
                Criteria.where("conversationId").is(conversation.getId()),
                Criteria.where("seq").gt(conversation.clearedSeqOf(userId)),
                Criteria.where("recalled").ne(true),
                Criteria.where("type").ne(MessageType.SYSTEM),
                Criteria.where("deletedFor").ne(userId),
                Criteria.where("content").regex(Pattern.quote(keyword.trim()), "i")))
                .with(Sort.by(Sort.Direction.DESC, "seq")).limit(50);
        return toResponses(mongo.find(query, Message.class), conversation);
    }

    @Override
    public List<MessageResponse> pinned(String userId, String conversationId) {
        Conversation conversation = conversations.require(conversationId, userId);
        List<Message> found = new ArrayList<>();
        for (String id : conversation.getPinnedMessageIds()) {
            messages.findById(id).filter(message -> !message.isRecalled()).ifPresent(found::add);
        }
        return toResponses(found, conversation);
    }

    @Override
    public MessageResponse recall(String userId, String messageId) {
        Message message = requireMessage(messageId);
        Conversation conversation = conversations.require(message.getConversationId(), userId);
        if (!userId.equals(message.getSenderId())) {
            throw BusinessException.forbidden("Chỉ người gửi mới thu hồi được tin nhắn");
        }
        if (!message.isRecalled()) {
            message.setRecalled(true);
            messages.save(message);
            if (conversation.getPinnedMessageIds().contains(messageId)) {
                conversations.setMessagePinned(conversation, messageId, false);
            }
            if (conversation.getLastMessage() != null && messageId.equals(conversation.getLastMessage().id())) {
                conversations.replaceLastMessage(conversation, preview(message));
            }
        }
        return publishUpdate(conversation, message);
    }

    @Override
    public void deleteForMe(String userId, String messageId) {
        Message message = requireMessage(messageId);
        conversations.require(message.getConversationId(), userId);
        message.getDeletedFor().add(userId);
        messages.save(message);
    }

    @Override
    public MessageResponse react(String userId, String messageId, String emoji) {
        Message message = requireMessage(messageId);
        Conversation conversation = conversations.require(message.getConversationId(), userId);
        if (message.isRecalled() || message.getType() == MessageType.SYSTEM) {
            throw new BusinessException("Không thể thả cảm xúc cho tin nhắn này");
        }
        Map<String, List<String>> reactions = new LinkedHashMap<>(message.getReactions());
        if (emoji == null || emoji.isBlank()) {
            reactions.replaceAll((key, users) -> users.stream().filter(id -> !id.equals(userId)).toList());
        } else {
            if (emoji.length() > 16 || emoji.contains(".") || emoji.startsWith("$")) {
                throw new BusinessException(422, "Biểu tượng cảm xúc không hợp lệ");
            }
            List<String> users = new ArrayList<>(reactions.getOrDefault(emoji, List.of()));
            if (!users.remove(userId)) {
                users.add(userId);
            }
            reactions.put(emoji, users);
        }
        reactions.values().removeIf(List::isEmpty);
        message.setReactions(reactions);
        messages.save(message);
        return publishUpdate(conversation, message);
    }

    @Override
    public List<MessageResponse> forward(String userId, String messageId, List<String> conversationIds) {
        Message source = requireMessage(messageId);
        conversations.require(source.getConversationId(), userId);
        if (source.isRecalled() || source.getType() == MessageType.SYSTEM) {
            throw new BusinessException("Không thể chuyển tiếp tin nhắn này");
        }
        if (conversationIds == null || conversationIds.isEmpty()) {
            throw new BusinessException(422, "Chưa chọn nơi chuyển tiếp");
        }
        List<MessageResponse> result = new ArrayList<>();
        for (String targetId : new LinkedHashSet<>(conversationIds).stream().limit(MAX_FORWARD_TARGETS).toList()) {
            Conversation target = conversations.require(targetId, userId);
            Message copy = new Message();
            copy.setConversationId(target.getId());
            copy.setSenderId(userId);
            copy.setClientMsgId(UUID.randomUUID().toString());
            copy.setType(source.getType());
            copy.setContent(source.getContent());
            copy.setAttachments(source.getAttachments());
            copy.setForwarded(true);
            result.add(store(target, copy));
        }
        return result;
    }

    @Override
    public MessageResponse pin(String userId, String messageId, boolean pinned) {
        Message message = requireMessage(messageId);
        Conversation conversation = conversations.require(message.getConversationId(), userId);
        if (pinned && (message.isRecalled() || message.getType() == MessageType.SYSTEM)) {
            throw new BusinessException("Không thể ghim tin nhắn này");
        }
        conversations.setMessagePinned(conversation, messageId, pinned);
        return MessageResponse.of(message, conversation);
    }

    @Override
    public MessageResponse markSeen(String userId, String messageId) {
        Message message = requireMessage(messageId);
        return MessageResponse.of(message, conversations.markRead(userId, message.getConversationId(), message.getSeq()));
    }

    @Override
    public MessageResponse markDelivered(String userId, String messageId) {
        Message message = requireMessage(messageId);
        return MessageResponse.of(message, conversations.markDelivered(userId, message.getConversationId(), message.getSeq()));
    }

    @Override
    public void receipt(String userId, ReceiptRequest request, boolean seen) {
        String conversationId = request.conversationId();
        Long seq = request.seq();
        if (request.messageId() != null && !request.messageId().isBlank()) {
            Message message = requireMessage(request.messageId());
            conversationId = message.getConversationId();
            seq = message.getSeq();
        }
        if (seen) {
            conversations.markRead(userId, conversationId, seq);
        } else {
            conversations.markDelivered(userId, conversationId, seq);
        }
    }

    private MessageResponse publishUpdate(Conversation conversation, Message message) {
        MessageResponse response = MessageResponse.of(message, conversation);
        realtime.conversationEvent(conversation.getId(), "message.updated", response);
        realtime.toUsers(conversation.getMemberIds(), "message.updated", conversation.getId(), response);
        return response;
    }

    private MessagePreview preview(Message message) {
        return new MessagePreview(message.getId(), message.getSeq(), message.getSenderId(), message.getType(),
                handlers.preview(message), message.getCreatedAt());
    }

    private Message requireMessage(String messageId) {
        return messages.findById(messageId).orElseThrow(() -> BusinessException.notFound("Không tìm thấy tin nhắn"));
    }

    private static List<MessageResponse> toResponses(List<Message> page, Conversation conversation) {
        return page.stream().map(message -> MessageResponse.of(message, conversation)).toList();
    }
}
