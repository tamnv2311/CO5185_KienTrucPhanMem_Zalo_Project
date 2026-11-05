package com.zalolite.common.core;

public record ApiEnvelope<T>(boolean success, T data, String message) {
}
