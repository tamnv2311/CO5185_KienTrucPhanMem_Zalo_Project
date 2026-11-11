package com.zalolite.common.events;

/** Event contract between services. The routing key of every event equals its type. */
public final class Events {
    public static final String EXCHANGE = "zalolite.events";

    public static final String USER_REGISTERED = "user.registered";
    public static final String FRIEND_REQUESTED = "friend.requested";
    public static final String FRIEND_ACCEPTED = "friend.accepted";
    public static final String FRIEND_REMOVED = "friend.removed";

    public static final String GROUP_CREATED = "group.created";
    public static final String GROUP_UPDATED = "group.updated";
    public static final String GROUP_DELETED = "group.deleted";
    public static final String GROUP_MEMBER_ADDED = "group.member_added";
    public static final String GROUP_MEMBER_REMOVED = "group.member_removed";
    public static final String GROUP_ROLE_CHANGED = "group.role_changed";

    public static final String MESSAGE_SENT = "message.sent";
    public static final String MEDIA_UPLOADED = "media.uploaded";

    private Events() {
    }
}
