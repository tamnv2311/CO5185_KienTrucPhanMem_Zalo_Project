package com.zalolite.chat.client;

import com.zalolite.common.core.ApiEnvelope;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class GroupAccessClientImpl implements GroupAccessClient {
    private final WebClient webClient;

    public GroupAccessClientImpl(@Value("${services.group-service.url:http://localhost:8082}") String baseUrl) {
        this.webClient = WebClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public boolean canAccess(String groupId, String userId) {
        ApiEnvelope<Boolean> response = webClient.get()
                .uri(uri -> uri.path("/internal/groups/{groupId}/access")
                        .queryParam("userId", userId)
                        .build(groupId))
                .retrieve()
                .bodyToMono(new org.springframework.core.ParameterizedTypeReference<ApiEnvelope<Boolean>>() {})
                .block();
        return response != null && Boolean.TRUE.equals(response.data());
    }
}
