import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useEventStore } from '../store/store';
import { ArrowLeft, RefreshCw, Activity, Zap } from 'lucide-react';
import './Intel.css';

// ── Config ────────────────────────────────────────────────────────────
const BACKEND   = 'http://localhost:8080';
const NASA_KEY  = 'j1EZNs2WaDw8zJD1yAyYW2m6ghrsF01EfmR8FVxD';
const ISS_URL   = 'https://api.wheretheiss.at/v1/satellites/25544';
const USGS_URL  = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_7days.geojson';
const SPACEX_URL= 'https://api.spacexdata.com/v5/launches/upcoming';

// ── Chart theme ───────────────────────────────────────────────────────
const CHART_COLORS = ['#00d4ff','#00ff88','#ff6600','#ff2277','#cc44ff','#ffcc00','#ff8844','#4488ff'];

const TOOLTIP_STYLE = {
  background: '#02080e',
  border: '1px solid #0d2840',
  borderRadius: '5px',
  color: '#e0f0ff',
  fontFamily: 'monospace',
  fontSize: 11,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const TICK_STYLE  = { fill: '#5a8ab0', fontSize: 10, fontFamily: 'monospace' };
const AXIS_STYLE  = { stroke: '#0d2840' };

const SEV_COLORS  = {
  CRITICAL: '#ff2277',
  HIGH:     '#ff6600',
  MEDIUM:   '#ffcc00',
  LOW:      '#00ff88',
};

// ── Helpers ───────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function magColor(mag) {
  if (mag >= 7)   return '#ff2277';
  if (mag >= 6)   return '#ff6600';
  if (mag >= 5)   return '#ffcc00';
  return '#00ff88';
}

function mlScoreColor(score) {
  if (!score && score !== 0) return '#5a8ab0';
  if (score >= 7.5) return '#ff2277';
  if (score >= 5.0) return '#ff6600';
  if (score >= 3.0) return '#ffcc00';
  return '#00ff88';
}

function mlScoreLabel(score) {
  if (!score && score !== 0) return 'OFFLINE';
  if (score >= 7.5) return 'CRITICAL';
  if (score >= 5.0) return 'ELEVATED';
  if (score >= 3.0) return 'MODERATE';
  return 'NOMINAL';
}

// Last 7 day labels
function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return d.toISOString().slice(0, 10);
  });
}

// ── Custom tooltip ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="intel-tooltip">
      <div className="intel-tt-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="intel-tt-row" style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────
