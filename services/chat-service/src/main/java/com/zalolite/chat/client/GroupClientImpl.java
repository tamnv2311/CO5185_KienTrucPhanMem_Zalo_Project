package com.zalolite.chat.client;

import com.zalolite.common.core.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Optional;

/** Fails closed: when group-service is unreachable nobody gains access to a group conversation. */
@Component
public class GroupClientImpl implements GroupClient {
    private static final Logger log = LoggerFactory.getLogger(GroupClientImpl.class);

    private final RestClient client;

    public GroupClientImpl(@Value("${services.group-service.url}") String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @Override
    public Optional<GroupInfo> find(String groupId) {
        try {
            ApiResponse<GroupInfo> response = client.get().uri("/internal/groups/{id}", groupId)
                    .retrieve().body(new ParameterizedTypeReference<>() { });
            return Optional.ofNullable(response == null ? null : response.data());
        } catch (RuntimeException exception) {
            log.debug("Group {} lookup failed: {}", groupId, exception.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public boolean canAccess(String groupId, String userId) {
        try {
            ApiResponse<Boolean> response = client.get()
                    .uri(uri -> uri.path("/internal/groups/{id}/access").queryParam("userId", userId).build(groupId))
                    .retrieve().body(new ParameterizedTypeReference<>() { });
            return response != null && Boolean.TRUE.equals(response.data());
        } catch (RuntimeException exception) {
            log.warn("Group access check failed: {}", exception.getMessage());
            return false;
        }
    }
}
