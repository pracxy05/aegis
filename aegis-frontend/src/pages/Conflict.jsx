import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { ArrowLeft, Crosshair, Layers, RefreshCw, ExternalLink, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './Conflict.css';

// ── Constants ─────────────────────────────────────────────────────────
const BACKEND   = 'http://localhost:8080';
const MAP_TILE  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const MAP_ATTR  = '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>';

const SEV_COLOR = {
  CRITICAL: '#ff2277',
  HIGH:     '#ff6600',
  MEDIUM:   '#ffcc00',
  LOW:      '#ff8844',
};

const LAYER_MODES = ['POINTS', 'HEATMAP', 'BOTH'];

// ── Helpers ───────────────────────────────────────────────────────────
function severityColor(sev) {
  return SEV_COLOR[sev] || '#ff8844';
}

function markerRadius(fatalities, sev) {
  const base = sev === 'CRITICAL' ? 10 : sev === 'HIGH' ? 7 : 5;
  return Math.min(base + (parseFloat(fatalities) || 0) / 6, 28);
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function countryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  return countryCode.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  );
}

// ── Heatmap layer (leaflet.heat) ───────────────────────────────────────
function HeatmapLayer({ events }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!window.L || !window.L.heatLayer) return;

    const points = events
      .filter(e => e.latitude != null && e.longitude != null)
      .map(e => [
        e.latitude,
        e.longitude,
        e.severity === 'CRITICAL' ? 1.0 :
        e.severity === 'HIGH'     ? 0.75 :
        e.severity === 'MEDIUM'   ? 0.5  : 0.3,
      ]);

    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = window.L.heatLayer(points, {
      radius: 28,
      blur:   22,
      maxZoom: 10,
      gradient: {
        0.0: '#330011',
        0.3: '#880033',
        0.6: '#cc2255',
        0.85: '#ff2277',
        1.0: '#ffffff',
      },
    }).addTo(map);

    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [map, events]);

  return null;
}

// Dynamically inject leaflet.heat script once
function useLeafletHeat() {
  useEffect(() => {
    if (window.L?.heatLayer) return;
    const script   = document.createElement('script');
    script.src     = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    script.async   = true;
    document.head.appendChild(script);
  }, []);
}

// ── Fly to marker ──────────────────────────────────────────────────────
function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], 6, { duration: 1.2 });
  }, [target, map]);
  return null;
}

