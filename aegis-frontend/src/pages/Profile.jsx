import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useEventStore } from '../store/store';
import { ArrowLeft, User, Shield, Bell, Activity, LogOut } from 'lucide-react';
import './Profile.css';

const EVENT_TYPES = [
  { key: 'EARTHQUAKE',  icon: '🌍', label: 'Earthquakes' },
  { key: 'WILDFIRE',    icon: '🔥', label: 'Wildfires' },
  { key: 'LAUNCH',      icon: '🚀', label: 'Launches' },
  { key: 'ASTEROID',    icon: '☄️', label: 'Asteroids' },
  { key: 'SOLAR_FLARE', icon: '🌞', label: 'Solar Flares' },
  { key: 'STORM',       icon: '🌪️', label: 'Storms' },
];

export default function Profile() {
  const navigate  = useNavigate();
  const { logout }  = useAuthStore();
  const events      = useEventStore((s) => s.events);
  const token       = useAuthStore((s) => s.token);

  const username = localStorage.getItem('aegis_username') || 'OPERATOR';

  const [subscriptions, setSubscriptions] = useState(
    JSON.parse(localStorage.getItem('aegis_subs') || '["EARTHQUAKE","LAUNCH"]')
  );
  const [alertSeverity, setAlertSeverity] = useState(
    localStorage.getItem('aegis_alert_severity') || 'HIGH'
  );
  const [saved, setSaved] = useState(false);

  const toggleSub = (key) => {
    setSubscriptions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    localStorage.setItem('aegis_subs', JSON.stringify(subscriptions));
    localStorage.setItem('aegis_alert_severity', alertSeverity);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Stats
  const totalEvents    = events.length;
  const criticalEvents = events.filter(e => e.severity === 'CRITICAL').length;
  const highEvents     = events.filter(e => e.severity === 'HIGH').length;
  const launches       = events.filter(e => e.eventType === 'LAUNCH').length;
  const asteroids      = events.filter(e => e.eventType === 'ASTEROID').length;

  return (
    <div className="profile-page">
      <div className="profile-bg-grid" />

      {/* Header */}
      <div className="profile-header">
        <motion.button
          className="back-btn"
          onClick={() => navigate('/')}
          whileHover={{ x: -4 }}
        >
          <ArrowLeft size={14} /> MISSION CONTROL
        </motion.button>
        <h1 className="glow-text" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '6px', fontSize: '1.5rem' }}>
          OPERATOR PROFILE
        </h1>
        <div style={{ width: 140 }} />
      </div>

      <div className="profile-content">

        {/* Left — Identity card */}
        <div className="profile-left">
          <motion.div
            className="identity-card card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Avatar */}
            <div className="avatar-ring">
              <div className="avatar-inner">
                <User size={36} color="var(--accent-cyan)" />
              </div>
            </div>

            <h2 className="profile-username">{username.toUpperCase()}</h2>
            <span className="profile-role-badge">
              <Shield size={10} /> ANALYST
            </span>

            <div className="profile-divider" />

            {/* Stats */}
            <div className="profile-stats">
              {[
                { label: 'EVENTS TRACKED', value: totalEvents, color: 'var(--accent-cyan)' },
                { label: 'CRITICAL',        value: criticalEvents, color: 'var(--accent-red)' },
                { label: 'HIGH SEVERITY',   value: highEvents, color: 'var(--accent-orange)' },
                { label: 'LAUNCHES',        value: launches, color: 'var(--accent-cyan)' },
                { label: 'ASTEROIDS',       value: asteroids, color: '#cc44ff' },
              ].map((stat) => (
                <div key={stat.label} className="profile-stat-row">
                  <span className="profile-stat-label">{stat.label}</span>
                  <motion.span
                    className="profile-stat-value"
                    style={{ color: stat.color }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {stat.value}
                  </motion.span>
                </div>
              ))}
            </div>

            <div className="profile-divider" />

            <div className="jwt-info">
              <span className="ed-stat-label">SESSION TOKEN</span>
              <span className="jwt-token">
                {token ? token.substring(0, 24) + '...' : 'No token'}
              </span>
            </div>

            <motion.button
              className="logout-btn"
              onClick={() => { logout(); navigate('/login'); }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <LogOut size={14} /> TERMINATE SESSION
            </motion.button>
          </motion.div>
        </div>

        {/* Right — Settings */}
        <div className="profile-right">

          {/* Event subscriptions */}
          <motion.div
            className="settings-card card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="settings-card-header">
              <Bell size={14} color="var(--accent-cyan)" />
              <span>ALERT SUBSCRIPTIONS</span>
            </div>
            <p className="settings-desc">
              Choose which event types trigger real-time alerts for you.
            </p>
            <div className="sub-grid">
              {EVENT_TYPES.map((et) => {
                const isActive = subscriptions.includes(et.key);
                return (
                  <motion.button
                    key={et.key}
                    className={`sub-toggle ${isActive ? 'active' : ''}`}
                    onClick={() => toggleSub(et.key)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span className="sub-icon">{et.icon}</span>
                    <span className="sub-label">{et.label}</span>
                    <span className={`sub-status ${isActive ? 'on' : 'off'}`}>
                      {isActive ? 'ON' : 'OFF'}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Alert threshold */}
          <motion.div
            className="settings-card card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="settings-card-header">
              <Activity size={14} color="var(--accent-cyan)" />
              <span>MINIMUM ALERT SEVERITY</span>
            </div>
            <p className="settings-desc">
              Only receive alerts at or above this severity level.
            </p>
            <div className="severity-selector">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((sev) => (
                <motion.button
                  key={sev}
                  className={`sev-btn severity-${sev} ${alertSeverity === sev ? 'active' : ''}`}
                  onClick={() => setAlertSeverity(sev)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {sev}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Save button */}
          <motion.button
            className={`save-btn ${saved ? 'saved' : ''}`}
            onClick={handleSave}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {saved ? '✅ PREFERENCES SAVED' : 'SAVE PREFERENCES'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
