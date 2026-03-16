import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Eye, EyeOff, Star } from 'lucide-react';
import './Cosmos.css';

// ── Constants ──────────────────────────────────────────────────────────
const SPECTRAL_MAP = {
  O: '#9bb0ff', B: '#aabfff', A: '#cad7ff',
  F: '#f8f7ff', G: '#fff4e8', K: '#ffd2a1', M: '#ffcc6f',
};
const DEFAULT_STAR_COLOR = '#ffffff';
const MAG_LIMIT  = 6.5;
const SPHERE_R   = 100;
const CONST_R    = 98;

// ── Helpers ────────────────────────────────────────────────────────────
function raDecToVec3(ra, dec, r = SPHERE_R) {
  const raRad  = (ra / 24) * 2 * Math.PI;
  const decRad = dec * (Math.PI / 180);
  return new THREE.Vector3(
    r * Math.cos(decRad) * Math.cos(raRad),
    r * Math.sin(decRad),
    r * Math.cos(decRad) * Math.sin(raRad)
  );
}

function spectralColor(spect) {
  if (!spect) return DEFAULT_STAR_COLOR;
  const key = spect.trim()[0]?.toUpperCase();
  return SPECTRAL_MAP[key] || DEFAULT_STAR_COLOR;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

function constellationCentroid(vertices) {
  if (!vertices || !vertices.length) return null;
  let raSum = 0, decSum = 0;
  vertices.forEach(([ra, dec]) => { raSum += ra; decSum += dec; });
  return raDecToVec3(raSum / vertices.length, decSum / vertices.length, SPHERE_R * 0.8);
}

// ── Inline CSV parser (no papaparse) ──────────────────────────────────
function parseHYGCsv(csv) {
  const lines   = csv.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());

  const idxId     = headers.indexOf('id');
  const idxRa     = headers.indexOf('ra');
  const idxDec    = headers.indexOf('dec');
  const idxMag    = headers.indexOf('mag');
  const idxSpect  = headers.indexOf('spect');
  const idxProper = headers.indexOf('proper');

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',');
    const mag  = parseFloat(cols[idxMag]);
    if (isNaN(mag) || mag > MAG_LIMIT) continue;
    const ra  = parseFloat(cols[idxRa]);
    const dec = parseFloat(cols[idxDec]);
    if (isNaN(ra) || isNaN(dec)) continue;
    result.push({
      id:     cols[idxId]     || i,
      ra,
      dec,
      mag,
      spect:  cols[idxSpect]  || '',
      proper: cols[idxProper] || '',
    });
  }
  return result;
}

// ── Star Points ────────────────────────────────────────────────────────
function StarField({ stars, showSpectral }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(stars.length * 3);
    stars.forEach((s, i) => {
      const v = raDecToVec3(s.ra, s.dec);
      arr[i * 3]     = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    });
    return arr;
  }, [stars]);

  const colors = useMemo(() => {
    const arr = new Float32Array(stars.length * 3);
    stars.forEach((s, i) => {
      const hex      = showSpectral ? spectralColor(s.spect) : '#cce8ff';
      const [r, g, b] = hexToRgb(hex);
      arr[i * 3]     = r;
      arr[i * 3 + 1] = g;
      arr[i * 3 + 2] = b;
    });
    return arr;
  }, [stars, showSpectral]);

  const material = useMemo(() => new THREE.PointsMaterial({
    vertexColors:    true,
    sizeAttenuation: false,
    size:            1.6,
    transparent:     true,
    opacity:         0.95,
  }), []);

  return (
    <points material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors,    3]} />
      </bufferGeometry>
    </points>
  );
}

