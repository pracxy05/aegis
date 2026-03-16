import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import './Globe.css';

// ── Constants ─────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  EARTHQUAKE:    { color: '#ff4444', icon: '⚡', label: 'QUAKE'    },
  WILDFIRE:      { color: '#ff6600', icon: '🔥', label: 'FIRE'     },
  LAUNCH:        { color: '#00d4ff', icon: '🚀', label: 'LAUNCH'   },
  ASTEROID:      { color: '#cc44ff', icon: '☄️',  label: 'ASTEROID' },
  SOLAR_FLARE:   { color: '#ffcc00', icon: '☀️',  label: 'FLARE'   },
  STORM:         { color: '#4488ff', icon: '🌀', label: 'STORM'    },
  FLOOD:         { color: '#0088ff', icon: '🌊', label: 'FLOOD'    },
  VOLCANO:       { color: '#ff3300', icon: '🌋', label: 'VOLCANO'  },
  CONFLICT:      { color: '#ff2277', icon: '⚔️',  label: 'CONFLICT' },
  AIR_QUALITY:   { color: '#aa44ff', icon: '💨', label: 'AIR'      },
  ICE_EVENT:     { color: '#88ccff', icon: '🧊', label: 'ICE'      },
  DROUGHT:       { color: '#cc8800', icon: '🌡️',  label: 'DROUGHT'  },
  DUST_STORM:    { color: '#aa8844', icon: '🌫️',  label: 'DUST'     },
  LANDSLIDE:     { color: '#886633', icon: '⛰️',  label: 'SLIDE'    },
  NATURAL_EVENT: { color: '#ff8844', icon: '🌍', label: 'EVENT'    },
};

const SEV_SCALE = { CRITICAL: 1.5, HIGH: 1.15, MEDIUM: 0.85, LOW: 0.65 };
const SEV_SPEED = { CRITICAL: 3.5, HIGH: 2.2,  MEDIUM: 1.6,  LOW: 1.2  };

// ── Helpers ───────────────────────────────────────────────────────────
function latLonToVec3(lat, lon, r = 1.52) {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function getSubsolarPoint() {
  const now      = new Date();
  const start    = new Date(now.getFullYear(), 0, 0);
  const doy      = Math.floor((now - start) / 86400000);
  const dec      = 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365);
  const fracDay  = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400;
  const solarLon = fracDay * 360 - 180;
  return latLonToVec3(dec, solarLon, 1).normalize();
}

// ── Shaders ───────────────────────────────────────────────────────────
const EARTH_VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv     = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAG = `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uClouds;
  uniform vec3      uSunDir;
  varying vec2      vUv;
  varying vec3      vNormal;

  void main() {
    float cosA  = dot(normalize(vNormal), normalize(uSunDir));
    float blend = smoothstep(-0.12, 0.12, cosA);

    vec4 day    = texture2D(uDay,    vUv);
    vec4 night  = texture2D(uNight,  vUv) * 2.8;
    vec4 clouds = texture2D(uClouds, vUv);

    vec4 earth  = mix(night, day, blend);
    // Overlay clouds only on day side
    earth.rgb   = mix(earth.rgb, clouds.rgb, clouds.a * blend * 0.55);

    // Specular shimmer on oceans
    float spec  = pow(max(cosA, 0.0), 28.0) * 0.22;
    earth.rgb  += spec;

    gl_FragColor = earth;
  }
`;

