package com.zalolite.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request payloads of the user service. */
public final class Requests {
    private Requests() {
    }

    public record Register(
            @Email @NotBlank String email,
            @NotBlank @Size(min = 6, max = 72) String password,
            @NotBlank @Size(max = 60) String displayName,
            String phone) {
    }

    /** "email" may also carry a phone number so a single login box works. */
    public record Login(String email, String phone, @NotBlank String password) {
        public String identifier() {
            return email != null && !email.isBlank() ? email : phone;
        }
    }

    public record Token(String refreshToken) {
    }

    public record ChangePassword(@NotBlank String currentPassword,
                                 @NotBlank @Size(min = 6, max = 72) String newPassword) {
    }

    public record UpdateProfile(@Size(max = 60) String displayName, String avatar, String cover,
                                @Size(max = 500) String bio, String phone, String gender, String birthday) {
    }

    /** The other user can be addressed by id, e-mail or phone ("target" accepts any of the three). */
    public record FriendRequest(String userId, String target, String email, String phone,
                                @Size(max = 300) String message) {
        public String anyTarget() {
            for (String value : new String[]{userId, target, email, phone}) {
                if (value != null && !value.isBlank()) {
                    return value.trim();
                }
            }
            return null;
        }
    }
}
