import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Globe from '../components/Globe/Globe';
import Sidebar from '../components/Sidebar/Sidebar';
import AlertFeed from '../components/AlertFeed/AlertFeed';
import EventDetail from '../components/EventDetail/EventDetail';
import { fetchAllEvents, fetchMLEarthScore } from '../services/api';
import { connectWebSocket, disconnectWebSocket } from '../services/websocket';
import { useEventStore, useAuthStore } from '../store/store';
import {
  Rocket, User, LogOut, Activity, Star,
  Wifi, WifiOff, Shield, Wind, Swords, Image,
} from 'lucide-react';
import './Dashboard.css';

// ── Constants ──────────────────────────────────────────────────────────
const DEFAULT_LAYERS = {
  ISS:           true,
  SUN:           true,
  EARTHQUAKE:    true,
  WILDFIRE:      true,
  STORM:         true,
  FLOOD:         true,
  VOLCANO:       true,
  CONFLICT:      true,
  AIR_QUALITY:   true,
  ASTEROID:      true,
  SOLAR_FLARE:   true,
  LAUNCH:        true,
  ICE_EVENT:     true,
  DROUGHT:       true,
  DUST_STORM:    true,
  LANDSLIDE:     true,
  NATURAL_EVENT: true,
};

const BOOT_STEPS = [
  '▸ INITIALIZING SENSOR GRID...',
  '▸ LOADING ORBITAL ELEMENTS...',
  '▸ CONNECTING LIVE FEEDS...',
  '▸ RENDERING EARTH SYSTEMS...',
];

// ── toArray: safely normalise any backend response to a plain array ─────
function toArray(val) {
  if (!val)                      return [];
  if (Array.isArray(val))        return val;
  if (Array.isArray(val.content))return val.content; // Spring Page
  if (Array.isArray(val.data))   return val.data;    // axios / generic wrapper
  return [];
}

