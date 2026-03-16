package com.aegis.aegis_backend.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/layers")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class StaticDataController {

    private final RestTemplate restTemplate;

    // Nuclear plants — proxied to avoid CORS
    @GetMapping("/nuclear")
    public ResponseEntity<Object> getNuclearPlants() {
        try {
            String url = "https://raw.githubusercontent.com/cristianst85/" +
                "GeoNuclearData/master/data/world/json/nuclear_power_plants.json";
            ResponseEntity<Object> res = restTemplate.exchange(
                url, HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()),
                new ParameterizedTypeReference<Object>() {}
            );
            return ResponseEntity.ok(res.getBody());
        } catch (Exception e) {
            log.error("Nuclear data fetch failed: {}", e.getMessage());
            return ResponseEntity.status(503).build();
        }
    }

    // Tectonic plate boundaries
    @GetMapping("/tectonic")
    public ResponseEntity<Object> getTectonicPlates() {
        try {
            String url = "https://raw.githubusercontent.com/fraxen/" +
                "tectonicplates/master/GeoJSON/PB2002_boundaries.json";
            ResponseEntity<Object> res = restTemplate.exchange(
                url, HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()),
                new ParameterizedTypeReference<Object>() {}
            );
            return ResponseEntity.ok(res.getBody());
        } catch (Exception e) {
            log.error("Tectonic data fetch failed: {}", e.getMessage());
            return ResponseEntity.status(503).build();
        }
    }

    // OpenSky live aircraft — proxied from backend
    @GetMapping("/aircraft")
    public ResponseEntity<Object> getLiveAircraft() {
        try {
            String url = "https://opensky-network.org/api/states/all";
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            ResponseEntity<Object> res = restTemplate.exchange(
                url, HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<Object>() {}
            );
            return ResponseEntity.ok(res.getBody());
        } catch (Exception e) {
            log.error("OpenSky fetch failed: {}", e.getMessage());
            return ResponseEntity.status(503).build();
        }
    }

    // NOAA Space Weather Kp index
    @GetMapping("/spaceweather")
    public ResponseEntity<Object> getSpaceWeather() {
        try {
            String url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
            ResponseEntity<Object> res = restTemplate.exchange(
                url, HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()),
                new ParameterizedTypeReference<Object>() {}
            );
            return ResponseEntity.ok(res.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(503).build();
        }
    }

    // Celestrak Starlink TLE
    @GetMapping("/starlink")
    public ResponseEntity<Object> getStarlinkTLE() {
        try {
            String url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=JSON";
            ResponseEntity<Object> res = restTemplate.exchange(
                url, HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()),
                new ParameterizedTypeReference<Object>() {}
            );
            return ResponseEntity.ok(res.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(503).build();
        }
    }
}