const SUN_VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv     = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAG = `
  uniform float uTime;
  uniform bool  uFlare;
  varying vec2  vUv;
  varying vec3  vNormal;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i+vec2(1,0)), f.x),
      mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p  = p * 2.0 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float t  = uTime * 0.055;
    vec2  uv = vUv;

    float n1     = fbm(uv * 3.5 + vec2(t, t * 0.8));
    float n2     = fbm(uv * 7.0 + vec2(-t * 0.9, t * 1.2) + n1 * 0.6);
    float plasma = fbm(uv * 5.0 + n2 * 0.7 + vec2(t * 0.4, -t * 0.3));

    vec3 c1 = uFlare ? vec3(0.9, 0.05, 0.0) : vec3(0.72, 0.08, 0.0);
    vec3 c2 = vec3(1.0,  0.38, 0.0);
    vec3 c3 = vec3(1.0,  0.78, 0.10);
    vec3 c4 = vec3(1.0,  0.97, 0.82);

    vec3 col;
    if      (plasma < 0.33) col = mix(c1, c2, plasma * 3.0);
    else if (plasma < 0.66) col = mix(c2, c3, (plasma - 0.33) * 3.0);
    else                    col = mix(c3, c4, (plasma - 0.66) * 3.0);

    // Limb darkening
    float limb  = pow(clamp(dot(vNormal, vec3(0,0,1)), 0.0, 1.0), 0.38);
    col        *= mix(0.45, 1.0, limb);

    // Active flare: hot white patches
    if (uFlare) {
      float hot = fbm(uv * 14.0 + vec2(t * 2.0, 0.0));
      col      += vec3(0.6, 0.3, 0.0) * step(0.72, hot);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMO_VERT = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMO_FRAG = `
  varying vec3 vNormal;
  void main() {
    float i = pow(0.70 - dot(vNormal, vec3(0,0,1)), 2.6);
    gl_FragColor = vec4(0.07, 0.44, 1.0, 1.0) * i * 1.25;
  }
