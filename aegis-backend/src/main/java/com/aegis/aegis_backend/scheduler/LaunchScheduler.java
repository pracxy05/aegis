package com.aegis.aegis_backend.scheduler;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class LaunchScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private static final String LAUNCH_URL =
        "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&format=json";

    @Scheduled(fixedRate = 600000) // every 10 mins (rate limit friendly)
    @SuppressWarnings("unchecked")
    public void fetchUpcomingLaunches() {
        log.info("🚀 Fetching upcoming space launches...");
        try {
            Map<String, Object> response = restTemplate.getForObject(LAUNCH_URL, Map.class);
            if (response == null || !response.containsKey("results")) return;

            List<Map<String, Object>> launches = (List<Map<String, Object>>) response.get("results");
            int saved = 0;

            for (Map<String, Object> launch : launches) {
                String externalId = "LAUNCH_" + launch.get("id");
                if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                String name = (String) launch.get("name");
                String launchStatus = "UPCOMING";

                // Get launch pad coordinates
                Double lat = null, lon = null;
                Map<String, Object> pad = (Map<String, Object>) launch.get("pad");
                if (pad != null) {
                    Object latObj = pad.get("latitude");
                    Object lonObj = pad.get("longitude");
                    if (latObj != null) lat = Double.parseDouble(latObj.toString());
                    if (lonObj != null) lon = Double.parseDouble(lonObj.toString());
                }

                // Get rocket name
                String rocketName = "Unknown";
                Map<String, Object> rocket = (Map<String, Object>) launch.get("rocket");
                if (rocket != null) {
                    Map<String, Object> config = (Map<String, Object>) rocket.get("configuration");
                    if (config != null) rocketName = (String) config.get("name");
                }

                String windowStart = (String) launch.get("window_start");

                Event event = Event.builder()
                        .externalId(externalId)
                        .title(name)
                        .eventType("LAUNCH")
                        .source("LAUNCH_LIBRARY")
                        .latitude(lat)
                        .longitude(lon)
                        .severity("LOW")
                        .description("Rocket: " + rocketName + " | Window: " + windowStart)
                        .eventTime(LocalDateTime.now())
                        .fetchedAt(LocalDateTime.now())
                        .status(launchStatus)
                        .sourceUrl((String) launch.get("url"))
                        .build();

                eventRepository.save(event);
                saved++;
                log.info("✅ Saved launch: {} | Rocket: {}", name, rocketName);
            }
            log.info("🚀 Launch sync complete — {} new launches saved", saved);

        } catch (Exception ex) {
            log.error("❌ Launch Library fetch failed: {}", ex.getMessage());
        }
    }
}
