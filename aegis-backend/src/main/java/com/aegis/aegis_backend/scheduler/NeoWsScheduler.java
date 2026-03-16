package com.aegis.aegis_backend.scheduler;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import com.aegis.aegis_backend.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class NeoWsScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;

    @Value("${api.nasa.key}")
    private String nasaApiKey;

    @Scheduled(fixedRate = 3600000) // every 1 hour
    @SuppressWarnings("unchecked")
    public void fetchAsteroids() {
        log.info("☄️ Fetching NASA NeoWs asteroid data...");
        try {
            String today = LocalDate.now().toString();
            String url = "https://api.nasa.gov/neo/rest/v1/feed?start_date=" + today
                       + "&end_date=" + today + "&api_key=" + nasaApiKey;

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return;

            Map<String, Object> nearEarthObjects =
                (Map<String, Object>) response.get("near_earth_objects");
            if (nearEarthObjects == null) return;

            int saved = 0;
            for (Map.Entry<String, Object> dateEntry : nearEarthObjects.entrySet()) {
                List<Map<String, Object>> asteroids = (List<Map<String, Object>>) dateEntry.getValue();

                for (Map<String, Object> asteroid : asteroids) {
                    String externalId = "NEO_" + asteroid.get("id");
                    if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                    String name = (String) asteroid.get("name");
                    boolean isPotentiallyHazardous =
                        Boolean.TRUE.equals(asteroid.get("is_potentially_hazardous_asteroid"));

                    // Get estimated diameter in km
                    Map<String, Object> diameter = (Map<String, Object>) asteroid.get("estimated_diameter");
                    Map<String, Object> kmDiameter = (Map<String, Object>) diameter.get("kilometers");
                    double maxDiam = ((Number) kmDiameter.get("estimated_diameter_max")).doubleValue();

                    // Get closest approach data
                    List<Map<String, Object>> approaches =
                        (List<Map<String, Object>>) asteroid.get("close_approach_data");
                    String missDistance = "Unknown";
                    String relativeVelocity = "Unknown";
                    if (approaches != null && !approaches.isEmpty()) {
                        Map<String, Object> approach = approaches.get(0);
                        Map<String, Object> dist = (Map<String, Object>) approach.get("miss_distance");
                        Map<String, Object> vel = (Map<String, Object>) approach.get("relative_velocity");
                        if (dist != null) missDistance = dist.get("kilometers") + " km";
                        if (vel != null) relativeVelocity = vel.get("kilometers_per_hour") + " km/h";
                    }

                    String severity = isPotentiallyHazardous
                        ? (maxDiam > 1.0 ? "CRITICAL" : "HIGH")
                        : "LOW";

                    Event event = Event.builder()
                            .externalId(externalId)
                            .title("Asteroid: " + name)
                            .eventType("ASTEROID")
                            .source("NASA_NEOWS")
                            .latitude(0.0)
                            .longitude(0.0)
                            .severity(severity)
                            .description("Diameter: ~" + String.format("%.3f", maxDiam)
                                + " km | Miss Distance: " + missDistance
                                + " | Velocity: " + relativeVelocity
                                + " | Hazardous: " + isPotentiallyHazardous)
                            .eventTime(LocalDateTime.now())
                            .fetchedAt(LocalDateTime.now())
                            .status("UPCOMING")
                            .sourceUrl("https://www.nasa.gov/mission_pages/asteroids/")
                            .build();

                    eventRepository.save(event);
                    saved++;
                    log.info("✅ Saved asteroid: {} | Hazardous: {} | Severity: {}",
                            name, isPotentiallyHazardous, severity);

                    if (isPotentiallyHazardous) {
                        alertService.broadcastAlert(event);
                    }
                }
            }
            log.info("☄️ NeoWs sync complete — {} new asteroids saved", saved);

        } catch (Exception ex) {
            log.error("❌ NASA NeoWs fetch failed: {}", ex.getMessage());
        }
    }
}
