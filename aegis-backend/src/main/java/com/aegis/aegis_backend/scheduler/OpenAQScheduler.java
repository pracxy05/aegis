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
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class OpenAQScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    @Value("${api.openaq.key:}")
    private String openAqKey;

    // ✅ Use /v3/parameters to get sensor readings with actual PM2.5 values
    // This endpoint returns latest measurements per sensor with coordinates
    @Scheduled(initialDelay = 20000, fixedRate = 3600000)
    public void fetchAirQuality() {
        if (openAqKey.isBlank()) {
            log.warn("⚠️ OpenAQ key not configured — skipping");
            return;
        }

        log.info("💨 Fetching OpenAQ air quality data...");
        try {
            // ✅ Correct endpoint — latest sensor readings for PM2.5
            // parameter id 2 = PM2.5 in OpenAQ v3
            String url = "https://api.openaq.org/v3/sensors" +
                "?parameters_id=2" +
                "&limit=200";

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-API-Key", openAqKey);
            headers.set("Accept", "application/json");
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> rawResponse = restTemplate.exchange(
                url, HttpMethod.GET, entity, String.class
            );

            String body = rawResponse.getBody();
            if (body == null || body.isBlank()) {
                log.warn("⚠️ OpenAQ empty response");
                return;
            }

            Map<String, Object> parsed = objectMapper.readValue(
                body, new TypeReference<Map<String, Object>>() {}
            );

            if (!parsed.containsKey("results")) {
                log.warn("⚠️ OpenAQ missing 'results'. Keys: {}", parsed.keySet());
                return;
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results =
                (List<Map<String, Object>>) parsed.get("results");

            int saved = 0;
            for (Map<String, Object> sensor : results) {

                // ✅ Extract latest PM2.5 value from summary object
                double pm25 = 0;
                Object summaryObj = sensor.get("summary");
                if (summaryObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> summary = (Map<String, Object>) summaryObj;
                    pm25 = parseDouble(summary.getOrDefault("avg", 0));
                }
                // Also try latest value directly
                if (pm25 == 0) {
                    Object latestObj = sensor.get("latest");
                    if (latestObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> latest = (Map<String, Object>) latestObj;
                        pm25 = parseDouble(latest.getOrDefault("value", 0));
                    }
                }
                if (pm25 < 150) continue; // Only hazardous (WHO limit is 15, hazardous starts at 150)

                // ✅ Extract coordinates from nested location object
                double lat = 0, lon = 0;
                Object locObj = sensor.get("location");
                if (locObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> loc = (Map<String, Object>) locObj;

                    Object coordObj = loc.get("coordinates");
                    if (coordObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> coord = (Map<String, Object>) coordObj;
                        lat = parseDouble(coord.getOrDefault("latitude",  0));
                        lon = parseDouble(coord.getOrDefault("longitude", 0));
                    }
                }
                if (lat == 0 && lon == 0) continue;

                // ✅ Extract location name
                String locationName = "Unknown Location";
                if (locObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> loc = (Map<String, Object>) locObj;
                    locationName = String.valueOf(loc.getOrDefault("name", "Unknown Location"));
                }

                // Build unique external ID
                String sensorId  = String.valueOf(sensor.getOrDefault("id", UUID.randomUUID()));
                String externalId = "AQ_SENSOR_" + sensorId;
                if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                String severity;
                if      (pm25 >= 500) severity = "CRITICAL";
                else if (pm25 >= 300) severity = "HIGH";
                else if (pm25 >= 150) severity = "MEDIUM";
                else                  severity = "LOW";

                Event event = Event.builder()
                        .externalId(externalId)
                        .title("💨 Hazardous Air Quality — " + locationName)
                        .eventType("AIR_QUALITY")
                        .source("OPENAQ")
                        .latitude(lat)
                        .longitude(lon)
                        .magnitude(pm25)
                        .severity(severity)
                        .description(String.format(
                            "PM2.5: %.1f µg/m³ at %s. WHO safe limit: 15 µg/m³. " +
                            "Current level is %.0fx above safe limit.",
                            pm25, locationName, pm25 / 15.0))
                        .eventTime(LocalDateTime.now())
                        .fetchedAt(LocalDateTime.now())
                        .status("ACTIVE")
                        .sourceUrl("https://openaq.org")
                        .build();

                eventRepository.save(event);
                saved++;
                log.info("💨 Saved AQ: {} | PM2.5: {} µg/m³ | Severity: {}",
                    locationName, pm25, severity);

                if ("CRITICAL".equals(severity) || "HIGH".equals(severity)) {
                    alertService.broadcastAlert(event);
                }
            }
            log.info("💨 OpenAQ sync complete — {} hazardous AQ events saved", saved);

        } catch (Exception ex) {
            log.error("❌ OpenAQ fetch failed: {}", ex.getMessage());
        }
    }

    private double parseDouble(Object val) {
        try { return Double.parseDouble(String.valueOf(val)); }
        catch (Exception e) { return 0.0; }
    }
}
