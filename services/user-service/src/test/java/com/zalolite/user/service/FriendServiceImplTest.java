package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.user.domain.Friendship;
import com.zalolite.user.domain.FriendshipStatus;
import com.zalolite.user.domain.User;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.repository.FriendshipRepository;
import com.zalolite.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FriendServiceImplTest {
    @Mock
    private FriendshipRepository friendships;
    @Mock
    private UserRepository users;
    @Mock
    private UserService userService;
    @Mock
    private EventPublisher events;

    private FriendServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new FriendServiceImpl(friendships, users, userService, events);
        lenient().when(users.findById("an")).thenReturn(Optional.of(user("an")));
        lenient().when(users.findById("binh")).thenReturn(Optional.of(user("binh")));
    }

    @Test
    void cannotSendRequestToYourself() {
        when(userService.resolve("an")).thenReturn(Optional.of(user("an")));

        assertThatThrownBy(() -> service.request("an", request("an")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void newRequestIsPendingAndNotifiesRecipient() {
        when(userService.resolve("binh")).thenReturn(Optional.of(user("binh")));
        when(friendships.findBetween("an", "binh")).thenReturn(List.of());

        Responses.Friend response = service.request("an", request("binh"));

        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.user().id()).isEqualTo("binh");
        verify(events).publish(eq("friend.requested"), any());
    }

    @Test
    void requestingSomeoneWhoAlreadyInvitedYouAcceptsTheirInvitation() {
        Friendship fromBinh = friendship(7L, "binh", "an", FriendshipStatus.PENDING);
        when(userService.resolve("binh")).thenReturn(Optional.of(user("binh")));
        when(friendships.findBetween("an", "binh")).thenReturn(List.of(fromBinh));
        when(friendships.findById(7L)).thenReturn(Optional.of(fromBinh));

        Responses.Friend response = service.request("an", request("binh"));

        assertThat(response.status()).isEqualTo("ACCEPTED");
        verify(events).publish(eq("friend.accepted"), any());
    }

    @Test
    void onlyTheRecipientMayAccept() {
        when(friendships.findById(7L)).thenReturn(Optional.of(friendship(7L, "an", "binh", FriendshipStatus.PENDING)));

        assertThatThrownBy(() -> service.accept("an", 7L))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(403);
    }

    @Test
    void blockedUsersCannotSendRequests() {
        when(userService.resolve("binh")).thenReturn(Optional.of(user("binh")));
        when(friendships.findBetween("an", "binh"))
                .thenReturn(List.of(friendship(9L, "binh", "an", FriendshipStatus.BLOCKED)));

        assertThatThrownBy(() -> service.request("an", request("binh")))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(403);
    }

    private static Requests.FriendRequest request(String target) {
        return new Requests.FriendRequest(target, null, null, null, "Kết bạn nhé");
    }

    private static User user(String id) {
        User user = new User();
        user.setId(id);
        user.setDisplayName(id);
        user.setEmail(id + "@example.com");
        return user;
    }

    private static Friendship friendship(Long id, String requester, String recipient, FriendshipStatus status) {
        Friendship friendship = new Friendship();
        friendship.setId(id);
        friendship.setRequesterId(requester);
        friendship.setRecipientId(recipient);
        friendship.setStatus(status);
        return friendship;
    }
}
