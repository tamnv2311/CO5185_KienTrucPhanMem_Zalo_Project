package com.zalolite.common.core;

/** Expected business failure. The HTTP status is carried so one handler can serve all services. */
public class BusinessException extends RuntimeException {
    private final int status;

    public BusinessException(String message) {
        this(400, message);
    }

    public BusinessException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }

    public static BusinessException notFound(String message) {
        return new BusinessException(404, message);
    }

    public static BusinessException forbidden(String message) {
        return new BusinessException(403, message);
    }

    public static BusinessException conflict(String message) {
        return new BusinessException(409, message);
    }

    public static BusinessException unauthorized(String message) {
        return new BusinessException(401, message);
    }
}
