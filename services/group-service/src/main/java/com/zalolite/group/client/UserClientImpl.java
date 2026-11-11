package com.zalolite.group.client;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.common.core.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class UserClientImpl implements UserClient {
    private static final Logger log = LoggerFactory.getLogger(UserClientImpl.class);
    private static final ParameterizedTypeReference<ApiResponse<List<UserSummary>>> USERS =
            new ParameterizedTypeReference<>() { };

    private final RestClient client;

    public UserClientImpl(@Value("${services.user-service.url}") String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @Override
    public Map<String, UserSummary> find(Collection<String> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        try {
            ApiResponse<List<UserSummary>> response = client.get()
                    .uri(uri -> uri.path("/internal/users").queryParam("ids", String.join(",", userIds)).build())
                    .retrieve()
                    .body(USERS);
            Map<String, UserSummary> result = new LinkedHashMap<>();
            if (response != null && response.data() != null) {
                response.data().forEach(user -> result.put(user.id(), user));
            }
            return result;
        } catch (RuntimeException exception) {
            log.warn("user-service call failed: {}", exception.getMessage());
            throw new BusinessException(503, "Dịch vụ người dùng tạm thời không khả dụng, vui lòng thử lại");
        }
    }

    @Override
    public Map<String, UserSummary> findQuietly(Collection<String> userIds) {
        try {
            return find(userIds);
        } catch (BusinessException unavailable) {
            return Map.of();
        }
    }
}
