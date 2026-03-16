package com.aegis.aegis_backend.repository;

import com.aegis.aegis_backend.model.LaunchWatchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LaunchWatchlistRepository extends JpaRepository<LaunchWatchlist, Long> {
    List<LaunchWatchlist> findByUserId(Long userId);
}
