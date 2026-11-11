package com.zalolite.chat.message;

import com.zalolite.chat.domain.Attachment;
import com.zalolite.chat.domain.Message;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;
import com.zalolite.common.core.BusinessException;

import java.util.List;

/** Shared rules of the media message types: at least one uploaded file, optional caption. */
abstract class AttachmentMessageHandler implements MessageHandler {
    private static final int MAX_ATTACHMENTS = 10;

    @Override
    public void apply(Message message, SendMessageRequest request) {
        List<Attachment> attachments = request.attachments();
        if (attachments == null || attachments.isEmpty()) {
            throw new BusinessException(422, "Tin nhắn " + label() + " cần có tệp đính kèm");
        }
        if (attachments.size() > MAX_ATTACHMENTS) {
            throw new BusinessException(422, "Tối đa " + MAX_ATTACHMENTS + " tệp trong một tin nhắn");
        }
        for (Attachment attachment : attachments) {
            if (attachment.url() == null || attachment.url().isBlank()) {
                throw new BusinessException(422, "Tệp đính kèm thiếu đường dẫn");
            }
        }
        message.setAttachments(attachments);
        String caption = request.content();
        if (caption != null && caption.length() > TextMessageHandler.MAX_LENGTH) {
            throw new BusinessException(422, "Chú thích quá dài");
        }
        message.setContent(caption == null || caption.isBlank() ? null : caption);
    }

    @Override
    public String preview(Message message) {
        return "[" + label() + "]" + suffix(message);
    }

    /** Vietnamese label shown in previews, e.g. "Hình ảnh". */
    abstract String label();

    String suffix(Message message) {
        return message.getContent() == null ? "" : " " + message.getContent();
    }
}
