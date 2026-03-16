package com.aegis.aegis_backend.service;

import com.aegis.aegis_backend.model.Event;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MlService {

    private final RestTemplate restTemplate;
    private static final String ML_URL = "http://localhost:5001";

    public Map<String, Object> predictSeverity(Event event) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("magnitude",  event.getMagnitude() != null ? event.getMagnitude() : 0.0);
            body.put("latitude",   event.getLatitude()  != null ? event.getLatitude()  : 0.0);
            body.put("longitude",  event.getLongitude() != null ? event.getLongitude() : 0.0);
            body.put("eventType",  event.getEventType());
            body.put("depth",      0.0);

            return restTemplate.postForObject(ML_URL + "/predict", body, Map.class);
        } catch (Exception e) {
            log.warn("⚠️ ML service unavailable: {}", e.getMessage());
            return Map.of("predictedSeverity", event.getSeverity(),
                          "topConfidence", 0.0);
        }
    }

    public Map<String, Object> getEarthScore(List<Event> events) {
        try {
            Map<String, Object> body = Map.of("events", events);
            return restTemplate.postForObject(ML_URL + "/earth-score", body, Map.class);
        } catch (Exception e) {
            log.warn("⚠️ ML earth-score unavailable: {}", e.getMessage());
            return Map.of("score", 75, "level", "CAUTION");
        }
    }
}
