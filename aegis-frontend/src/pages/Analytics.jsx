import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { fetchAllEvents } from '../services/api';
import { ArrowLeft } from 'lucide-react';
import './Analytics.css';

const COLORS = {
  EARTHQUAKE:  '#ff4444',
  WILDFIRE:    '#ff6600',
  LAUNCH:      '#00d4ff',
  ASTEROID:    '#cc44ff',
  SOLAR_FLARE: '#ffcc00',
  STORM:       '#4488ff',
  FLOOD:       '#0066ff',
  VOLCANO:     '#ff3300',
  NATURAL_EVENT: '#ff8844',
};

const SEV_COLORS = {
  CRITICAL: '#ff4444',
  HIGH:     '#ff8800',
  MEDIUM:   '#ffcc00',
  LOW:      '#00ff88',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(2,11,24,0.97)',
        border: '1px solid rgba(0,212,255,0.3)',
        padding: '10px 14px',
        borderRadius: '6px',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '0.75rem',
        color: '#e0f4ff',
      }}>
        <p style={{ color: '#00d4ff', marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllEvents().then(res => {
      setEvents(res.data);
      setLoading(false);
    });
  }, []);

  // Events by type
  const byType = Object.entries(
    events.reduce((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }))
   .sort((a, b) => b.value - a.value);

  // Events by severity
  const bySeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => ({
    name: sev,
    value: events.filter(e => e.severity === sev).length,
    fill: SEV_COLORS[sev],
  }));

  // Events by source
  const bySource = Object.entries(
    events.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Severity distribution for bar chart
  const severityByType = ['EARTHQUAKE','WILDFIRE','LAUNCH','ASTEROID','SOLAR_FLARE'].map(type => {
    const typeEvents = events.filter(e => e.eventType === type);
    return {
      type: type.replace('_', ' '),
      CRITICAL: typeEvents.filter(e => e.severity === 'CRITICAL').length,
      HIGH:     typeEvents.filter(e => e.severity === 'HIGH').length,
      MEDIUM:   typeEvents.filter(e => e.severity === 'MEDIUM').length,
      LOW:      typeEvents.filter(e => e.severity === 'LOW').length,
    };
  });

  const totalEvents    = events.length;
  const hazardousAst   = events.filter(e =>
    e.eventType === 'ASTEROID' && e.severity !== 'LOW'
  ).length;
  const activeEQ       = events.filter(e => e.eventType === 'EARTHQUAKE').length;
  const upcomingLaunch = events.filter(e => e.eventType === 'LAUNCH').length;

  return (
    <div className="analytics-page">
      <div className="analytics-bg" />

      {/* Header */}
      <div className="analytics-header">
        <motion.button className="back-btn" onClick={() => navigate('/')} whileHover={{ x: -4 }}>
          <ArrowLeft size={14} /> MISSION CONTROL
        </motion.button>
        <h1 className="glow-text" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '6px', fontSize: '1.5rem' }}>
          ANALYTICS
        </h1>
        <div style={{ width: 140 }} />
      </div>

      {loading ? (
        <div className="loading-screen">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            style={{ width: 36, height: 36, border: '2px solid var(--accent-cyan)', borderTopColor: 'transparent', borderRadius: '50%' }}
          />
        </div>
      ) : (
        <div className="analytics-content">

          {/* KPI Cards */}
          <div className="kpi-grid">
            {[
              { label: 'TOTAL EVENTS',     value: totalEvents,    color: 'var(--accent-cyan)' },
              { label: 'EARTHQUAKES',      value: activeEQ,       color: '#ff4444' },
              { label: 'HAZARDOUS ASTRD',  value: hazardousAst,   color: '#cc44ff' },
              { label: 'LAUNCHES SCHED',   value: upcomingLaunch, color: '#00d4ff' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                className="kpi-card card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <span className="kpi-label">{kpi.label}</span>
                <span className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div className="charts-row">

            {/* Events by Type — Bar */}
            <motion.div className="chart-card card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <h3 className="chart-title">EVENTS BY TYPE</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byType} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: '#7ab8d4', fontSize: 9, fontFamily: 'monospace' }}
                    angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: '#7ab8d4', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {byType.map((entry, i) => (
                      <Cell key={i} fill={COLORS[entry.name] || '#00d4ff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Severity Pie */}
            <motion.div className="chart-card card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <h3 className="chart-title">SEVERITY DISTRIBUTION</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={bySeverity}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {bySeverity.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(v) => (
                      <span style={{ color: SEV_COLORS[v], fontFamily: 'monospace', fontSize: '0.7rem' }}>
                        {v}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            {/* By Source */}
            <motion.div className="chart-card card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <h3 className="chart-title">EVENTS BY SOURCE</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bySource} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#7ab8d4', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#7ab8d4', fontSize: 9, fontFamily: 'monospace' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#00d4ff" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Charts Row 2 — Severity breakdown stacked */}
          <motion.div className="chart-card card wide-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <h3 className="chart-title">SEVERITY BREAKDOWN BY EVENT TYPE</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={severityByType} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" />
                <XAxis dataKey="type" tick={{ fill: '#7ab8d4', fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis tick={{ fill: '#7ab8d4', fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v) => (
                  <span style={{ color: SEV_COLORS[v], fontFamily: 'monospace', fontSize: '0.7rem' }}>{v}</span>
                )} />
                <Bar dataKey="CRITICAL" stackId="a" fill="#ff4444" />
                <Bar dataKey="HIGH"     stackId="a" fill="#ff8800" />
                <Bar dataKey="MEDIUM"   stackId="a" fill="#ffcc00" />
                <Bar dataKey="LOW"      stackId="a" fill="#00ff88" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

        </div>
      )}
    </div>
  );
}
