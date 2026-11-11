package com.zalolite.gateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window rate limit for the authentication endpoints (login brute-force protection).
 * In-memory on purpose: one gateway instance is enough for the course deployment.
 */
@Component
public class AuthRateLimitFilter implements GlobalFilter, Ordered {
    private static final long WINDOW_MS = 60_000;

    private final int limit;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public AuthRateLimitFilter(@Value("${gateway.rate-limit.auth-per-minute:60}") int limit) {
        this.limit = limit;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (!exchange.getRequest().getURI().getPath().startsWith("/api/auth/")) {
            return chain.filter(exchange);
        }
        long now = System.currentTimeMillis();
        if (windows.size() > 10_000) {
            windows.values().removeIf(window -> now - window.start > WINDOW_MS);
        }
        Window window = windows.compute(clientKey(exchange), (key, current) ->
                current == null || now - current.start > WINDOW_MS ? new Window(now, 1) : new Window(current.start, current.count + 1));
        if (window.count > limit) {
            return GatewayResponses.reject(exchange, HttpStatus.TOO_MANY_REQUESTS, "Bạn thao tác quá nhanh, vui lòng thử lại sau");
        }
        return chain.filter(exchange);
    }

    private String clientKey(ServerWebExchange exchange) {
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        InetSocketAddress address = exchange.getRequest().getRemoteAddress();
        return address == null ? "unknown" : address.getAddress().getHostAddress();
    }

    @Override
    public int getOrder() {
        return -2;
    }

    private record Window(long start, int count) {
    }
}
