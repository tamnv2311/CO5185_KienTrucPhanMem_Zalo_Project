package com.zalolite.group.dto.request;

import com.zalolite.group.domain.GroupRole;
import jakarta.validation.constraints.NotNull;

public record ChangeRoleRequest(@NotNull GroupRole role) {
}
