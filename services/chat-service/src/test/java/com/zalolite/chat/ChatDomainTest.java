package com.zalolite.chat;

import com.zalolite.chat.domain.Attachment;
import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.ConversationType;
import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessageStatus;
import com.zalolite.chat.domain.MessageType;
import com.zalolite.chat.dto.ChatDtos.ConversationResponse;
import com.zalolite.chat.dto.ChatDtos.MessageResponse;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;
import com.zalolite.chat.message.MediaMessageHandlers;
import com.zalolite.chat.message.MessageHandler;
import com.zalolite.chat.message.MessageHandlerFactory;
import com.zalolite.chat.message.TextMessageHandler;
import com.zalolite.common.core.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatDomainTest {
    private final MessageHandlerFactory handlers = factory();

    @Test
    void directConversationIdDoesNotDependOnWhoOpensIt() {
        assertThat(Conversation.directId("an", "binh")).isEqualTo(Conversation.directId("binh", "an"));
    }

    @Test
    void statusFollowsTheOtherMembersCursors() {
        Conversation conversation = conversation("an", "binh");
        Message message = message("an", 5);

        assertThat(MessageStatus.of(conversation, message)).isEqualTo(MessageStatus.SENT);
        conversation.getDeliveredSeq().put("binh", 5L);
        assertThat(MessageStatus.of(conversation, message)).isEqualTo(MessageStatus.DELIVERED);
        conversation.getReadSeq().put("binh", 7L);
        assertThat(MessageStatus.of(conversation, message)).isEqualTo(MessageStatus.SEEN);
    }

    @Test
    void senderReadingTheirOwnMessageDoesNotMarkItSeen() {
        Conversation conversation = conversation("an", "binh");
        conversation.getReadSeq().put("an", 5L);

        assertThat(MessageStatus.of(conversation, message("an", 5))).isEqualTo(MessageStatus.SENT);
    }

    @Test
    void unreadCountIgnoresClearedHistory() {
        Conversation conversation = conversation("an", "binh");
        conversation.setLastSeq(10);
        conversation.getReadSeq().put("binh", 4L);
        assertThat(ConversationResponse.of(conversation, "binh").unreadCount()).isEqualTo(6);

        conversation.getClearedSeq().put("binh", 10L);
        assertThat(ConversationResponse.of(conversation, "binh").unreadCount()).isZero();
    }

    @Test
    void recalledMessageHidesItsContent() {
        Message message = message("an", 1);
        message.setContent("bí mật");
        message.setRecalled(true);

        MessageResponse response = MessageResponse.of(message, conversation("an", "binh"));

        assertThat(response.recalled()).isTrue();
        assertThat(response.content()).isNull();
        assertThat(handlers.preview(message)).isEqualTo("Tin nhắn đã được thu hồi");
    }

    @Test
    void textMessageNeedsContent() {
        assertThatThrownBy(() -> handlers.forType(MessageType.TEXT).apply(new Message(), request("  ", "TEXT", null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void imageMessageNeedsAnAttachmentAndKeepsTheCaption() {
        MessageHandler image = handlers.forType(MessageType.IMAGE);
        assertThatThrownBy(() -> image.apply(new Message(), request("xem nè", "IMAGE", List.of())))
                .isInstanceOf(BusinessException.class);

        Message message = new Message();
        message.setType(MessageType.IMAGE);
        image.apply(message, request("xem nè", "IMAGE",
                List.of(new Attachment("m1", "/api/media/m1/content", "a.png", 10L, "image/png", "IMAGE"))));

        assertThat(message.getAttachments()).hasSize(1);
        assertThat(image.preview(message)).isEqualTo("[Hình ảnh] xem nè");
    }

    @Test
    void clientsCannotSendSystemMessages() {
        assertThatThrownBy(() -> handlers.forType(MessageType.SYSTEM).apply(new Message(), request("x", "SYSTEM", null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void unknownTypeFallsBackToText() {
        assertThat(MessageType.parse("document")).isEqualTo(MessageType.FILE);
        assertThat(MessageType.parse("whatever")).isEqualTo(MessageType.TEXT);
        assertThat(MessageType.parse(null)).isEqualTo(MessageType.TEXT);
    }

    private static MessageHandlerFactory factory() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(MediaMessageHandlers.class)) {
            List<MessageHandler> all = new ArrayList<>(context.getBeansOfType(MessageHandler.class).values());
            all.add(new TextMessageHandler());
            return new MessageHandlerFactory(all);
        }
    }

    private static SendMessageRequest request(String content, String type, List<Attachment> attachments) {
        return new SendMessageRequest("c1", "client-1", content, type, attachments, null, null);
    }

    private static Conversation conversation(String... members) {
        Conversation conversation = new Conversation();
        conversation.setId("c1");
        conversation.setType(ConversationType.DIRECT);
        conversation.setMemberIds(new ArrayList<>(List.of(members)));
        return conversation;
    }

    private static Message message(String sender, long seq) {
        Message message = new Message();
        message.setId("m" + seq);
        message.setConversationId("c1");
        message.setSenderId(sender);
        message.setSeq(seq);
        return message;
    }
}
