import './Sidebar.css';

// ── Layer definitions ─────────────────────────────────────────────────
const OVERLAY_LAYERS = [
  { key: 'ISS',  label: 'ISS TRACKER', icon: '🛸' },
  { key: 'SUN',  label: 'SOL / FLARES', icon: '☀️' },
];

const EVENT_LAYERS = [
  { key: 'EARTHQUAKE',   label: 'EARTHQUAKES',   icon: '⚡' },
  { key: 'WILDFIRE',     label: 'WILDFIRES',      icon: '🔥' },
  { key: 'STORM',        label: 'STORMS',         icon: '🌀' },
  { key: 'FLOOD',        label: 'FLOODS',         icon: '🌊' },
  { key: 'VOLCANO',      label: 'VOLCANOES',      icon: '🌋' },
  { key: 'CONFLICT',     label: 'CONFLICTS',      icon: '✕'  },
  { key: 'AIR_QUALITY',  label: 'AIR QUALITY',    icon: '💨' },
  { key: 'ASTEROID',     label: 'ASTEROIDS',      icon: '☄️' },
  { key: 'SOLAR_FLARE',  label: 'SOLAR FLARES',   icon: '🌞' },
  { key: 'LAUNCH',       label: 'LAUNCHES',       icon: '🚀' },
  { key: 'ICE_EVENT',    label: 'ICE EVENTS',     icon: '🧊' },
  { key: 'DROUGHT',      label: 'DROUGHTS',       icon: '🏜️' },
  { key: 'DUST_STORM',   label: 'DUST STORMS',    icon: '🌫️' },
  { key: 'LANDSLIDE',    label: 'LANDSLIDES',     icon: '⛰️' },
  { key: 'NATURAL_EVENT',label: 'NATURAL',        icon: '🌿' },
  { key: 'TECTONIC',     label: 'TECTONIC PLATES',icon: '🗺️' },
];

// Keys that have countable backend events
const COUNTABLE = new Set([
  'EARTHQUAKE','WILDFIRE','STORM','FLOOD','VOLCANO',
  'CONFLICT','AIR_QUALITY','ASTEROID','SOLAR_FLARE',
  'LAUNCH','ICE_EVENT','DROUGHT','DUST_STORM','LANDSLIDE','NATURAL_EVENT',
]);

// ── Toggle switch ─────────────────────────────────────────────────────
function Toggle({ on, onClick }) {
  return (
    <button
      className={`sb-toggle ${on ? 'sb-toggle-on' : 'sb-toggle-off'}`}
      onClick={onClick}
      type="button"
    >
      <span className="sb-toggle-knob" />
      <span className="sb-toggle-label">{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

// ── Layer row ─────────────────────────────────────────────────────────
function LayerRow({ icon, label, layerKey, on, onToggle, count }) {
  return (
    <div className={`sb-layer-row ${on ? '' : 'sb-layer-dim'}`}>
      <span className="sb-layer-icon">{icon}</span>
      <span className="sb-layer-label">{label}</span>
      {count != null && count > 0 && (
        <span className="sb-layer-count">{count}</span>
      )}
      <Toggle on={on} onClick={() => onToggle(layerKey)} />
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────
export default function Sidebar({ layers = {}, onToggle = () => {}, events = [] }) {
  // Count events per type
  const counts = {};
  events.forEach(e => {
    if (e.eventType) counts[e.eventType] = (counts[e.eventType] || 0) + 1;
  });

  const allOn  = Object.values(layers).every(Boolean);
  const allOff = Object.values(layers).every(v => !v);

  return (
    <div className="sidebar">
      {/* ── Logo ── */}
      <div className="sb-logo">
        <div className="sb-logo-ring">
          <div className="sb-logo-inner">⬡</div>
        </div>
        <div className="sb-logo-text">
          <span className="sb-logo-title">AEGIS</span>
          <span className="sb-logo-sub">GLOBAL SENTINEL v2.0</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sb-tabs">
        <div className="sb-tab sb-tab-active">LAYERS</div>
        <div className="sb-tab">FILTER</div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="sb-content">

        {/* All on/off quick toggle */}
        <div className="sb-quick-row">
          <button
            className="sb-quick-btn"
            onClick={() => {
              const allLayers = [...OVERLAY_LAYERS, ...EVENT_LAYERS];
              allLayers.forEach(l => {
                if (!layers[l.key]) onToggle(l.key);
              });
            }}
          >
            ALL ON
          </button>
          <button
            className="sb-quick-btn sb-quick-off"
            onClick={() => {
              const allLayers = [...OVERLAY_LAYERS, ...EVENT_LAYERS];
              allLayers.forEach(l => {
                if (layers[l.key]) onToggle(l.key);
              });
            }}
          >
            ALL OFF
          </button>
        </div>

        {/* Overlay systems */}
        <div className="sb-section-label">OVERLAY SYSTEMS</div>
        {OVERLAY_LAYERS.map(l => (
          <LayerRow
            key={l.key}
            icon={l.icon}
            label={l.label}
            layerKey={l.key}
            on={!!layers[l.key]}
            onToggle={onToggle}
          />
        ))}

        {/* Event layers */}
        <div className="sb-section-label" style={{ marginTop: 12 }}>EVENT LAYERS</div>
        {EVENT_LAYERS.map(l => (
          <LayerRow
            key={l.key}
            icon={l.icon}
            label={l.label}
            layerKey={l.key}
            on={!!layers[l.key]}
            onToggle={onToggle}
            count={COUNTABLE.has(l.key) ? counts[l.key] : undefined}
          />
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="sb-footer">
        <span className="sb-footer-status">● SENTINEL ACTIVE</span>
        <span className="sb-footer-count">{events.length} EVENTS TRACKED</span>
      </div>
    </div>
  );
}
