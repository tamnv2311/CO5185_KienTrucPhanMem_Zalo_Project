package com.zalolite.group.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateGroupRequest(@NotBlank String name, String avatar) {
}
