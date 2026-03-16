import { motion } from 'framer-motion';
import { X, MapPin, AlertTriangle, ExternalLink , Radio } from 'lucide-react';
import './EventDetail.css';

const SEV_COLOR = { CRITICAL: '#ff2277', HIGH: '#ff6600', MEDIUM: '#ffcc00', LOW: '#00ff88' };
const TYPE_ICONS = {
  EARTHQUAKE:'⚡', WILDFIRE:'🔥', LAUNCH:'🚀', ASTEROID:'☄️',
  SOLAR_FLARE:'☀️', STORM:'🌀', FLOOD:'🌊', VOLCANO:'🌋',
  CONFLICT:'⚔️', AIR_QUALITY:'💨', ICE_EVENT:'🧊', DROUGHT:'🌡️',
  DUST_STORM:'🌫️', LANDSLIDE:'⛰️', NATURAL_EVENT:'🌍',
};

function Stat({ label, value, accent }) {
  return (
    <div className="ed-stat">
      <span className="ed-stat-label">{label}</span>
      <span className="ed-stat-value" style={accent ? { color: accent } : {}}>{value}</span>
    </div>
  );
}

export default function EventDetail({ event, onClose }) {
  if (!event) return null;

  const color = SEV_COLOR[event.severity] || '#00d4ff';
  const icon  = TYPE_ICONS[event.eventType] || '🌍';
  const label = event.eventType?.replace(/_/g, ' ') || 'EVENT';

  return (
    <motion.div
      className="event-detail"
      style={{ '--ec': color }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={   { opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header bar */}
      <div className="ed-header">
        <div className="ed-header-left">
          <span className="ed-type-icon">{icon}</span>
          <span className="ed-type-label">{label}</span>
        </div>
        <button className="ed-close" onClick={onClose}><X size={14} /></button>
      </div>

      {/* Severity banner */}
      <div className="ed-sev-bar" style={{ background: color, boxShadow: `0 0 16px ${color}66` }} />

      <div className="ed-body">
        {/* Title */}
        <div className="ed-title">{event.title}</div>

        {/* Severity pill */}
        <div className="ed-sev-row">
          <span className="ed-sev-pill" style={{ color, border: `1px solid ${color}66`, background: `${color}18` }}>
            <AlertTriangle size={10} /> {event.severity}
          </span>
          <span className="ed-status-pill">{event.status}</span>
        </div>

        {/* Stats grid */}
        <div className="ed-stats">
          <Stat label="SOURCE"   value={event.source}   />
          {event.magnitude != null && (
            <Stat label="MAGNITUDE" value={event.magnitude?.toFixed(2)} accent={color} />
          )}
          {event.latitude != null && (
            <Stat label="LAT / LON"
              value={`${event.latitude.toFixed(3)}° / ${event.longitude.toFixed(3)}°`} />
          )}
          {event.eventTime && (
            <Stat label="TIME"
              value={new Date(event.eventTime).toLocaleString()} />
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="ed-desc-block">
            <div className="ed-desc-label">DETAILS</div>
            <div className="ed-desc">{event.description}</div>
          </div>
        )}

        {/* Map link */}
        {event.latitude && (
          <a
            href={`https://www.google.com/maps/@${event.latitude},${event.longitude},6z`}
            target="_blank"
            rel="noreferrer"
            className="ed-map-link"
          >
            <MapPin size={11} /> VIEW ON MAP
          </a>
        )}

        {/* Source link */}
        {event.sourceUrl && (
          <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="ed-src-link">
            <ExternalLink size={11} /> SOURCE DATA
          </a>
        )}
      </div>
    </motion.div>
  );
}