// ── Feed card ─────────────────────────────────────────────────────────
function ConflictCard({ event, selected, onClick }) {
  const color = severityColor(event.severity);
  const fat   = parseFloat(event.magnitude) || 0;
  return (
    <motion.div
      className={`cf-card ${selected ? 'cf-card-selected' : ''}`}
      style={{ '--cc': color }}
      onClick={() => onClick(event)}
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1,  x: 0  }}
      transition={{ duration: 0.2 }}
      layout
    >
      <div className="cf-card-bar" style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />
      <div className="cf-card-body">
        <div className="cf-card-title">{event.title}</div>
        <div className="cf-card-meta">
          <span className="cf-chip" style={{ color, borderColor: `${color}44`, background: `${color}14` }}>
            {event.severity}
          </span>
          {fat > 0 && (
            <span className="cf-fatalities">💀 {fat} fatalities</span>
          )}
        </div>
        <div className="cf-card-sub">
          <span>{event.source}</span>
          <span className="cf-dot">·</span>
          <span>{timeAgo(event.eventTime)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────
function ConflictDetail({ event, onClose }) {
  if (!event) return null;
  const color = severityColor(event.severity);
  const fat   = parseFloat(event.magnitude) || 0;

  return (
    <motion.div
      className="cf-detail"
      style={{ '--cc': color }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1,  x: 0  }}
      exit={   { opacity: 0,  x: 20 }}
      transition={{ duration: 0.22 }}
    >
      <div className="cf-detail-header">
        <div className="cf-detail-header-left">
          <span className="cf-detail-type-icon">⚔️</span>
          <span className="cf-detail-type">CONFLICT EVENT</span>
        </div>
        <button className="cf-detail-close" onClick={onClose}><X size={13}/></button>
      </div>

      <div className="cf-detail-sev-bar" style={{ background: color, boxShadow: `0 0 12px ${color}66` }} />

      <div className="cf-detail-body">
        <div className="cf-detail-title">{event.title}</div>

        <div className="cf-detail-chips">
          <span className="cf-chip" style={{ color, borderColor:`${color}44`, background:`${color}14` }}>
            {event.severity}
          </span>
          <span className="cf-detail-status">{event.status || 'ACTIVE'}</span>
        </div>

        <div className="cf-detail-grid">
          <div className="cf-stat">
            <span className="cf-stat-label">SOURCE</span>
            <span className="cf-stat-val">{event.source}</span>
          </div>
          {fat > 0 && (
            <div className="cf-stat">
              <span className="cf-stat-label">FATALITIES</span>
              <span className="cf-stat-val" style={{ color: '#ff2277' }}>{fat}</span>
            </div>
          )}
          {event.latitude != null && (
            <div className="cf-stat">
              <span className="cf-stat-label">COORDINATES</span>
              <span className="cf-stat-val">{event.latitude.toFixed(3)}°, {event.longitude.toFixed(3)}°</span>
            </div>
          )}
          {event.eventTime && (
            <div className="cf-stat">
              <span className="cf-stat-label">REPORTED</span>
              <span className="cf-stat-val">{new Date(event.eventTime).toLocaleString()}</span>
            </div>
          )}
        </div>

        {event.description && (
          <div className="cf-detail-desc-block">
            <div className="cf-detail-desc-label">INTELLIGENCE REPORT</div>
            <div className="cf-detail-desc">{event.description}</div>
          </div>
        )}

        <div className="cf-detail-actions">
          {event.latitude != null && (
            <a
              href={`https://www.google.com/maps/@${event.latitude},${event.longitude},6z`}
              target="_blank"
              rel="noreferrer"
              className="cf-detail-link cf-detail-link-map"
            >
              <Crosshair size={11}/> VIEW LOCATION
            </a>
          )}
          {event.sourceUrl && (
            <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="cf-detail-link">
              <ExternalLink size={11}/> ACLED SOURCE
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────
function StatBar({ events }) {
  const critical = events.filter(e => e.severity === 'CRITICAL').length;
  const high     = events.filter(e => e.severity === 'HIGH').length;
  const totalFat = events.reduce((n, e) => n + (parseFloat(e.magnitude) || 0), 0);

  return (
    <div className="cf-statsbar">
      <div className="cf-stat-pill cf-stat-total">
        ⚔️ <strong>{events.length}</strong> ACTIVE ZONES
      </div>
      <div className="cf-stat-pill cf-stat-crit">
        🔴 <strong>{critical}</strong> CRITICAL
      </div>
      <div className="cf-stat-pill cf-stat-high">
        🟠 <strong>{high}</strong> HIGH
      </div>
      <div className="cf-stat-pill cf-stat-fat">
        💀 <strong>{Math.round(totalFat).toLocaleString()}</strong> REPORTED FATALITIES
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function Conflict() {
  const navigate = useNavigate();
  useLeafletHeat();

  const [events,    setEvents   ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [error,     setError    ] = useState(null);
  const [lastSync,  setLastSync ] = useState(null);
  const [selected,  setSelected ] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [layerMode, setLayerMode] = useState('POINTS');
  const [syncing,   setSyncing  ] = useState(false);

  const loadEvents = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await axios.get(`${BACKEND}/api/events`, {
        params: { type: 'CONFLICT' },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aegis_token')}`,
        },
      });
      setEvents(res.data);
      setLastSync(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError('Backend offline — no conflict data available');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    const iv = setInterval(loadEvents, 120000); // refresh every 2 min
    return () => clearInterval(iv);
  }, [loadEvents]);

  const handleCardClick = useCallback((event) => {
    setSelected(event);
    if (event.latitude != null) setFlyTarget(event);
  }, []);

  const handleMarkerClick = useCallback((event) => {
    setSelected(event);
  }, []);

  const showPoints  = layerMode === 'POINTS' || layerMode === 'BOTH';
  const showHeatmap = layerMode === 'HEATMAP' || layerMode === 'BOTH';

  const mappableEvents = events.filter(e => e.latitude != null && e.longitude != null);

  return (
    <div className="conflict-page">

      {/* Top bar */}
      <div className="cf-topbar">
        <button className="cf-back" onClick={() => navigate('/')}>
          <ArrowLeft size={13}/> BACK
        </button>
        <div className="cf-title">
          ⚔️ CONFLICT INTELLIGENCE
        </div>
        <div className="cf-topbar-right">
          {lastSync && <span className="cf-sync-time">SYNCED {lastSync}</span>}
          <button
            className={`cf-refresh ${syncing ? 'cf-refresh-spinning' : ''}`}
            onClick={loadEvents}
            disabled={syncing}
          >
            <RefreshCw size={13}/>
          </button>
          <div className="cf-layer-toggle">
            {LAYER_MODES.map(m => (
              <button
                key={m}
                className={`cf-layer-btn ${layerMode === m ? 'active' : ''}`}
                onClick={() => setLayerMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && <StatBar events={events} />}

      {/* Main body */}
      <div className="cf-body">

        {/* Left feed */}
        <div className="cf-feed">
          <div className="cf-feed-header">
            <span className="cf-feed-title">LIVE FEED</span>
            <span className="cf-feed-count">{events.length}</span>
          </div>

          <div className="cf-feed-list">
            {loading ? (
              <div className="cf-loading">
                <div className="cf-loading-ring"/>
                <span>LOADING CONFLICT DATA…</span>
              </div>
            ) : error ? (
              <div className="cf-error">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            ) : events.length === 0 ? (
              <div className="cf-empty">NO CONFLICT DATA</div>
            ) : (
              <AnimatePresence>
                {events.map(ev => (
                  <ConflictCard
                    key={ev.id}
                    event={ev}
                    selected={selected?.id === ev.id}
                    onClick={handleCardClick}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="cf-map-wrap">
          {!loading && (
            <MapContainer
              center={[20, 10]}
              zoom={3}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
              attributionControl={true}
            >
              <TileLayer url={MAP_TILE} attribution={MAP_ATTR} />

              {flyTarget && <MapFlyTo target={flyTarget} />}

              {showHeatmap && <HeatmapLayer events={mappableEvents} />}

              {showPoints && mappableEvents.map(ev => {
                const color  = severityColor(ev.severity);
                const radius = markerRadius(ev.magnitude, ev.severity);
                const isSelected = selected?.id === ev.id;

                return (
                  <CircleMarker
                    key={ev.id}
                    center={[ev.latitude, ev.longitude]}
                    radius={radius}
                    pathOptions={{
                      color:       color,
                      fillColor:   color,
                      fillOpacity: isSelected ? 0.75 : 0.35,
                      weight:      isSelected ? 2.5 : 1.5,
                      opacity:     0.9,
                    }}
                    eventHandlers={{
                      click: () => handleMarkerClick(ev),
                    }}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -radius]}
                      className="cf-tooltip"
                    >
                      <div className="cf-tooltip-inner">
                        <strong>{ev.title}</strong>
                        <span>{ev.severity} · {ev.source}</span>
                        {parseFloat(ev.magnitude) > 0 &&
                          <span>💀 {ev.magnitude} fatalities</span>
                        }
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}

          {loading && (
            <div className="cf-map-loading">
              <div className="cf-loading-ring"/>
              <span>LOADING MAP…</span>
            </div>
          )}
        </div>

        {/* Right detail panel */}
        <AnimatePresence>
          {selected && (
            <ConflictDetail
              event={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