function StatCard({ icon, value, label, sub, accentColor, loading }) {
  return (
    <div className="intel-stat-card" style={{ '--sc': accentColor || '#00d4ff' }}>
      <div className="isc-icon">{icon}</div>
      <div className="isc-value" style={{ color: accentColor || '#00d4ff' }}>
        {loading ? <span className="isc-loading-dot">…</span> : value}
      </div>
      <div className="isc-label">{label}</div>
      {sub && <div className="isc-sub">{sub}</div>}
      <div className="isc-glow" style={{ background: accentColor || '#00d4ff' }} />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────
function Section({ title, icon, children, accent, action }) {
  return (
    <div className="intel-section" style={{ '--sa': accent || '#00d4ff' }}>
      <div className="intel-section-header">
        <div className="intel-section-title">
          {icon && <span className="intel-section-icon">{icon}</span>}
          {title}
        </div>
        {action}
      </div>
      <div className="intel-section-body">
        {children}
      </div>
    </div>
  );
}

// ── ISS Telemetry ─────────────────────────────────────────────────────
function ISSCard({ data }) {
  if (!data) return (
    <div className="iss-loading">
      <div className="iss-spin" />
      <span>ACQUIRING ISS SIGNAL…</span>
    </div>
  );

  const fields = [
    { label: 'LATITUDE',    value: `${parseFloat(data.latitude).toFixed(4)}°`  },
    { label: 'LONGITUDE',   value: `${parseFloat(data.longitude).toFixed(4)}°` },
    { label: 'ALTITUDE',    value: `${parseFloat(data.altitude).toFixed(2)} km`},
    { label: 'VELOCITY',    value: `${parseFloat(data.velocity).toFixed(2)} km/h` },
    { label: 'VISIBILITY',  value: data.visibility?.toUpperCase() || '—'       },
    { label: 'FOOTPRINT',   value: `${parseFloat(data.footprint).toFixed(1)} km` },
  ];

  // Mini orbit arc SVG
  const W = 260, H = 60;
  const earthX = W / 2, earthY = H / 2;
  const orbitRx = 100, orbitRy = 20;
  const lon    = parseFloat(data.longitude);
  const angle  = (lon / 180) * Math.PI;
  const issX   = earthX + orbitRx * Math.cos(angle);
  const issY   = earthY + orbitRy * Math.sin(angle);

  return (
    <div className="iss-card">
      <div className="iss-fields">
        {fields.map(f => (
          <div key={f.label} className="iss-field">
            <span className="iss-field-label">{f.label}</span>
            <span className="iss-field-val">{f.value}</span>
          </div>
        ))}
      </div>
      <div className="iss-mini-orbit">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {/* Earth */}
          <circle cx={earthX} cy={earthY} r={10} fill="#0d3d78" stroke="#1a5fa8" strokeWidth={1} />
          {/* Orbit */}
          <ellipse cx={earthX} cy={earthY} rx={orbitRx} ry={orbitRy}
            fill="none" stroke="rgba(0,255,204,0.2)" strokeWidth={1} strokeDasharray="4 3" />
          {/* ISS dot */}
          <circle cx={issX} cy={issY} r={4} fill="#00ffcc">
            <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={issX} cy={issY} r={10} fill="none" stroke="rgba(0,255,204,0.25)" strokeWidth={1}>
            <animate attributeName="r"       values="6;14;6" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
          </circle>
          {/* Label */}
          <text x={issX + 8} y={issY - 5} fill="#00ffcc" fontSize={8} fontFamily="monospace">ISS</text>
        </svg>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function Intel() {
  const navigate   = useNavigate();
  const events     = useEventStore(s => s.events);

  const [mlScore,    setMlScore   ] = useState(null);
  const [quakes,     setQuakes    ] = useState([]);
  const [neos,       setNeos      ] = useState([]);
  const [spacex,     setSpaceX    ] = useState([]);
  const [issData,    setIssData   ] = useState(null);
  const [loading,    setLoading   ] = useState(true);
  const [syncing,    setSyncing   ] = useState(false);
  const [lastSync,   setLastSync  ] = useState(null);

  // ── Data transforms ──────────────────────────────────────────────
  const byType = (() => {
    const acc = {};
    events.forEach(e => { acc[e.eventType] = (acc[e.eventType] || 0) + 1; });
    return Object.entries(acc)
      .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  })();

  const bySev = ['CRITICAL','HIGH','MEDIUM','LOW'].map(s => ({
    name: s,
    value: events.filter(e => e.severity === s).length,
  })).filter(s => s.value > 0);

  const timeline = (() => {
    const days = getLast7Days();
    return days.map(day => ({
      day: day.slice(5),
      events: events.filter(e => e.eventTime?.slice(0, 10) === day).length,
    }));
  })();

  // ── Fetch all external data ──────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setSyncing(true);
    const results = await Promise.allSettled([
      // ML Score
      axios.get(`${BACKEND}/api/events/ml-score`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('aegis_token')}` }
      }),
      // USGS Earthquakes
      fetch(USGS_URL).then(r => r.json()),
      // NASA NeoWs
      fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${new Date().toISOString().slice(0,10)}&end_date=${new Date(Date.now()+86400000).toISOString().slice(0,10)}&api_key=${NASA_KEY}`)
        .then(r => r.json()),
      // SpaceX
      fetch(SPACEX_URL).then(r => r.json()),
    ]);

    if (results[0].status === 'fulfilled') setMlScore(results[0].value.data);
    if (results[1].status === 'fulfilled') {
      const qData = results[1].value?.features
        ?.map(f => ({
          id:       f.id,
          place:    f.properties.place,
          mag:      f.properties.mag,
          time:     f.properties.time,
          lat:      f.geometry.coordinates[1],
          lon:      f.geometry.coordinates[0],
          url:      f.properties.url,
          tsunami:  f.properties.tsunami,
        }))
        .filter(q => q.mag >= 4.5)
        .sort((a, b) => b.time - a.time)
        .slice(0, 10);
      setQuakes(qData || []);
    }
    if (results[2].status === 'fulfilled') {
      const neoData = Object.values(results[2].value?.near_earth_objects || {})
        .flat()
        .map(n => ({
          id:         n.id,
          name:       n.name.replace(/[()]/g, '').trim(),
          diameter:   n.estimated_diameter?.kilometers?.estimated_diameter_max?.toFixed(3) || '—',
          hazardous:  n.is_potentially_hazardous_asteroid,
          velocity:   parseFloat(n.close_approach_data?.[0]?.relative_velocity?.kilometers_per_second || 0).toFixed(2),
          missDistLunar: parseFloat(n.close_approach_data?.[0]?.miss_distance?.lunar || 0).toFixed(2),
          missDistKm:    parseFloat(n.close_approach_data?.[0]?.miss_distance?.kilometers || 0),
        }))
        .sort((a, b) => parseFloat(a.missDistLunar) - parseFloat(b.missDistLunar))
        .slice(0, 10);
      setNeos(neoData);
    }
    if (results[3].status === 'fulfilled') {
      const launches = results[3].value
        ?.filter(l => l.net)
        .sort((a, b) => new Date(a.net) - new Date(b.net))
        .slice(0, 6)
        .map(l => ({
          id:        l.id,
          name:      l.name,
          net:       l.net,
          rocket:    l.rocket,
          launchpad: l.launchpad,
          details:   l.details,
          upcoming:  l.upcoming,
        }));
      setSpaceX(launches || []);
    }

    setLastSync(new Date().toLocaleTimeString());
    setSyncing(false);
    setLoading(false);
  }, []);

  // ISS refresh every 10s
  useEffect(() => {
    const fetchISS = () =>
      fetch(ISS_URL).then(r => r.json()).then(setIssData).catch(() => {});
    fetchISS();
    const iv = setInterval(fetchISS, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 90000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  // ── Computed counts ──────────────────────────────────────────────
  const totalEvents   = events.length;
  const wildfires     = events.filter(e => e.eventType === 'WILDFIRE').length;
  const quakeCount    = quakes.length;
  const conflictCount = events.filter(e => e.eventType === 'CONFLICT').length;
  const neoCount      = neos.length;
  const hazardousNeos = neos.filter(n => n.hazardous).length;
  const mlVal         = mlScore?.threatScore ?? mlScore?.score ?? mlScore;
  const mlNum         = typeof mlVal === 'number' ? mlVal.toFixed(1) : null;

  return (
    <div className="intel-page">

      {/* Top bar */}
      <div className="intel-topbar">
        <button className="intel-back" onClick={() => navigate('/')}>
          <ArrowLeft size={13}/> BACK
        </button>
        <div className="intel-title">
          <Activity size={13}/> GLOBAL INTELLIGENCE
        </div>
        <div className="intel-topbar-right">
          {lastSync && <span className="intel-sync">SYNCED {lastSync}</span>}
          <button
            className={`intel-refresh ${syncing ? 'spinning' : ''}`}
            onClick={fetchAll}
            disabled={syncing}
          >
            <RefreshCw size={13}/>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="intel-body">

        {/* ── Stat cards row ── */}
        <div className="intel-stats-row">
          <StatCard icon="🌍" value={totalEvents}   label="TOTAL EVENTS"    sub="24h monitoring"   accentColor="#00d4ff" loading={loading} />
          <StatCard icon="🔥" value={wildfires}      label="ACTIVE WILDFIRES" sub="from EONET+FIRMS" accentColor="#ff6600" loading={loading} />
          <StatCard icon="⚡" value={quakeCount}     label="EARTHQUAKES"     sub="significant 7d"   accentColor="#ffcc00" loading={loading} />
          <StatCard icon="⚔️" value={conflictCount}  label="CONFLICT ZONES"  sub="from ACLED"        accentColor="#ff2277" loading={loading} />
          <StatCard icon="☄️" value={neoCount}        label="NEOs TODAY"      sub={`${hazardousNeos} hazardous`} accentColor="#cc44ff" loading={loading} />
          <StatCard
            icon="🛡️"
            value={mlNum ? `${mlNum}/10` : 'OFFLINE'}
            label="EARTH THREAT SCORE"
            sub={mlScoreLabel(parseFloat(mlNum))}
            accentColor={mlScoreColor(parseFloat(mlNum))}
            loading={loading}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="intel-charts-row">

          {/* Events by type */}
          <Section title="EVENTS BY TYPE" icon="📊" accent="#00d4ff">
            {byType.length === 0 ? (
              <div className="intel-no-data">NO DATA — START BACKEND</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byType} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={TICK_STYLE} axisLine={AXIS_STYLE} tickLine={false} />
                  <YAxis type="category" dataKey="type" tick={{ ...TICK_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={14}>
                    {byType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Severity donut */}
          <Section title="SEVERITY SPLIT" icon="🎯" accent="#ff6600">
            {bySev.length === 0 ? (
              <div className="intel-no-data">NO DATA</div>
            ) : (
              <div className="intel-pie-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={bySev}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {bySev.map((entry, i) => (
                        <Cell key={i} fill={SEV_COLORS[entry.name]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      formatter={(v) => <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#5a8ab0', letterSpacing: 1 }}>{v}</span>}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="intel-pie-center">
                  <span className="intel-pie-total">{totalEvents}</span>
                  <span className="intel-pie-total-label">EVENTS</span>
                </div>
              </div>
            )}
          </Section>

          {/* 7-day timeline */}
          <Section title="7-DAY TIMELINE" icon="📈" accent="#00ff88">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeline} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                <XAxis dataKey="day" tick={TICK_STYLE} axisLine={AXIS_STYLE} tickLine={false} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="events"
                  stroke="#00ff88"
                  strokeWidth={2}
                  dot={{ fill: '#00ff88', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#00ffcc', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Section>
        </div>

        {/* ── Data feeds row ── */}
        <div className="intel-feeds-row">

          {/* Earthquake feed */}
          <Section title="EARTHQUAKE FEED" icon="⚡" accent="#ffcc00">
            {quakes.length === 0 ? (
              <div className="intel-no-data">
                {loading ? 'LOADING USGS DATA…' : 'NO SIGNIFICANT EARTHQUAKES THIS WEEK'}
              </div>
            ) : (
              <div className="intel-table-wrap">
                <table className="intel-table">
                  <thead>
                    <tr>
                      <th>MAG</th>
                      <th>LOCATION</th>
                      <th>TIME</th>
                      <th>TSUNAMI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quakes.map(q => (
                      <tr key={q.id} className="intel-table-row">
                        <td>
                          <span className="intel-mag-badge" style={{
                            color: magColor(q.mag),
                            borderColor: `${magColor(q.mag)}44`,
                            background: `${magColor(q.mag)}12`,
                          }}>
                            M{q.mag?.toFixed(1)}
                          </span>
                        </td>
                        <td className="intel-td-place">{q.place}</td>
                        <td className="intel-td-time">{timeAgo(q.time)}</td>
                        <td>
                          {q.tsunami ? (
                            <span className="intel-tsunami-warn">⚠ YES</span>
                          ) : (
                            <span className="intel-tsunami-no">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* NEO feed */}
          <Section title="ASTEROID APPROACHES" icon="☄️" accent="#cc44ff">
            {neos.length === 0 ? (
              <div className="intel-no-data">
                {loading ? 'LOADING NASA CNEOS DATA…' : 'NO NEO DATA'}
              </div>
            ) : (
              <div className="intel-table-wrap">
                <table className="intel-table">
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>DIAM (km)</th>
                      <th>VELOCITY</th>
                      <th>MISS DIST</th>
                      <th>⚠</th>
                    </tr>
                  </thead>
                  <tbody>
                    {neos.map(n => (
                      <tr key={n.id} className={`intel-table-row ${n.hazardous ? 'intel-row-haz' : ''}`}>
                        <td className="intel-td-name">{n.name}</td>
                        <td className="intel-td-mono">{n.diameter}</td>
                        <td className="intel-td-mono">{n.velocity} km/s</td>
                        <td className="intel-td-mono">
                          <span style={{ color: parseFloat(n.missDistLunar) < 3 ? '#ff2277' : parseFloat(n.missDistLunar) < 10 ? '#ff6600' : '#5a8ab0' }}>
                            {n.missDistLunar} LD
                          </span>
                        </td>
                        <td>
                          {n.hazardous ? (
                            <span className="intel-haz-badge">PHO</span>
                          ) : (
                            <span className="intel-safe-badge">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="intel-neo-note">LD = Lunar Distance (384,400 km) · PHO = Potentially Hazardous Object</div>
              </div>
            )}
          </Section>
        </div>

        {/* ── Bottom row: ISS + SpaceX ── */}
        <div className="intel-bottom-row">

          {/* ISS Telemetry */}
          <Section title="ISS LIVE TELEMETRY" icon="🛸" accent="#00ffcc">
            <ISSCard data={issData} />
          </Section>

          {/* SpaceX Launches */}
          <Section title="UPCOMING LAUNCHES" icon="🚀" accent="#ff8844">
            {spacex.length === 0 ? (
              <div className="intel-no-data">
                {loading ? 'LOADING LAUNCH DATA…' : 'NO UPCOMING LAUNCHES'}
              </div>
            ) : (
              <div className="intel-launches">
                {spacex.map(l => (
                  <div key={l.id} className="intel-launch-row">
                    <div className="intel-launch-icon">🚀</div>
                    <div className="intel-launch-info">
                      <div className="intel-launch-name">{l.name}</div>
                      <div className="intel-launch-meta">
                        <span className="intel-launch-date">{formatDate(l.net)}</span>
                        {l.details && (
                          <span className="intel-launch-details">{l.details.slice(0, 70)}{l.details.length > 70 ? '…' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="intel-launch-countdown">
                      {timeAgo(l.net) === '0s ago' ? 'IMMINENT' : formatDate(l.net)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

      </div>
    </div>
  );
}
