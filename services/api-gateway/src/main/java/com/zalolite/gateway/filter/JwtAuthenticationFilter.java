package com.zalolite.gateway.filter;

import com.zalolite.common.security.JwtService;
import io.jsonwebtoken.JwtException;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Verifies the access token once at the edge and forwards the caller as X-User-Id.
 * Any X-User-Id sent by a client is dropped so the header can be trusted by the services.
 */
@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {
    public static final String USER_HEADER = "X-User-Id";
    private static final List<String> PUBLIC_PREFIXES = List.of(
            "/api/auth/register", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout",
            // SockJS/WebSocket handshakes cannot carry headers; the STOMP CONNECT frame is authenticated instead.
            "/ws", "/actuator/health");
    /** Media is addressed by an unguessable id so <img>/<video> tags can load it without a header. */
    private static final Pattern PUBLIC_MEDIA = Pattern.compile("^/api/media/[^/]+/content$");

    private final JwtService jwt;

    public JwtAuthenticationFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        HttpMethod method = exchange.getRequest().getMethod();
        if (HttpMethod.OPTIONS.equals(method) || isPublic(path, method)) {
            return chain.filter(withUser(exchange, null));
        }
        String authorization = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (!StringUtils.hasText(authorization) || !authorization.startsWith("Bearer ")) {
            return GatewayResponses.reject(exchange, HttpStatus.UNAUTHORIZED, "Chưa đăng nhập");
        }
        try {
            String userId = jwt.accessUserId(authorization.substring(7));
            return chain.filter(withUser(exchange, userId));
        } catch (JwtException | IllegalArgumentException exception) {
            return GatewayResponses.reject(exchange, HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
        }
    }

    private boolean isPublic(String path, HttpMethod method) {
        if (HttpMethod.GET.equals(method) && PUBLIC_MEDIA.matcher(path).matches()) {
            return true;
        }
        return PUBLIC_PREFIXES.stream().anyMatch(prefix -> path.equals(prefix) || path.startsWith(prefix + "/"));
    }

    private ServerWebExchange withUser(ServerWebExchange exchange, String userId) {
        return exchange.mutate().request(request -> request.headers(headers -> {
            headers.remove(USER_HEADER);
            if (userId != null) {
                headers.set(USER_HEADER, userId);
            }
        })).build();
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
