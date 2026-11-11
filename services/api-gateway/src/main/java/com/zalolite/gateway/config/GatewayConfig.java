package com.zalolite.gateway.config;

import com.zalolite.common.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GatewayConfig {
    @Bean
    JwtService jwtService(@Value("${jwt.secret}") String secret) {
        return new JwtService(secret);
    }
}
