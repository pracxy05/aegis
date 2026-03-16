package com.aegis.aegis_backend.scheduler;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import com.aegis.aegis_backend.service.AlertService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class AcledScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    @Value("${api.acled.email:}")
    private String acledEmail;

    @Value("${api.acled.password:}")
    private String acledPassword;

    private String accessToken    = null;
    private String refreshToken   = null;
    private long   tokenExpiresAt = 0;

    // ── Token Management ─────────────────────────────────────────────

    private String getAccessToken() {
        long now = System.currentTimeMillis() / 1000;
        if (accessToken != null && now < tokenExpiresAt - 300) return accessToken;
        if (refreshToken != null) {
            try {
                String t = refreshAccessToken();
                if (t != null) return t;
            } catch (Exception ignored) {}
        }
        return loginAndGetToken();
    }

    private String loginAndGetToken() {
        try {
            log.info("🔐 ACLED: Requesting new OAuth token...");
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("username",   acledEmail);
            body.add("password",   acledPassword);
            body.add("grant_type", "password");
            body.add("client_id",  "acled");

            ResponseEntity<String> response = restTemplate.exchange(
                "https://acleddata.com/oauth/token",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
            );

            Map<String, Object> res = objectMapper.readValue(
                response.getBody(), new TypeReference<Map<String, Object>>() {}
            );

            if (!res.containsKey("access_token")) {
                log.error("❌ ACLED token missing access_token");
                return null;
            }

            accessToken    = (String) res.get("access_token");
            refreshToken   = (String) res.get("refresh_token");
            int expiresIn  = (int) res.getOrDefault("expires_in", 86400);
            tokenExpiresAt = (System.currentTimeMillis() / 1000) + expiresIn;

            log.info("✅ ACLED OAuth token acquired, valid for {}s", expiresIn);
            return accessToken;

        } catch (Exception e) {
            log.error("❌ ACLED login failed: {}", e.getMessage());
            return null;
        }
    }

    private String refreshAccessToken() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("refresh_token", refreshToken);
        body.add("grant_type",    "refresh_token");
        body.add("client_id",     "acled");

        ResponseEntity<String> response = restTemplate.exchange(
            "https://acleddata.com/oauth/token",
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            String.class
        );

        Map<String, Object> res = objectMapper.readValue(
            response.getBody(), new TypeReference<Map<String, Object>>() {}
        );

        if (!res.containsKey("access_token")) return null;

        accessToken    = (String) res.get("access_token");
        refreshToken   = (String) res.get("refresh_token");
        int expiresIn  = (int) res.getOrDefault("expires_in", 86400);
        tokenExpiresAt = (System.currentTimeMillis() / 1000) + expiresIn;

        log.info("🔄 ACLED token refreshed, valid for {}s", expiresIn);
        return accessToken;
    }

    // ── Scheduler ────────────────────────────────────────────────────

    @Scheduled(initialDelay = 15000, fixedRate = 3600000)
    public void fetchConflictEvents() {
        if (acledEmail.isBlank() || acledPassword.isBlank()) {
            log.warn("⚠️ ACLED credentials not configured — skipping");
            return;
        }

        String token = getAccessToken();
        if (token == null) {
            log.error("❌ ACLED: Could not obtain token, skipping");
            return;
        }

        log.info("⚔️ Fetching ACLED conflict events...");
        try {
            String url = "https://acleddata.com/api/acled/read" +
                "?event_type=Battles" +
                "&limit=100" +
                "&fields=event_id_cnty,event_date,event_type,country," +
                "latitude,longitude,fatalities,notes,source" +
                "&_format=json";

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + token);
            headers.set("Accept",        "application/json");

            ResponseEntity<String> rawResponse = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), String.class
            );

            String body = rawResponse.getBody();
            if (body == null || body.isBlank()) {
                log.warn("⚠️ ACLED empty response");
                return;
            }

            // ✅ ACLED returns a raw JSON array [...] at root — NOT {"data":[...]}
            List<Map<String, Object>> conflicts = objectMapper.readValue(
                body, new TypeReference<List<Map<String, Object>>>() {}
            );

            if (conflicts == null || conflicts.isEmpty()) {
                log.warn("⚠️ ACLED returned empty conflict list");
                return;
            }

            int saved = 0;
            for (Map<String, Object> c : conflicts) {
                String externalId = "ACLED_" + c.get("event_id_cnty");
                if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                double lat        = parseDouble(c.get("latitude"));
                double lon        = parseDouble(c.get("longitude"));
                int    fatalities = parseInt(c.get("fatalities"));
                String country    = String.valueOf(c.getOrDefault("country", "Unknown"));
                String notes      = String.valueOf(c.getOrDefault("notes", ""));
                if (notes.length() > 500) notes = notes.substring(0, 500);

                String severity;
                if      (fatalities >= 100) severity = "CRITICAL";
                else if (fatalities >= 20)  severity = "HIGH";
                else if (fatalities >= 5)   severity = "MEDIUM";
                else                        severity = "LOW";

                Event event = Event.builder()
                        .externalId(externalId)
                        .title("⚔️ Armed Conflict — " + country)
                        .eventType("CONFLICT")
                        .source("ACLED")
                        .latitude(lat)
                        .longitude(lon)
                        .magnitude((double) fatalities)
                        .severity(severity)
                        .description(notes)
                        .eventTime(LocalDateTime.now())
                        .fetchedAt(LocalDateTime.now())
                        .status("ACTIVE")
                        .sourceUrl("https://acleddata.com")
                        .build();

                eventRepository.save(event);
                saved++;
                log.info("⚔️ Conflict: {} | Fatalities: {} | Severity: {}",
                    country, fatalities, severity);

                if ("CRITICAL".equals(severity) || "HIGH".equals(severity)) {
                    alertService.broadcastAlert(event);
                }
            }
            log.info("⚔️ ACLED sync complete — {} events saved", saved);

        } catch (Exception ex) {
            if (ex.getMessage() != null && ex.getMessage().contains("401")) {
                log.warn("🔐 ACLED 401 — clearing token for re-login");
                accessToken = null;
            }
            log.error("❌ ACLED fetch failed: {}", ex.getMessage());
        }
    }

    private double parseDouble(Object val) {
        try { return Double.parseDouble(String.valueOf(val)); }
        catch (Exception e) { return 0.0; }
    }

    private int parseInt(Object val) {
        try { return Integer.parseInt(String.valueOf(val)); }
        catch (Exception e) { return 0; }
    }
}
