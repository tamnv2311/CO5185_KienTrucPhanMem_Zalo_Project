package com.zalolite.group.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record CreateGroupRequest(@NotBlank String name, List<String> memberIds) {
}
