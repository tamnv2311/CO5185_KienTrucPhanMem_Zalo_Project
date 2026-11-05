package com.zalolite.chat.client;

public interface GroupAccessClient {
    boolean canAccess(String groupId, String userId);
}
