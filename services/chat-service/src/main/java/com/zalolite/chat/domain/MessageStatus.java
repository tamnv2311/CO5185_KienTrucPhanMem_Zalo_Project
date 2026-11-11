package com.zalolite.chat.domain;

public enum MessageStatus {
    SENT,
    DELIVERED,
    SEEN;

    /**
     * Status as the sender sees it. It is derived from the per-member read/delivered cursors
     * of the conversation instead of being stored on every message.
     */
    public static MessageStatus of(Conversation conversation, Message message) {
        boolean delivered = false;
        for (String memberId : conversation.getMemberIds()) {
            if (memberId.equals(message.getSenderId())) {
                continue;
            }
            if (conversation.readSeqOf(memberId) >= message.getSeq()) {
                return SEEN;
            }
            delivered |= conversation.deliveredSeqOf(memberId) >= message.getSeq();
        }
        return delivered ? DELIVERED : SENT;
    }
}
