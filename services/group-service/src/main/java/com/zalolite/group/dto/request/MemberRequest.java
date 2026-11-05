package com.zalolite.group.dto.request;

import jakarta.validation.constraints.NotBlank;

public record MemberRequest(@NotBlank String userId) {
}