// ── Earth Score ────────────────────────────────────────────────────────
function EarthScore({ score, mlScore }) {
  const val   = mlScore?.score ?? score ?? 72;
  const level = val >= 80 ? 'STABLE'   : val >= 60 ? 'MODERATE'
              : val >= 40 ? 'ELEVATED' : 'CRITICAL';
  const color = val >= 80 ? 'var(--accent-green)'  : val >= 60 ? 'var(--accent-yellow)'
              : val >= 40 ? 'var(--accent-orange)'  : 'var(--accent-red)';
  return (
    <div className="earth-score-block">
      <span className="earth-score-label">EARTH THREAT SCORE</span>
      <div className="earth-score-value-row">
        <span className="earth-score-number" style={{ color }}>{val}</span>
        <span className="earth-score-level"  style={{ color }}>{level}</span>
        <span className="ml-badge">● AI</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${val}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── Store ────────────────────────────────────────────────────────
  const { events: rawEvents, setEvents, addAlert } = useEventStore();
  const { logout } = useAuthStore();
  const navigate   = useNavigate();

  // toArray so .filter / .length never crash regardless of backend shape
  const events = toArray(rawEvents);

  // ── State ────────────────────────────────────────────────────────
  const [booting,       setBooting      ] = useState(true);
  const [bootStep,      setBootStep     ] = useState(0);
  const [loading,       setLoading      ] = useState(true);
  const [syncPulse,     setSyncPulse    ] = useState(false);
  const [lastSync,      setLastSync     ] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [issPosition,   setIssPosition  ] = useState(null);
  const [mlScore,       setMlScore      ] = useState(null);
  const [wsConnected,   setWsConnected  ] = useState(false);
  const [layers,        setLayers       ] = useState(DEFAULT_LAYERS);

  // ── Boot sequence ────────────────────────────────────────────────
  useEffect(() => {
    let step = 0;
    const iv = setInterval(() => {
      step++;
      setBootStep(step);
      if (step >= BOOT_STEPS.length) {
        clearInterval(iv);
        setTimeout(() => setBooting(false), 400);
      }
    }, 480);
    return () => clearInterval(iv);
  }, []);

  // ── ISS position ────────────────────────────────────────────────
  useEffect(() => {
    const fetchISS = async () => {
      try {
        const res  = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        const data = await res.json();
        setIssPosition({ lat: data.latitude, lon: data.longitude });
      } catch { /* silent */ }
    };
    fetchISS();
    const iv = setInterval(fetchISS, 10000);
    return () => clearInterval(iv);
  }, []);

  // ── Load events (original axios .data pattern preserved) ────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadEvents = useCallback(async () => {
    try {
      setSyncPulse(true);

      // fetchAllEvents returns an axios response — use .data
      const res = await fetchAllEvents();
      setEvents(toArray(res?.data ?? res));
      setLastSync(new Date().toLocaleTimeString());
      setTimeout(() => setSyncPulse(false), 1000);

      // ML score — graceful fallback
      try {
        const scoreRes = await fetchMLEarthScore();
        setMlScore(scoreRes?.data ?? scoreRes);
      } catch { /* ML offline — ignore */ }

    } catch {
      toast.error('Failed to reach AEGIS backend', { icon: '⚠️' });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Poll + WebSocket (original 3-arg signature preserved) ───────
  useEffect(() => {
    loadEvents();
    const iv = setInterval(loadEvents, 60000);

    // Original connectWebSocket call: positional callbacks
    connectWebSocket(
      (alert) => {
        addAlert(alert);
        setWsConnected(true);
        toast.custom(() => (
          <div className="aegis-toast show">
            <span className="aegis-toast-icon">⚡</span>
            <span>{alert?.title || 'New event detected'}</span>
          </div>
        ), { duration: 4000 });
        loadEvents();
      },
      () => setWsConnected(true),
      () => setWsConnected(false),
    );

    return () => {
      clearInterval(iv);
      disconnectWebSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────────
  const handleLayerToggle = useCallback((key) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleEventSelect = useCallback((ev) => {
    setSelectedEvent(ev);
  }, []);

  const handleLogout = () => {
    disconnectWebSocket();
    logout();
    navigate('/login');
  };

  // ── Bottom bar counts ────────────────────────────────────────────
  const count = (type) => events.filter(e => e.eventType === type).length;

  const bottomStats = [
    { icon: '⚡', label: 'QUAKES',     val: count('EARTHQUAKE')  },
    { icon: '🔥', label: 'FIRES',      val: count('WILDFIRE')    },
    { icon: '✕',  label: 'CONFLICTS',  val: count('CONFLICT')    },
    { icon: '🌀', label: 'STORMS',     val: count('STORM')       },
    { icon: '🌋', label: 'VOLCANOES',  val: count('VOLCANO')     },
    { icon: '☄️', label: 'ASTEROIDS',  val: count('ASTEROID')    },
    { icon: '💨', label: 'AIR ALERTS', val: count('AIR_QUALITY') },
    { icon: '🚀', label: 'LAUNCHES',   val: count('LAUNCH')      },
  ];

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" />

      {/* Boot overlay */}
      <AnimatePresence>
        {booting && (
          <motion.div
            className="boot-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="boot-logo">
              <div className="boot-logo-ring boot-ring-1" />
              <div className="boot-logo-ring boot-ring-2" />
              <div className="boot-logo-ring boot-ring-3" />
              <span className="boot-logo-text">AEGIS</span>
            </div>
            <div className="boot-title">GLOBAL SENTINEL v2.0</div>
            <div className="boot-steps">
              {BOOT_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`boot-step ${i < bootStep ? 'done' : i === bootStep ? 'active' : ''}`}
                >
                  {step}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      {!booting && (
        <div className="dashboard">

          {/* Sidebar */}
          <div className="dashboard-sidebar">
            <Sidebar
              layers={layers}
              onToggle={handleLayerToggle}
              events={events}
            />
          </div>

          {/* Center */}
          <div className="dashboard-main">

            {/* Topbar */}
            <div className="dashboard-topbar">

              {/* Left: sync + ws + ISS */}
              <div className="topbar-left">
                <div className={`sync-indicator ${syncPulse ? 'syncing' : ''}`}>
                  <span className="sync-dot" />
                  <span className="sync-label">
                    {syncPulse ? 'SYNCING…' : `SYNC ${lastSync || '—'}`}
                  </span>
                </div>

                <div className={`ws-indicator ${wsConnected ? 'connected' : 'disconnected'}`}>
                  {wsConnected ? <Wifi size={10}/> : <WifiOff size={10}/>}
                  {wsConnected ? 'LIVE' : 'OFFLINE'}
                </div>

                {issPosition && (
                  <div className="iss-indicator">
                    🛸 ISS &nbsp;
                    {Math.abs(issPosition.lat).toFixed(2)}°{issPosition.lat >= 0 ? 'N' : 'S'}&nbsp;
                    {Math.abs(issPosition.lon).toFixed(2)}°{issPosition.lon >= 0 ? 'E' : 'W'}
                  </div>
                )}
              </div>

              {/* Center: Earth score */}
              <EarthScore score={72} mlScore={mlScore} />

              {/* Right: badge + all nav buttons */}
              <div className="topbar-right">

                <div className="event-count-badge">
                  <span className="event-count-number">{events.length}</span>
                  <span className="event-count-label">EVENTS</span>
                </div>

                <div className="nav-buttons">

                  {/* ── Original buttons ── */}
                  <button className="nav-btn" onClick={() => navigate('/rockets')}>
                    <Rocket size={11}/> LAUNCHES
                  </button>

                  {/* COSMOS → new 3D star map */}
                  <button className="nav-btn nav-cosmos" onClick={() => navigate('/cosmos')}>
                    <Star size={11}/> COSMOS
                  </button>

                  {/* APOD → old NASA photo page */}
                  <button className="nav-btn nav-apod" onClick={() => navigate('/stars')}>
                    <Image size={11}/> APOD
                  </button>

                  <div className="nav-divider" />

                  {/* ── New buttons ── */}
                  <button className="nav-btn nav-conflict" onClick={() => navigate('/conflict')}>
                    <Swords size={11}/> CONFLICT
                  </button>

                  <button className="nav-btn nav-atmosphere" onClick={() => navigate('/atmosphere')}>
                    <Wind size={11}/> ATMOSPHERE
                  </button>

                  <button className="nav-btn nav-defense" onClick={() => navigate('/defense')}>
                    <Shield size={11}/> DEFENSE
                  </button>

                  <div className="nav-divider" />

                  <button className="nav-btn nav-intel" onClick={() => navigate('/intel')}>
                    <Activity size={11}/> INTEL
                  </button>

                  <div className="nav-divider" />

                  <button className="nav-btn icon-only" onClick={() => navigate('/profile')} title="Profile">
                    <User size={13}/>
                  </button>

                  <button className="nav-btn icon-only danger" onClick={handleLogout} title="Logout">
                    <LogOut size={13}/>
                  </button>
                </div>
              </div>
            </div>

            {/* Globe */}
            <div className="globe-wrapper">
              <Globe
                layers={layers}
                events={events}
                onSelectEvent={handleEventSelect}
                onIssUpdate={setIssPosition}
              />
            </div>

            {/* Bottom stats */}
            <div className="dashboard-bottombar">
              {bottomStats.map(s => (
                <div key={s.label} className="bottom-stat">
                  <span className="bs-icon">{s.icon}</span>
                  <span className="bs-val">{s.val}</span>
                  <span className="bs-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="dashboard-right">
            <AlertFeed events={events} onSelect={handleEventSelect} />
          </div>
        </div>
      )}

      {/* Event detail modal */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetail
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
