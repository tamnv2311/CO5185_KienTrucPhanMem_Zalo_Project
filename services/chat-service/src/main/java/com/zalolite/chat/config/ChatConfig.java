package com.zalolite.chat.config;

import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.Message;
import com.zalolite.chat.service.RealtimeService;
import com.zalolite.common.events.Events;
import com.zalolite.common.security.JwtService;
import jakarta.annotation.PostConstruct;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
public class ChatConfig {
    /** Queue on which chat-service receives group and friendship events. */
    public static final String EVENTS_QUEUE = "chat.events";

    private final MongoTemplate mongo;

    public ChatConfig(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @PostConstruct
    void ensureIndexes() {
        // History pages are read by (conversationId, seq); the second index makes sends idempotent.
        mongo.indexOps(Message.class).ensureIndex(
                new Index().on("conversationId", Sort.Direction.ASC).on("seq", Sort.Direction.DESC));
        mongo.indexOps(Message.class).ensureIndex(
                new Index().on("conversationId", Sort.Direction.ASC).on("clientMsgId", Sort.Direction.ASC).unique());
        mongo.indexOps(Conversation.class).ensureIndex(
                new Index().on("memberIds", Sort.Direction.ASC).on("updatedAt", Sort.Direction.DESC));
    }

    @Bean
    JwtService jwtService(@Value("${jwt.secret}") String secret) {
        return new JwtService(secret);
    }

    @Bean
    RedisMessageListenerContainer fanoutListener(RedisConnectionFactory connectionFactory, RealtimeService realtime) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(realtime, new ChannelTopic(RealtimeService.CHANNEL));
        return container;
    }

    @Bean
    Declarables chatEventBindings() {
        Queue queue = new Queue(EVENTS_QUEUE, true);
        TopicExchange exchange = new TopicExchange(Events.EXCHANGE, true, false);
        Binding groups = BindingBuilder.bind(queue).to(exchange).with("group.#");
        Binding friends = BindingBuilder.bind(queue).to(exchange).with("friend.#");
        return new Declarables(queue, groups, friends);
    }
}
