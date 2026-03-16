package com.aegis.aegis_backend.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DataSourceConfig {

    // Render injects DATABASE_URL as postgres://user:pass@host:port/db
    // Spring Boot needs jdbc:postgresql://host:port/db
    // This bean auto-converts it.
    @Value("${DATABASE_URL:#{null}}")
    private String databaseUrl;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();

        if (databaseUrl != null && databaseUrl.startsWith("postgres")) {
            // Parse postgres:// or postgresql:// URL from Render
            try {
                String cleanUrl = databaseUrl
                        .replace("postgres://", "postgresql://");
                URI uri = URI.create(cleanUrl);

                String host     = uri.getHost();
                int    port     = uri.getPort() == -1 ? 5432 : uri.getPort();
                String db       = uri.getPath().replace("/", "");
                String userInfo = uri.getUserInfo(); // "user:pass"
                String user     = userInfo.split(":")[0];
                String pass     = userInfo.split(":")[1];

                ds.setJdbcUrl("jdbc:postgresql://" + host + ":" + port + "/" + db +
                              "?sslmode=require");
                ds.setUsername(user);
                ds.setPassword(pass);

            } catch (Exception e) {
                throw new RuntimeException("Failed to parse DATABASE_URL: " + databaseUrl, e);
            }

        } else {
            // Local dev fallback — reads normal spring.datasource.* props
            // This branch is hit when DATABASE_URL is not set (local MySQL)
            throw new RuntimeException(
                "DATABASE_URL env var not set. " +
                "For local dev use application-local.properties with spring.datasource.*"
            );
        }

        ds.setDriverClassName("org.postgresql.Driver");
        ds.setMaximumPoolSize(5);      // Stay within Render free tier limits
        ds.setMinimumIdle(1);
        ds.setConnectionTimeout(30000);
        ds.setIdleTimeout(600000);
        ds.setMaxLifetime(1800000);
        return ds;
    }
}