// ── Constellation Lines ────────────────────────────────────────────────
function ConstellationLines({ constellations, showLines, selectedId }) {
  const geos = useMemo(() => {
    return constellations.map(c => {
      const allVerts = [];
      (c.lines || []).forEach(seg => {
        for (let i = 0; i < seg.length - 1; i++) {
          const a = raDecToVec3(seg[i][0],   seg[i][1],   CONST_R);
          const b = raDecToVec3(seg[i+1][0], seg[i+1][1], CONST_R);
          allVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
      return { id: c.id, name: c.name, geo: g };
    });
  }, [constellations]);

  if (!showLines) return null;

  return geos.map(({ id, geo }) => (
    <lineSegments key={id} geometry={geo}>
      <lineBasicMaterial
        color={selectedId === id ? '#00ffcc' : '#1a4a8a'}
        transparent
        opacity={selectedId === id ? 0.9 : 0.45}
        depthWrite={false}
      />
    </lineSegments>
  ));
}

// ── Constellation Labels ───────────────────────────────────────────────
function ConstellationLabels({ constellations, showLabels, selectedId, onSelect }) {
  if (!showLabels) return null;

  return constellations.map(c => {
    const allVerts = (c.lines || []).flat();
    if (!allVerts.length) return null;
    const centroid = constellationCentroid(allVerts);
    if (!centroid) return null;

    return (
      <group key={c.id} position={centroid}>
        <Html center distanceFactor={120}>
          <div
            className={`cosmos-label ${selectedId === c.id ? 'cosmos-label-active' : ''}`}
            onClick={() => onSelect(c.id === selectedId ? null : c)}
          >
            {c.name || c.id}
          </div>
        </Html>
      </group>
    );
  });
}

// ── Camera Fly-to ──────────────────────────────────────────────────────
function CameraFlyTo({ target, onDone }) {
  const { camera } = useThree();
  const progress   = useRef(0);
  const from       = useRef(null);
  const active     = useRef(false);

  useEffect(() => {
    if (!target) return;
    from.current     = camera.position.clone().normalize();
    progress.current = 0;
    active.current   = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useFrame(() => {
    if (!active.current || !target || !from.current) return;
    progress.current = Math.min(1, progress.current + 0.018);
    const dir  = target.clone().normalize();
    const curr = from.current.clone().lerp(dir, progress.current).normalize();
    camera.position.copy(curr.multiplyScalar(0.01));
    camera.lookAt(target);
    if (progress.current >= 1) { active.current = false; onDone?.(); }
  });

  return null;
}

// ── Main Scene ─────────────────────────────────────────────────────────
function CosmosScene({
  stars, constellations,
  showLines, showLabels, showSpectral,
  selected, onSelect,
  flyTarget, onFlyDone,
}) {
  return (
    <>
      {stars.length > 0 && <StarField stars={stars} showSpectral={showSpectral} />}
      <ConstellationLines
        constellations={constellations}
        showLines={showLines}
        selectedId={selected?.id}
      />
      <ConstellationLabels
        constellations={constellations}
        showLabels={showLabels}
        selectedId={selected?.id}
        onSelect={onSelect}
      />
      {flyTarget && <CameraFlyTo target={flyTarget} onDone={onFlyDone} />}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={0.001}
        maxDistance={0.5}
        dampingFactor={0.07}
        enableDamping
        rotateSpeed={-0.4}
      />
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function Cosmos() {
  const navigate = useNavigate();

  const [stars,          setStars         ] = useState([]);
  const [constellations, setConstellations ] = useState([]);
  const [loading,        setLoading        ] = useState(true);
  const [loadMsg,        setLoadMsg        ] = useState('Connecting to star catalog…');

  const [showLines,    setShowLines   ] = useState(true);
  const [showLabels,   setShowLabels  ] = useState(true);
  const [showSpectral, setShowSpectral] = useState(true);

  const [search,    setSearch   ] = useState('');
  const [selected,  setSelected ] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  // ── Load HYG star catalog ─────────────────────────────────────────
  useEffect(() => {
    setLoadMsg('Downloading HYG star catalog…');
    fetch('https://raw.githubusercontent.com/astronexus/HYG-Database/master/hyg/v3/hyg.csv')
      .then(r => r.text())
      .then(csv => {
        setLoadMsg('Parsing star catalog…');
        // Use setTimeout to avoid blocking UI thread during heavy parse
        setTimeout(() => {
          const visible = parseHYGCsv(csv);
          setStars(visible);
          setLoadMsg(`${visible.length.toLocaleString()} stars loaded — loading constellations…`);
        }, 0);
      })
      .catch(() => {
        setLoadMsg('Star catalog unavailable — showing constellation lines only');
        setStars([]);
      });
  }, []);

  // ── Load constellation lines ──────────────────────────────────────
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json')
      .then(r => r.json())
      .then(data => {
        const consts = data.features.map(f => ({
          id:    f.id,
          name:  f.properties?.name || f.id,
          lines: f.geometry?.coordinates || [],
        }));
        setConstellations(consts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Search ────────────────────────────────────────────────────────
  const handleSearch = useCallback((val) => {
    setSearch(val);
    if (!val.trim()) { setSelected(null); setFlyTarget(null); return; }
    const match = constellations.find(c =>
      c.name?.toLowerCase().includes(val.toLowerCase()) ||
      c.id?.toLowerCase().includes(val.toLowerCase())
    );
    if (match) {
      setSelected(match);
      const allVerts = (match.lines || []).flat();
      const cent     = constellationCentroid(allVerts);
      if (cent) setFlyTarget(cent);
    }
  }, [constellations]);

  const handleSelect = useCallback((c) => {
    setSelected(c);
    if (!c) { setFlyTarget(null); setSearch(''); return; }
    setSearch(c.name || c.id);
    const allVerts = (c.lines || []).flat();
    const cent     = constellationCentroid(allVerts);
    if (cent) setFlyTarget(cent);
  }, []);

  return (
    <div className="cosmos-page">

      {/* Top bar */}
      <div className="cosmos-topbar">
        <button className="cosmos-back" onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> BACK
        </button>
        <div className="cosmos-title">
          <Star size={13} /> COSMOS — 3D STAR MAP
        </div>
        <div className="cosmos-count">
          {loading
            ? loadMsg
            : `${stars.length.toLocaleString()} STARS · ${constellations.length} CONSTELLATIONS`}
        </div>
      </div>

      {/* Canvas area */}
      <div className="cosmos-canvas-wrap">
        {loading && !stars.length && (
          <div className="cosmos-loading">
            <div className="cosmos-loading-ring" />
            <span className="cosmos-loading-text">{loadMsg}</span>
          </div>
        )}

        {/* Always mount canvas once constellations are ready */}
        {!loading && (
          <Canvas
            camera={{ position: [0.001, 0, 0], fov: 75, near: 0.0001, far: 500 }}
            gl={{ antialias: true, alpha: false }}
            style={{ background: '#000005' }}
          >
            <CosmosScene
              stars={stars}
              constellations={constellations}
              showLines={showLines}
              showLabels={showLabels}
              showSpectral={showSpectral}
              selected={selected}
              onSelect={handleSelect}
              flyTarget={flyTarget}
              onFlyDone={() => setFlyTarget(null)}
            />
          </Canvas>
        )}
      </div>

      {/* Bottom bar */}
      <div className="cosmos-bottom">
        {/* Selected info */}
        <div className="cosmos-selected-info">
          {selected ? (
            <>
              <span className="csi-icon">✦</span>
              <span className="csi-name">{selected.name || selected.id}</span>
              <span className="csi-sub">{selected.lines?.length || 0} LINE SEGMENTS</span>
              <button className="csi-clear" onClick={() => handleSelect(null)}>✕</button>
            </>
          ) : (
            <span className="csi-hint">CLICK A CONSTELLATION LABEL TO SELECT</span>
          )}
        </div>

        {/* Search */}
        <div className="cosmos-search">
          <Search size={12} className="cosmos-search-icon" />
          <input
            className="cosmos-search-input"
            placeholder="SEARCH CONSTELLATION…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        {/* Toggles */}
        <div className="cosmos-toggles">
          <button
            className={`cosmos-toggle ${showLines ? 'active' : ''}`}
            onClick={() => setShowLines(v => !v)}
          >
            {showLines ? <Eye size={11}/> : <EyeOff size={11}/>} LINES
          </button>
          <button
            className={`cosmos-toggle ${showLabels ? 'active' : ''}`}
            onClick={() => setShowLabels(v => !v)}
          >
            {showLabels ? <Eye size={11}/> : <EyeOff size={11}/>} LABELS
          </button>
          <button
            className={`cosmos-toggle ${showSpectral ? 'active' : ''}`}
            onClick={() => setShowSpectral(v => !v)}
          >
            {showSpectral ? <Eye size={11}/> : <EyeOff size={11}/>} SPECTRAL
          </button>
        </div>
      </div>

      {/* Spectral legend */}
      {showSpectral && !loading && (
        <div className="cosmos-legend">
          {Object.entries(SPECTRAL_MAP).map(([k, c]) => (
            <div key={k} className="cosmos-leg-item">
              <span className="cosmos-leg-dot" style={{ background: c }} />
              <span className="cosmos-leg-label">{k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