`;

// ── Earth with real textures + day/night ─────────────────────────────
function TexturedEarth({ sunDir }) {
  const meshRef  = useRef();
  const cloudRef = useRef();
  const matRef   = useRef();

  const [textures, setTextures] = useState({ day: null, night: null, clouds: null });

  useEffect(() => {
    const L = new THREE.TextureLoader();
    const load = (url) =>
      new Promise(res => L.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, null, () => res(null)));

    Promise.all([
      load('/textures/earth_day.jpg'),
      load('/textures/earth_night.jpg'),
      load('/textures/earth_clouds.png'),
    ]).then(([day, night, clouds]) => setTextures({ day, night, clouds }));
  }, []);

  const earthMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uDay:    { value: textures.day    },
      uNight:  { value: textures.night  },
      uClouds: { value: textures.clouds },
      uSunDir: { value: sunDir          },
    },
  }), [textures, sunDir]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current)  meshRef.current.rotation.y  = t * 0.018;
    if (cloudRef.current) cloudRef.current.rotation.y = t * 0.022;
    if (matRef.current)   matRef.current.uniforms.uSunDir.value = sunDir;
  });

  // Fallback before textures load
  if (!textures.day) {
    return (
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.5, 96, 96]} />
        <meshPhongMaterial color="#123c72" emissive="#071425" emissiveIntensity={0.4} shininess={18} />
      </mesh>
    );
  }

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.5, 96, 96]} />
        <primitive object={earthMat} ref={matRef} attach="material" />
      </mesh>
      <mesh ref={cloudRef} scale={[1.012, 1.012, 1.012]}>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshPhongMaterial
          map={textures.clouds}
          transparent
          opacity={0.38}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Atmosphere ────────────────────────────────────────────────────────
function Atmosphere() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
    blending: THREE.AdditiveBlending, side: THREE.BackSide,
    transparent: true, depthWrite: false,
  }), []);
  return (
    <mesh scale={[1.18, 1.18, 1.18]}>
      <sphereGeometry args={[1.5, 64, 64]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ── Grid lines ────────────────────────────────────────────────────────
function GridLines() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = [];
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = -180; lon < 180; lon += 3) {
        const a = latLonToVec3(lat, lon, 1.502), b = latLonToVec3(lat, lon+3, 1.502);
        v.push(a.x,a.y,a.z,b.x,b.y,b.z);
      }
    for (let lon = -180; lon < 180; lon += 30)
      for (let lat = -88; lat < 88; lat += 3) {
        const a = latLonToVec3(lat, lon, 1.502), b = latLonToVec3(lat+3, lon, 1.502);
        v.push(a.x,a.y,a.z,b.x,b.y,b.z);
      }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
  return <lineSegments geometry={geo}><lineBasicMaterial color="#00d4ff" transparent opacity={0.05} depthWrite={false} /></lineSegments>;
}

// ── Tectonic plates ───────────────────────────────────────────────────
function TectonicPlates({ visible }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json')
      .then(r => r.json()).then(setData).catch(() => {});
  }, []);

  const geos = useMemo(() => {
    if (!data) return [];
    const result = [];
    data.features.forEach(f => {
      const segs = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
      segs.forEach(seg => {
        const verts = [];
        seg.forEach(([lon, lat]) => { const p = latLonToVec3(lat, lon, 1.504); verts.push(p.x,p.y,p.z); });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        result.push(g);
      });
    });
    return result;
  }, [data]);

  if (!visible) return null;
  return geos.map((geo, i) => (
    <line key={i} geometry={geo}>
      <lineBasicMaterial color="#ff6600" transparent opacity={0.5} depthWrite={false} />
    </line>
  ));
}

// ── Sun ───────────────────────────────────────────────────────────────
function Sun({ hasSolarFlare }) {
  const coreMatRef  = useRef();
  const haloRef     = useRef();
  const ring1Ref    = useRef();
  const ring2Ref    = useRef();

  const coreMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
    uniforms: { uTime: { value: 0 }, uFlare: { value: hasSolarFlare } },
  }), [hasSolarFlare]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    coreMat.uniforms.uTime.value = t;
    if (haloRef.current)  { const s = 1 + Math.sin(t * 1.6) * 0.07; haloRef.current.scale.setScalar(s); }
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.05;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.03;
  });

  const cc  = hasSolarFlare ? '#ff4400' : '#ffcc44';
  const hc  = hasSolarFlare ? '#ff2200' : '#ff9900';
  const hOp = hasSolarFlare ? 0.18 : 0.12;

  return (
    <group position={[8, 2, -5]}>
      {/* Outer glow */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color={hc} transparent opacity={hOp} depthWrite={false} />
      </mesh>
      {/* Corona ring 1 */}
      <mesh ref={ring1Ref} rotation={[0.28, 0, 0]}>
        <ringGeometry args={[0.78, 1.6, 64]} />
        <meshBasicMaterial color={hc} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Corona ring 2 */}
      <mesh ref={ring2Ref} rotation={[0.8, 0.4, 0]}>
        <ringGeometry args={[0.68, 1.45, 64]} />
        <meshBasicMaterial color={cc}  transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Procedural core */}
      <mesh>
        <sphereGeometry args={[0.68, 64, 64]} />
        <primitive object={coreMat} ref={coreMatRef} attach="material" />
      </mesh>
      <Html center distanceFactor={14}>
        <div className="sun-label">{hasSolarFlare ? '☀ FLARE ACTIVE' : '☀ SOL'}</div>
      </Html>
    </group>
  );
}

// ── ISS marker + orbit arc ────────────────────────────────────────────
function ISSOrbitArc({ lat, lon }) {
  const arcGeo = useMemo(() => {
    // Approximate ISS orbit arc (51.6° inclination, 16 orbits/day visual arc)
    const verts = [];
    const inc   = 51.6;
    const phaseOffset = lon;
    for (let i = -80; i <= 80; i += 2) {
      const arcLon = phaseOffset + i * 1.5;
      const arcLat = inc * Math.sin((arcLon - phaseOffset) * Math.PI / 180);
      const p = latLonToVec3(arcLat, arcLon, 1.67);
      verts.push(p.x, p.y, p.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [lat, lon]);

  const pos = useMemo(() => latLonToVec3(lat, lon, 1.68), [lat, lon]);

  return (
    <group>
      <line geometry={arcGeo}>
        <lineBasicMaterial color="#00ffcc" transparent opacity={0.35} depthWrite={false} />
      </line>
      <group position={pos}>
        <mesh>
          <ringGeometry args={[0.011, 0.018, 32]} />
          <meshBasicMaterial color="#00ffcc" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        <Html center distanceFactor={6}>
          <div className="iss-marker">🛸 ISS</div>
        </Html>
      </group>
    </group>
  );
}

// ── Pulse ring ────────────────────────────────────────────────────────
function PulseRing({ color, severity }) {
  const r = useRef();
  const s = SEV_SPEED[severity] || 1.5;
  useFrame(({ clock }) => {
    if (!r.current) return;
    const t  = clock.getElapsedTime();
    r.current.scale.setScalar(1 + 0.8 * Math.abs(Math.sin(t * s)));
    r.current.material.opacity = 0.85 - 0.6 * Math.abs(Math.sin(t * s));
  });
  return (
    <mesh ref={r}>
      <ringGeometry args={[0.016, 0.024, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// ── Event pin ─────────────────────────────────────────────────────────
function EventPin({ event, onEventClick, activeLayers }) {
  const cfg    = EVENT_CONFIG[event.eventType] || EVENT_CONFIG.NATURAL_EVENT;
  const hasCoords = event.latitude != null && event.longitude != null;
  const pos    = useMemo(() => hasCoords ? latLonToVec3(event.latitude, event.longitude) : null, [hasCoords, event.latitude, event.longitude]);
  const scale  = SEV_SCALE[event.severity] || 0.8;
  const sev    = (event.severity || 'LOW').toLowerCase();

  // All hooks above — early returns AFTER all hooks
  if (activeLayers && activeLayers[event.eventType] === false) return null;
  if (!hasCoords || !pos) return null;

  return (
    <group position={pos}>
      <PulseRing color={cfg.color} severity={event.severity} />
      <mesh onClick={e => { e.stopPropagation(); onEventClick(event); }}>
        <sphereGeometry args={[0.011 * scale, 8, 8]} />
        <meshBasicMaterial color={cfg.color} />
      </mesh>
      <Html center distanceFactor={6}>
        <div className={`evt-pin evt-pin-${sev}`} style={{ '--ec': cfg.color }} onClick={() => onEventClick(event)}>
          {cfg.icon}
        </div>
      </Html>
    </group>
  );
}

// ── Equator ring ──────────────────────────────────────────────────────
function EquatorRing() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.503, 1.508, 128]} />
      <meshBasicMaterial color="#00d4ff" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// ── Scene root ────────────────────────────────────────────────────────
function Scene({ events, onEventClick, activeLayers, issPosition }) {
  const sunDir        = useMemo(() => getSubsolarPoint(), []);
  const hasSolarFlare = events.some(e => e.eventType === 'SOLAR_FLARE');
  const hasTectonic   = activeLayers?.TECTONIC !== false;
  const visible       = events.filter(e => e.latitude != null && e.longitude != null);

  return (
    <>
      <ambientLight intensity={0.22} />
      <directionalLight position={[8, 2, -5]} intensity={2.6} color="#fff4da" castShadow />
      <pointLight position={[-6, -2, 4]} intensity={0.5} color="#1133ff" />

      <Stars radius={280} depth={60} count={10000} factor={4.8} saturation={0.2} fade speed={0.4} />

      <TexturedEarth sunDir={sunDir} />
      <Atmosphere />
      <GridLines />
      <EquatorRing />
      <TectonicPlates visible={hasTectonic} />

      {activeLayers?.SUN !== false && <Sun hasSolarFlare={hasSolarFlare} />}
      {issPosition && activeLayers?.ISS !== false &&
        <ISSOrbitArc lat={issPosition.lat} lon={issPosition.lon} />}

      {visible.map(ev => (
        <EventPin
          key={ev.id ?? ev.externalId ?? `${ev.latitude}-${ev.longitude}-${ev.eventType}`}
          event={ev}
          onEventClick={onEventClick}
          activeLayers={activeLayers}
        />
      ))}

      <OrbitControls enablePan={false} minDistance={2.2} maxDistance={7} enableDamping dampingFactor={0.06} rotateSpeed={0.5} />
    </>
  );
}

// ── Exported ──────────────────────────────────────────────────────────
export default function Globe({ events = [], onEventClick = () => {}, activeLayers = {}, issPosition = null }) {
  return (
    <div className="globe-wrap">
      <span className="hud-c hud-tl"/><span className="hud-c hud-tr"/>
      <span className="hud-c hud-bl"/><span className="hud-c hud-br"/>
      <div className="globe-scan" />
      <Canvas
        camera={{ position: [0, 0, 3.8], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <Scene events={events} onEventClick={onEventClick} activeLayers={activeLayers} issPosition={issPosition} />
      </Canvas>
    </div>
  );
}
