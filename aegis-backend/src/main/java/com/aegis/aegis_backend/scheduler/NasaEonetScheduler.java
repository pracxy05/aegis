package com.aegis.aegis_backend.scheduler;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import com.aegis.aegis_backend.service.AlertService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class NasaEonetScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    private static final String EONET_URL =
        "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20&format=json";

    @Scheduled(fixedRate = 300000)
    public void fetchNaturalEvents() {
        log.info("🌋 Fetching NASA EONET natural events...");
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> rawResponse = restTemplate.exchange(
                EONET_URL, HttpMethod.GET, entity, String.class
            );

            String body = rawResponse.getBody();
            if (body == null || body.isBlank()) return;

            Map<String, Object> response = objectMapper.readValue(
                body, new TypeReference<Map<String, Object>>() {}
            );

            if (!response.containsKey("events")) return;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> events =
                (List<Map<String, Object>>) response.get("events");

            int saved = 0;
            for (Map<String, Object> e : events) {
                String externalId = "EONET_" + e.get("id");
                if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                String title = (String) e.get("title");

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> categories =
                    (List<Map<String, Object>>) e.get("categories");

                String eventType = "NATURAL_EVENT";
                if (categories != null && !categories.isEmpty()) {
                    String cat = String.valueOf(
                        categories.get(0).getOrDefault("title", "")
                    ).toUpperCase();
                    if      (cat.contains("WILDFIRE") || cat.contains("FIRE"))
                        eventType = "WILDFIRE";
                    else if (cat.contains("STORM") || cat.contains("CYCLONE"))
                        eventType = "STORM";
                    else if (cat.contains("FLOOD"))
                        eventType = "FLOOD";
                    else if (cat.contains("VOLCANO"))
                        eventType = "VOLCANO";
                    else if (cat.contains("ICE"))
                        eventType = "ICE_EVENT";
                    else if (cat.contains("DROUGHT"))
                        eventType = "DROUGHT";
                    else if (cat.contains("DUST"))
                        eventType = "DUST_STORM";
                    else if (cat.contains("LANDSLIDE"))
                        eventType = "LANDSLIDE";
                }

                Double lat = null, lon = null;

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> geometries =
                    (List<Map<String, Object>>) e.get("geometry");

                if (geometries != null && !geometries.isEmpty()) {
                    Map<String, Object> geo = geometries.get(geometries.size() - 1);
                    Object coordsObj = geo.get("coordinates");

                    if (coordsObj instanceof List<?> coords) {
                        if (!coords.isEmpty() && coords.get(0) instanceof Number) {
                            lon = ((Number) coords.get(0)).doubleValue();
                            lat = ((Number) coords.get(1)).doubleValue();
                        } else if (!coords.isEmpty() && coords.get(0) instanceof List<?> firstPoint) {
                            if (firstPoint.size() >= 2) {
                                lon = ((Number) firstPoint.get(0)).doubleValue();
                                lat = ((Number) firstPoint.get(1)).doubleValue();
                            }
                        }
                    }
                }

                String severity = switch (eventType) {
                    case "WILDFIRE", "VOLCANO" -> "HIGH";
                    case "STORM",   "FLOOD"    -> "MEDIUM";
                    default                    -> "LOW";
                };

                Event event = Event.builder()
                        .externalId(externalId)
                        .title(title)
                        .eventType(eventType)
                        .source("NASA_EONET")
                        .latitude(lat)
                        .longitude(lon)
                        .severity(severity)
                        .description("NASA EONET: " + title)
                        .eventTime(LocalDateTime.now())
                        .fetchedAt(LocalDateTime.now())
                        .status("ACTIVE")
                        .sourceUrl("https://eonet.gsfc.nasa.gov/api/v3/events/" + e.get("id"))
                        .build();

                eventRepository.save(event);
                saved++;
                log.info("✅ Saved EONET: {} | Type: {} | Coords: {}, {}",
                    title, eventType, lat, lon);

                if ("HIGH".equals(severity) || "CRITICAL".equals(severity)) {
                    alertService.broadcastAlert(event);
                }
            }
            log.info("🌍 EONET sync complete — {} new events saved", saved);

        } catch (Exception ex) {
            log.error("❌ NASA EONET fetch failed: {}", ex.getMessage());
        }
    }
}
