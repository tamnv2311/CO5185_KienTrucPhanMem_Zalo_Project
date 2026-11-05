package com.zalolite.chat.config;

import com.zalolite.chat.domain.Message;
import jakarta.annotation.PostConstruct;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
public class MongoIndexConfig {
    private final MongoTemplate mongoTemplate;

    public MongoIndexConfig(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @PostConstruct
    public void ensureIndexes() {
        mongoTemplate.indexOps(Message.class).ensureIndex(
                new Index().on("conversationId", Sort.Direction.ASC)
                        .on("seq", Sort.Direction.DESC));
        mongoTemplate.indexOps(Message.class).ensureIndex(
                new Index().on("conversationId", Sort.Direction.ASC)
                        .on("clientMsgId", Sort.Direction.ASC).unique());
    }
}
