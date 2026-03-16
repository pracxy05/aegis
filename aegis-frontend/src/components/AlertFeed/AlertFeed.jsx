import { motion, AnimatePresence } from 'framer-motion';
import { useEventStore } from '../../store/store';
import { ExternalLink, Radio } from 'lucide-react';
import './AlertFeed.css';

const SEV_COLOR = { CRITICAL: '#ff2277', HIGH: '#ff6600', MEDIUM: '#ffcc00', LOW: '#00ff88' };

const TYPE_ICONS = {
  EARTHQUAKE:'⚡', WILDFIRE:'🔥', LAUNCH:'🚀', ASTEROID:'☄️',
  SOLAR_FLARE:'☀️', STORM:'🌀', FLOOD:'🌊', VOLCANO:'🌋',
  CONFLICT:'⚔️', AIR_QUALITY:'💨', ICE_EVENT:'🧊', DROUGHT:'🌡️',
  DUST_STORM:'🌫️', LANDSLIDE:'⛰️', NATURAL_EVENT:'🌍',
};

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

export default function AlertFeed() {
  const alerts = useEventStore(s => s.alerts);

  return (
    <div className="alert-feed">
      {/* Header */}
      <div className="af-header">
        <div className="af-header-left">
          <Radio size={12} className="af-radio-icon" />
          <span className="af-title">LIVE ALERTS</span>
        </div>
        <span className="af-count">{alerts.length} ACTIVE</span>
      </div>

      {/* Feed */}
      <div className="af-list">
        <AnimatePresence initial={false}>
          {alerts.length === 0 ? (
            <motion.div
              className="af-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="af-empty-ring" />
              <span className="af-empty-text">ALL SYSTEMS NOMINAL</span>
              <span className="af-empty-sub">MONITORING ACTIVE</span>
            </motion.div>
          ) : (
            alerts.map((alert, i) => {
              const color = SEV_COLOR[alert.severity] || '#00d4ff';
              const icon  = TYPE_ICONS[alert.eventType] || '📡';
              return (
                <motion.div
                  key={alert.id ?? i}
                  className="af-item"
                  style={{ '--ac': color }}
                  initial={{ opacity: 0, x: 24, height: 0 }}
                  animate={{ opacity: 1, x: 0,  height: 'auto' }}
                  exit={   { opacity: 0, x: 24, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="af-item-left">
                    <span className="af-item-sev-bar" style={{ background: color }} />
                    <span className="af-item-icon">{icon}</span>
                  </div>
                  <div className="af-item-body">
                    <div className="af-item-title">{alert.title}</div>
                    <div className="af-item-meta">
                      <span style={{ color }} className="af-sev-chip">{alert.severity}</span>
                      <span className="af-dot">·</span>
                      <span className="af-source">{alert.source}</span>
                      <span className="af-dot">·</span>
                      <span className="af-time">{timeAgo(alert.fetchedAt || alert.eventTime)}</span>
                    </div>
                    {alert.description && (
                      <div className="af-item-desc">
                        {alert.description.slice(0, 110)}{alert.description.length > 110 ? '…' : ''}
                      </div>
                    )}
                    {alert.sourceUrl && (
                      <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="af-link">
                        <ExternalLink size={9} /> SOURCE
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
