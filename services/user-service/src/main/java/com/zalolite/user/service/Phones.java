package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;

final class Phones {
    private Phones() {
    }

    /** "+84 912 345 678" and "0912.345.678" both become "0912345678". Returns null for blank input. */
    static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String digits = raw.replaceAll("[^0-9+]", "");
        if (digits.startsWith("+84")) {
            digits = "0" + digits.substring(3);
        } else if (digits.startsWith("84") && digits.length() == 11) {
            digits = "0" + digits.substring(2);
        }
        if (!digits.matches("0\\d{9,10}")) {
            throw new BusinessException(422, "Số điện thoại không hợp lệ");
        }
        return digits;
    }

    static boolean looksLikePhone(String value) {
        return value != null && value.replaceAll("[\\s.\\-()]", "").matches("\\+?\\d{9,12}");
    }
}
