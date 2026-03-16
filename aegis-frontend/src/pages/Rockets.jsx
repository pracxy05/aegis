import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchByType } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, ExternalLink } from 'lucide-react';
import './Rockets.css';

function Countdown({ windowStart }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(windowStart) - new Date();
      if (diff <= 0) { setIsPast(true); setTimeLeft('LAUNCHED'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${d}D ${String(h).padStart(2,'0')}H ${String(m).padStart(2,'0')}M ${String(s).padStart(2,'0')}S`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [windowStart]);

  return (
    <div className={`countdown ${isPast ? 'launched' : ''}`}>
      <span className="countdown-label">T-MINUS</span>
      <span className="countdown-value">{timeLeft}</span>
    </div>
  );
}

function extractWindow(description) {
  if (!description) return null;
  const match = description.match(/Window: (.+)/);
  return match ? match[1] : null;
}

function extractRocket(description) {
  if (!description) return 'Unknown';
  const match = description.match(/Rocket: ([^|]+)/);
  return match ? match[1].trim() : 'Unknown';
}

const ROCKET_COLORS = {
  'Falcon 9': '#00d4ff',
  'Falcon Heavy': '#00aaff',
  'Starship': '#ff8800',
  'New Shepard': '#44ff88',
  'Ariane': '#cc44ff',
  'Soyuz': '#ff4444',
  'Atlas V': '#ffcc00',
  'Vulcan': '#00ffcc',
  'default': '#7ab8d4',
};

function getRocketColor(name) {
  for (const key of Object.keys(ROCKET_COLORS)) {
    if (name?.includes(key)) return ROCKET_COLORS[key];
  }
  return ROCKET_COLORS['default'];
}

export default function Rockets() {
  const [launches, setLaunches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchByType('LAUNCH').then(res => {
      setLaunches(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="rockets-page">
      {/* Background animated particles */}
      <div className="rockets-bg">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="star-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="rockets-header">
        <motion.button
          className="back-btn"
          onClick={() => navigate('/')}
          whileHover={{ x: -4 }}
        >
          <ArrowLeft size={16} /> MISSION CONTROL
        </motion.button>
        <div className="rockets-title-block">
          <h1 className="glow-text rockets-title">LAUNCH MANIFEST</h1>
          <p className="rockets-subtitle">
            {launches.length} MISSIONS SCHEDULED • LIVE TRACKING
          </p>
        </div>
        <div className="next-launch-badge">
          {launches[0] && (
            <>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '2px' }}>
                NEXT LAUNCH
              </span>
              <Countdown windowStart={extractWindow(launches[0]?.description)} />
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="rockets-content">
        {/* Launch list */}
        <div className="launch-list">
          {loading ? (
            <div className="loading-screen">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                style={{ width: 32, height: 32, border: '2px solid var(--accent-cyan)', borderTopColor: 'transparent', borderRadius: '50%' }}
              />
            </div>
          ) : launches.map((launch, i) => {
            const rocketName = extractRocket(launch.description);
            const color = getRocketColor(rocketName);
            const windowTime = extractWindow(launch.description);
            const isSelected = selected?.id === launch.id;

            return (
              <motion.div
                key={launch.id}
                className={`launch-card ${isSelected ? 'selected' : ''}`}
                style={{ borderLeft: `3px solid ${color}` }}
                onClick={() => setSelected(isSelected ? null : launch)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ x: 4 }}
              >
                <div className="launch-card-top">
                  <div className="launch-number" style={{ color }}>
                    #{String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="launch-info">
                    <h3 className="launch-name">{launch.title}</h3>
                    <div className="launch-meta">
                      <span style={{ color }}>{rocketName}</span>
                      {launch.latitude && (
                        <span>
                          <MapPin size={10} />
                          {launch.latitude?.toFixed(2)}°, {launch.longitude?.toFixed(2)}°
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="launch-status">
                    <span className="status-badge">UPCOMING</span>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      className="launch-expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="launch-expanded-inner">
                        {windowTime && (
                          <div className="expanded-countdown">
                            <Countdown windowStart={windowTime} />
                          </div>
                        )}
                        <div className="expanded-grid">
                          <div className="expanded-stat">
                            <span className="ed-stat-label">VEHICLE</span>
                            <span style={{ color, fontFamily: 'var(--font-mono)' }}>{rocketName}</span>
                          </div>
                          <div className="expanded-stat">
                            <span className="ed-stat-label">WINDOW</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                              {windowTime ? new Date(windowTime).toLocaleString() : 'TBD'}
                            </span>
                          </div>
                          <div className="expanded-stat">
                            <span className="ed-stat-label">LAT / LON</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                              {launch.latitude?.toFixed(4)}° / {launch.longitude?.toFixed(4)}°
                            </span>
                          </div>
                          <div className="expanded-stat">
                            <span className="ed-stat-label">SOURCE</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                              {launch.source}
                            </span>
                          </div>
                        </div>
                        {launch.sourceUrl && (
                          <a
                            href={launch.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ed-source-link"
                            style={{ borderColor: color, color }}
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={12} /> VIEW FULL MISSION DATA
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
