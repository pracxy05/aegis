import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw, Wind, Flame, Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './Atmosphere.css';

// ── Constants ─────────────────────────────────────────────────────────
const BACKEND   = 'http://localhost:8080';
const MAP_TILE  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const MAP_ATTR  = '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>';
const FIRMS_KEY = process.env.REACT_APP_FIRMS_KEY || 'DEMO_KEY';
const FIRMS_URL = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/world/1`;
const FIRMS_FALLBACK = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';

const LAYER_MODES = ['AQI', 'FIRES', 'BOTH'];

const AQI_GRADIENT = {
  0.0:  '#00e400',
  0.25: '#ffff00',
  0.5:  '#ff7e00',
  0.75: '#ff0000',
  1.0:  '#8f3f97',
};

const FIRE_GRADIENT = {
  0.0: '#ffee44',
  0.4: '#ff8800',
  0.7: '#ff3300',
  1.0: '#cc0000',
};

const AQI_LEVELS = [
  { label: 'GOOD',           max: 12,  color: '#00e400', desc: 'PM2.5 < 12'   },
  { label: 'MODERATE',       max: 35,  color: '#ffff00', desc: 'PM2.5 12–35'  },
  { label: 'UNHEALTHY',      max: 55,  color: '#ff7e00', desc: 'PM2.5 35–55'  },
  { label: 'VERY UNHEALTHY', max: 150, color: '#ff0000', desc: 'PM2.5 55–150' },
  { label: 'HAZARDOUS',      max: 999, color: '#8f3f97', desc: 'PM2.5 > 150'  },
];

// ── Helpers ───────────────────────────────────────────────────────────
function pm25ToWeight(pm25) {
  const v = parseFloat(pm25) || 0;
  if (v < 12)  return 0.15;
  if (v < 35)  return 0.35;
  if (v < 55)  return 0.55;
  if (v < 150) return 0.80;
  return 1.0;
}

function pm25ToLevel(pm25) {
  const v = parseFloat(pm25) || 0;
  return AQI_LEVELS.find(l => v <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

function pm25ToAqi(pm25) {
  const v = parseFloat(pm25) || 0;
  if (v <= 12)    return Math.round((50 / 12) * v);
  if (v <= 35.4)  return Math.round(50  + ((100 - 50)  / (35.4 - 12.1)) * (v - 12.1));
  if (v <= 55.4)  return Math.round(100 + ((150 - 100) / (55.4 - 35.5)) * (v - 35.5));
  if (v <= 150.4) return Math.round(150 + ((200 - 150) / (150.4 - 55.5)) * (v - 55.5));
  return Math.round(200 + ((300 - 200) / (250.4 - 150.5)) * (v - 150.5));
}

// ── Inline CSV parser for FIRMS (no papaparse) ────────────────────────
function parseFirmsCsv(csv) {
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const latIdx  = headers.findIndex(h => h === 'latitude');
  const lonIdx  = headers.findIndex(h => h === 'longitude');
  const frpIdx  = headers.findIndex(h => h === 'frp');
  const briIdx  = headers.findIndex(h => h.startsWith('bright'));

  if (latIdx === -1 || lonIdx === -1) return [];

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',');
    const lat  = parseFloat(cols[latIdx]);
    const lon  = parseFloat(cols[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;
    result.push({
      latitude:   lat,
      longitude:  lon,
      frp:        frpIdx  !== -1 ? parseFloat(cols[frpIdx])  || 0 : 0,
      brightness: briIdx  !== -1 ? parseFloat(cols[briIdx])  || 0 : 0,
    });
  }
  return result;
}

// ── Heatmap Layer ─────────────────────────────────────────────────────
function HeatLayer({ points, gradient, radius = 26, blur = 20, show }) {
  const map      = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!show || !window.L?.heatLayer || !points.length) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      return;
    }
    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = window.L.heatLayer(points, { radius, blur, maxZoom: 12, gradient }).addTo(map);
    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  }, [map, points, gradient, radius, blur, show]);

  return null;
}

// Inject leaflet.heat once
function useLeafletHeat() {
  useEffect(() => {
    if (window.L?.heatLayer) return;
    const s  = document.createElement('script');
    s.src    = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    s.async  = true;
    document.head.appendChild(s);
  }, []);
}

// ── AQI City list ─────────────────────────────────────────────────────
function AqiCityList({ stations }) {
  const sorted = [...stations]
    .filter(s => s.pm25 != null)
    .sort((a, b) => b.pm25 - a.pm25)
    .slice(0, 12);

  return (
    <div className="atm-city-list">
      {sorted.map((s, i) => {
        const level = pm25ToLevel(s.pm25);
        const aqi   = pm25ToAqi(s.pm25);
        return (
          <div key={i} className="atm-city-row">
            <span className="atm-city-rank">#{i + 1}</span>
            <div className="atm-city-info">
              <span className="atm-city-name">{s.city || s.location || 'Unknown'}</span>
              <span className="atm-city-country">{s.country || ''}</span>
            </div>
            <div className="atm-city-aqi-wrap">
              <span
                className="atm-city-aqi"
                style={{ color: level.color, borderColor: `${level.color}44`, background: `${level.color}14` }}
              >
                {aqi}
              </span>
              <span className="atm-city-pm">PM2.5: {parseFloat(s.pm25).toFixed(1)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fire stats ────────────────────────────────────────────────────────
function FireStats({ fires }) {
  if (!fires.length) return (
    <div className="atm-fire-empty">NO FIRE DATA — CHECK FIRMS KEY</div>
  );
  const maxFrp  = Math.max(...fires.map(f => f.frp), 0).toFixed(1);
  const hottest = fires.find(f => parseFloat(f.frp) === parseFloat(maxFrp));

  return (
    <div className="atm-fire-stats">
      <div className="atm-fire-stat">
        <span className="atm-fire-stat-val" style={{ color: '#ff6600' }}>
          {fires.length.toLocaleString()}
        </span>
        <span className="atm-fire-stat-label">ACTIVE FIRE PIXELS</span>
      </div>
      <div className="atm-fire-stat">
        <span className="atm-fire-stat-val" style={{ color: '#ff2200' }}>
          {maxFrp} MW
        </span>
        <span className="atm-fire-stat-label">PEAK FIRE POWER (FRP)</span>
      </div>
      {hottest && (
        <div className="atm-fire-hotspot">
          <span className="atm-fire-hotspot-label">🔥 HOTTEST FIRE</span>
          <span className="atm-fire-hotspot-coords">
            {hottest.latitude.toFixed(2)}°, {hottest.longitude.toFixed(2)}°
          </span>
          <span className="atm-fire-hotspot-bright">
            Brightness: {hottest.brightness.toFixed(1)} K
          </span>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function Atmosphere() {
  const navigate = useNavigate();
  useLeafletHeat();

  const [aqiStations,  setAqiStations ] = useState([]);
  const [aqiPoints,    setAqiPoints   ] = useState([]);
  const [aqiLoading,   setAqiLoading  ] = useState(true);
  const [aqiError,     setAqiError    ] = useState(null);

  const [fires,        setFires       ] = useState([]);
  const [firePoints,   setFirePoints  ] = useState([]);
  const [fireLoading,  setFireLoading ] = useState(true);
  const [fireError,    setFireError   ] = useState(null);

  const [layerMode, setLayerMode] = useState('BOTH');
  const [syncing,   setSyncing  ] = useState(false);
  const [lastSync,  setLastSync ] = useState(null);
  const [activeTab, setActiveTab] = useState('AQI');

  // ── Load AQI ──────────────────────────────────────────────────────
  const loadAqi = useCallback(async () => {
    setAqiLoading(true);
    setAqiError(null);
    try {
      const res = await axios.get(`${BACKEND}/api/events`, {
        params:  { type: 'AIR_QUALITY' },
        headers: { Authorization: `Bearer ${localStorage.getItem('aegis_token')}` },
      });
      const stations = res.data
        .map(e => ({
          city:      e.title?.split(' - ')[0] || e.title,
          country:   e.source,
          pm25:      e.magnitude,
          latitude:  e.latitude,
          longitude: e.longitude,
          location:  e.title,
        }))
        .filter(s => s.latitude != null && s.longitude != null && s.pm25 != null);

      setAqiStations(stations);
      setAqiPoints(stations.map(s => [s.latitude, s.longitude, pm25ToWeight(s.pm25)]));
    } catch {
      // Fallback: OpenAQ direct
      try {
        const res = await axios.get('https://api.openaq.org/v3/measurements?limit=500&parameter=pm25');
        const stations = (res.data?.results || [])
          .filter(r => r.coordinates?.latitude != null)
          .map(r => ({
            city:      r.location?.name || String(r.locationId),
            country:   r.location?.country || '',
            pm25:      r.value,
            latitude:  r.coordinates.latitude,
            longitude: r.coordinates.longitude,
          }));
        setAqiStations(stations);
        setAqiPoints(stations.map(s => [s.latitude, s.longitude, pm25ToWeight(s.pm25)]));
      } catch {
        setAqiError('AQI data unavailable');
      }
    } finally {
      setAqiLoading(false);
    }
  }, []);

  // ── Load FIRMS fires ──────────────────────────────────────────────
  const loadFires = useCallback(async () => {
    setFireLoading(true);
    setFireError(null);
    try {
      const url = FIRMS_KEY !== 'DEMO_KEY' ? FIRMS_URL : FIRMS_FALLBACK;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csvText = await res.text();

      // Use inline parser — no papaparse
      const parsed  = parseFirmsCsv(csvText);
      setFires(parsed);

      if (parsed.length > 0) {
        const maxFrp = Math.max(...parsed.map(f => f.frp), 1);
        setFirePoints(parsed.map(f => [
          f.latitude,
          f.longitude,
          Math.min(f.frp / maxFrp, 1),
        ]));
      }
    } catch {
      setFireError('FIRMS data unavailable — check API key in .env');
    } finally {
      setFireLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setSyncing(true);
    await Promise.all([loadAqi(), loadFires()]);
    setLastSync(new Date().toLocaleTimeString());
    setSyncing(false);
  }, [loadAqi, loadFires]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 180000);
    return () => clearInterval(iv);
  }, [refresh]);

  const showAqi   = layerMode === 'AQI'   || layerMode === 'BOTH';
  const showFires = layerMode === 'FIRES'  || layerMode === 'BOTH';

  const totalStations  = aqiStations.length;
  const hazardousCount = aqiStations.filter(s => parseFloat(s.pm25) > 150).length;
  const avgPm25        = aqiStations.length
    ? (aqiStations.reduce((n, s) => n + (parseFloat(s.pm25) || 0), 0) / aqiStations.length).toFixed(1)
    : '—';

  return (
    <div className="atmosphere-page">

      {/* Top bar */}
      <div className="atm-topbar">
        <button className="atm-back" onClick={() => navigate('/')}>
          <ArrowLeft size={13}/> BACK
        </button>
        <div className="atm-title">💨 ATMOSPHERIC MONITOR</div>
        <div className="atm-topbar-right">
          {lastSync && <span className="atm-sync-time">SYNCED {lastSync}</span>}
          <button className={`atm-refresh ${syncing ? 'spinning' : ''}`} onClick={refresh} disabled={syncing}>
            <RefreshCw size={13}/>
          </button>
          <div className="atm-layer-toggle">
            {LAYER_MODES.map(m => (
              <button
                key={m}
                className={`atm-layer-btn ${layerMode === m ? 'active' : ''} atm-layer-${m.toLowerCase()}`}
                onClick={() => setLayerMode(m)}
              >
                {m === 'AQI'   ? <><Wind  size={10}/> AQI</>   :
                 m === 'FIRES' ? <><Flame size={10}/> FIRES</> :
                 <><Layers size={10}/> BOTH</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="atm-statsbar">
        <div className="atm-stat-pill atm-sp-aqi">
          💨 <strong>{totalStations.toLocaleString()}</strong> AQI STATIONS
        </div>
        <div className="atm-stat-pill atm-sp-avg">
          📊 AVG PM2.5 <strong>{avgPm25}</strong>
        </div>
        <div className="atm-stat-pill atm-sp-haz">
          ☣️ <strong>{hazardousCount}</strong> HAZARDOUS ZONES
        </div>
        <div className="atm-stat-pill atm-sp-fire">
          🔥 <strong>{fires.length.toLocaleString()}</strong> ACTIVE FIRE PIXELS
        </div>
      </div>

      {/* Body */}
      <div className="atm-body">

        {/* Left panel */}
        <div className="atm-panel">
          <div className="atm-panel-tabs">
            <button
              className={`atm-panel-tab ${activeTab === 'AQI' ? 'active' : ''}`}
              onClick={() => setActiveTab('AQI')}
            >
              <Wind size={11}/> AQI DATA
            </button>
            <button
              className={`atm-panel-tab ${activeTab === 'FIRES' ? `active fire-tab` : ''}`}
              onClick={() => setActiveTab('FIRES')}
            >
              <Flame size={11}/> FIRES
            </button>
          </div>

          {/* AQI tab */}
          {activeTab === 'AQI' && (
            <div className="atm-panel-content">
              {aqiLoading ? (
                <div className="atm-panel-loading">
                  <div className="atm-spin-ring atm-spin-purple"/>
                  <span>LOADING AQI DATA…</span>
                </div>
              ) : aqiError ? (
                <div className="atm-panel-error">⚠ {aqiError}</div>
              ) : (
                <>
                  <div className="atm-section-label">WORST AIR QUALITY — TOP 12</div>
                  <AqiCityList stations={aqiStations} />
                  <div className="atm-section-label" style={{ marginTop: 14 }}>AQI SCALE</div>
                  <div className="atm-aqi-legend">
                    {AQI_LEVELS.map(l => (
                      <div key={l.label} className="atm-leg-row">
                        <span className="atm-leg-dot" style={{ background: l.color }} />
                        <span className="atm-leg-label">{l.label}</span>
                        <span className="atm-leg-desc">{l.desc}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fires tab */}
          {activeTab === 'FIRES' && (
            <div className="atm-panel-content">
              {fireLoading ? (
                <div className="atm-panel-loading">
                  <div className="atm-spin-ring atm-spin-orange"/>
                  <span>LOADING FIRMS DATA…</span>
                </div>
              ) : fireError ? (
                <div className="atm-panel-error">
                  ⚠ {fireError}
                  <a
                    href="https://firms.modaps.eosdis.nasa.gov/api/area/"
                    target="_blank"
                    rel="noreferrer"
                    className="atm-firms-link"
                  >
                    GET FREE FIRMS KEY →
                  </a>
                </div>
              ) : (
                <>
                  <div className="atm-section-label">NASA FIRMS — 24H FIRE DATA</div>
                  <FireStats fires={fires} />
                  <div className="atm-section-label" style={{ marginTop: 14 }}>FIRE INTENSITY</div>
                  <div className="atm-fire-legend">
                    <div className="atm-fire-grad" />
                    <div className="atm-fire-grad-labels">
                      <span>LOW FRP</span>
                      <span>HIGH FRP</span>
                    </div>
                  </div>
                  <div className="atm-section-label" style={{ marginTop: 14 }}>DATA SOURCE</div>
                  <div className="atm-source-info">
                    NASA FIRMS VIIRS SNPP Near Real-Time<br/>
                    Resolution: 375m · Refreshed every 3 min
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="atm-map-wrap">
          <MapContainer
            center={[20, 0]}
            zoom={3}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer url={MAP_TILE} attribution={MAP_ATTR} />
            <HeatLayer
              points={aqiPoints}
              gradient={AQI_GRADIENT}
              radius={30}
              blur={24}
              show={showAqi && !aqiLoading}
            />
            <HeatLayer
              points={firePoints}
              gradient={FIRE_GRADIENT}
              radius={18}
              blur={14}
              show={showFires && !fireLoading}
            />
          </MapContainer>

          {/* Map overlay legend */}
          <div className="atm-map-overlay">
            {showAqi && (
              <div className="atm-map-legend">
                <div className="atm-map-legend-dot" style={{ background: '#8f3f97' }}/>
                <span>AIR QUALITY (PM2.5)</span>
              </div>
            )}
            {showFires && (
              <div className="atm-map-legend">
                <div className="atm-map-legend-dot" style={{ background: '#ff6600' }}/>
                <span>NASA FIRMS FIRES</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
