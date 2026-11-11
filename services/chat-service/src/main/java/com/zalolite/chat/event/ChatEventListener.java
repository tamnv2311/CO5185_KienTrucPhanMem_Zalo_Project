package com.zalolite.chat.event;

import com.zalolite.chat.config.ChatConfig;
import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.service.ConversationService;
import com.zalolite.chat.service.MessageService;
import com.zalolite.chat.service.RealtimeService;
import com.zalolite.common.events.Events;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Keeps chat data consistent with user-service and group-service without calling them:
 * group membership is mirrored into the group conversation, and every change becomes a
 * system message plus a realtime notification.
 */
@Component
public class ChatEventListener {
    private static final Logger log = LoggerFactory.getLogger(ChatEventListener.class);

    private final ConversationService conversations;
    private final MessageService messages;
    private final RealtimeService realtime;

    public ChatEventListener(ConversationService conversations, MessageService messages, RealtimeService realtime) {
        this.conversations = conversations;
        this.messages = messages;
        this.realtime = realtime;
    }

    @RabbitListener(queues = ChatConfig.EVENTS_QUEUE)
    public void on(Map<String, Object> event) {
        String type = text(event, "type");
        try {
            handle(type == null ? "" : type, event);
        } catch (RuntimeException exception) {
            log.error("Could not apply event {}: {}", type, exception.getMessage(), exception);
        }
    }

    private void handle(String type, Map<String, Object> event) {
        String groupId = text(event, "groupId");
        String actor = text(event, "actorName");
        switch (type) {
            case Events.GROUP_CREATED -> {
                conversations.syncGroup(groupId, text(event, "name"), text(event, "avatar"), list(event, "memberIds"));
                system(groupId, actor + " đã tạo nhóm", "group.created", event);
            }
            case Events.GROUP_UPDATED -> {
                conversations.updateGroupInfo(groupId, text(event, "name"), text(event, "avatar"));
                system(groupId, actor + " đã cập nhật thông tin nhóm", "group.updated", event);
            }
            case Events.GROUP_MEMBER_ADDED -> {
                conversations.addGroupMembers(groupId, list(event, "userIds"));
                system(groupId, actor + " đã thêm " + String.join(", ", list(event, "userNames")) + " vào nhóm",
                        "group.member_added", event);
            }
            case Events.GROUP_MEMBER_REMOVED -> {
                boolean left = "left".equals(text(event, "reason"));
                conversations.removeGroupMember(groupId, text(event, "userId"));
                system(groupId, left ? text(event, "userName") + " đã rời nhóm"
                        : actor + " đã xóa " + text(event, "userName") + " khỏi nhóm", "group.member_removed", event);
            }
            case Events.GROUP_ROLE_CHANGED -> {
                String role = switch (String.valueOf(event.get("role"))) {
                    case "OWNER" -> "trưởng nhóm";
                    case "ADMIN" -> "phó nhóm";
                    default -> "thành viên";
                };
                system(groupId, text(event, "userName") + " đã trở thành " + role, "group.role_changed", event);
            }
            case Events.GROUP_DELETED -> conversations.deleteGroup(groupId, list(event, "memberIds"));
            case Events.FRIEND_REQUESTED ->
                    realtime.toUsers(List.of(text(event, "recipientId")), "friend.requested", null, event);
            case Events.FRIEND_ACCEPTED -> friendAccepted(event);
            case Events.FRIEND_REMOVED -> realtime.toUsers(
                    List.of(text(event, "requesterId"), text(event, "recipientId")), "friend.removed", null, event);
            default -> log.debug("Ignoring event {}", type);
        }
    }

    /** New friends get their 1-1 conversation right away, with a greeting line like in Zalo. */
    private void friendAccepted(Map<String, Object> event) {
        String requester = text(event, "requesterId");
        String recipient = text(event, "recipientId");
        realtime.toUsers(List.of(requester, recipient), "friend.accepted", null, event);
        conversations.openDirect(requester, recipient);
        String conversationId = Conversation.directId(requester, recipient);
        boolean empty = conversations.find(conversationId).map(found -> found.getLastSeq() == 0).orElse(false);
        if (empty) {
            system(conversationId, "Hai bạn đã trở thành bạn bè. Hãy gửi lời chào!", "friend.accepted", event);
        }
    }

    private void system(String conversationId, String content, String kind, Map<String, Object> event) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("kind", kind);
        for (String key : List.of("actorId", "actorName", "userId", "userName", "userIds", "userNames", "role", "reason", "name")) {
            if (event.get(key) != null) {
                meta.put(key, event.get(key));
            }
        }
        messages.sendSystem(conversationId, content, meta);
    }

    private static String text(Map<String, Object> event, String key) {
        Object value = event.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static List<String> list(Map<String, Object> event, String key) {
        return event.get(key) instanceof List<?> values ? values.stream().map(String::valueOf).toList() : List.of();
    }
}
