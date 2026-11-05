package com.zalolite.chat.dto.request;

import jakarta.validation.constraints.NotBlank;

public record SendMessageRequest(@NotBlank String conversationId, @NotBlank String clientMsgId,
                                 @NotBlank String content) {
}
