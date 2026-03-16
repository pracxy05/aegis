import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import './Defense.css';

// ── Config ────────────────────────────────────────────────────────────
const NASA_KEY   = 'j1EZNs2WaDw8zJD1yAyYW2m6ghrsF01EfmR8FVxD';
const EARTH_R    = 54;
const MAX_LIVES  = 3;
const WAVE_SECS  = 35;
const BASE_SPEED = 0.38;

// ── Asteroid shape generator (jagged polygon) ─────────────────────────
function buildAsteroidPath(ctx, cx, cy, r, seed) {
  const points = 9;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle  = (i / points) * Math.PI * 2;
    const jitter = 0.55 + 0.45 * Math.sin(seed * (i + 1) * 7.3);
    const pr     = r * jitter;
    const x      = cx + Math.cos(angle) * pr;
    const y      = cy + Math.sin(angle) * pr;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ── Spawn asteroid from neo data ──────────────────────────────────────
function spawnAsteroid(neo, canvasW, canvasH, level) {
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  // Random edge spawn
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if      (edge === 0) { x = Math.random() * canvasW; y = -30; }
  else if (edge === 1) { x = canvasW + 30;             y = Math.random() * canvasH; }
  else if (edge === 2) { x = Math.random() * canvasW; y = canvasH + 30; }
  else                 { x = -30;                      y = Math.random() * canvasH; }

  const dx    = cx - x;
  const dy    = cy - y;
  const dist  = Math.hypot(dx, dy);
  const speed = BASE_SPEED + (neo.velocity / 55) + (level * 0.04);

  return {
    id:         neo.id + '_' + Math.random(),
    name:       neo.name,
    x, y,
    vx:         (dx / dist) * speed,
    vy:         (dy / dist) * speed,
    radius:     Math.max(7, Math.min(neo.diameter * 10 + 6, 30)),
    rotation:   Math.random() * Math.PI * 2,
    rotSpeed:   (Math.random() - 0.5) * 0.04,
    hazardous:  neo.hazardous,
    seed:       Math.random() * 100,
    points:     neo.hazardous ? 120 : Math.ceil((30 - Math.min(neo.diameter * 10, 22)) * 3 + 20),
    active:     true,
    spawnTime:  Date.now(),
    showName:   true,
  };
}

// ── Spawn particles ───────────────────────────────────────────────────
function spawnParticles(x, y, color, count = 16) {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    return {
      x, y,
      vx:      Math.cos(angle) * speed,
      vy:      Math.sin(angle) * speed,
      life:    1.0,
      decay:   0.028 + Math.random() * 0.02,
      r:       2 + Math.random() * 3,
      color,
    };
  });
}

// ── Draw helpers ──────────────────────────────────────────────────────
function drawStars(ctx, stars) {
  stars.forEach(s => {
    ctx.globalAlpha = s.a;
    ctx.fillStyle   = '#cce8ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawEarth(ctx, cx, cy, frame, flashTimer) {
  // Flash red on hit
  if (flashTimer > 0) {
    const intensity = flashTimer / 18;
    ctx.save();
    ctx.globalAlpha = intensity * 0.35;
    ctx.fillStyle   = '#ff0000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  const pulse = 1 + Math.sin(frame * 0.04) * 0.03;

  // Outer glow rings
  for (let i = 3; i >= 0; i--) {
    const ringR = (EARTH_R + 14 + i * 12) * pulse;
    const alpha = 0.06 - i * 0.012;
    const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR);
    grad.addColorStop(0, `rgba(0,180,255,${alpha})`);
    grad.addColorStop(1, 'rgba(0,80,200,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Atmosphere halo
  const atmoR = EARTH_R * 1.28 * pulse;
  const atmo  = ctx.createRadialGradient(cx, cy, EARTH_R * 0.85, cx, cy, atmoR);
  atmo.addColorStop(0, 'rgba(40,120,255,0.28)');
  atmo.addColorStop(1, 'rgba(0,40,180,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, atmoR, 0, Math.PI * 2);
  ctx.fillStyle = atmo;
  ctx.fill();

  // Earth body gradient
  const earthGrad = ctx.createRadialGradient(cx - EARTH_R * 0.3, cy - EARTH_R * 0.3, 0, cx, cy, EARTH_R * pulse);
  earthGrad.addColorStop(0.0, '#1a5fa8');
  earthGrad.addColorStop(0.4, '#0d3d78');
  earthGrad.addColorStop(0.75, '#082952');
  earthGrad.addColorStop(1.0,  '#041630');
  ctx.shadowColor = '#00aaff';
  ctx.shadowBlur  = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, EARTH_R * pulse, 0, Math.PI * 2);
  ctx.fillStyle = earthGrad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Continent blobs (static decorative)
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#1a7a44';
  // Africa
  ctx.beginPath(); ctx.ellipse(cx + 8, cy + 10, 10, 18, 0.2, 0, Math.PI * 2); ctx.fill();
  // Americas
  ctx.beginPath(); ctx.ellipse(cx - 16, cy, 7, 20, -0.3, 0, Math.PI * 2); ctx.fill();
  // Europe/Asia
  ctx.beginPath(); ctx.ellipse(cx + 14, cy - 10, 18, 10, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;

  // Grid lines on Earth
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, EARTH_R * pulse, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,180,255,0.1)';
  ctx.lineWidth   = 0.5;
  for (let i = -3; i <= 3; i++) {
    const ly = cy + (i / 3) * EARTH_R;
    ctx.beginPath(); ctx.moveTo(cx - EARTH_R, ly); ctx.lineTo(cx + EARTH_R, ly); ctx.stroke();
    const lx = cx + (i / 3) * EARTH_R;
    ctx.beginPath(); ctx.moveTo(lx, cy - EARTH_R); ctx.lineTo(lx, cy + EARTH_R); ctx.stroke();
  }
  ctx.restore();
}

function drawAsteroid(ctx, ast) {
  const { x, y, radius, rotation, hazardous, seed, showName, spawnTime } = ast;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Shadow glow
  ctx.shadowColor = hazardous ? '#ff2244' : '#886633';
  ctx.shadowBlur  = hazardous ? 14 : 8;

  // Body
  buildAsteroidPath(ctx, 0, 0, radius, seed);
  const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius * 1.2);
  if (hazardous) {
    grad.addColorStop(0, '#cc3344');
    grad.addColorStop(0.6, '#882233');
    grad.addColorStop(1,   '#441122');
  } else {
    grad.addColorStop(0, '#888877');
    grad.addColorStop(0.5,'#554433');
    grad.addColorStop(1,  '#2a2018');
  }
  ctx.fillStyle = grad;
  ctx.fill();

  // Crater details
  ctx.shadowBlur = 0;
  ctx.fillStyle  = hazardous ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.25)';
  const cr = radius * 0.22;
  ctx.beginPath(); ctx.arc(-cr, -cr * 0.6, cr * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cr * 0.8, cr * 0.5, cr * 0.45, 0, Math.PI * 2); ctx.fill();

  // Rim highlight
  buildAsteroidPath(ctx, 0, 0, radius, seed);
  ctx.strokeStyle = hazardous ? 'rgba(255,100,120,0.5)' : 'rgba(180,160,120,0.35)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.restore();

  // Asteroid name (fades after 2.5s)
  if (showName) {
    const age   = (Date.now() - spawnTime) / 1000;
    const alpha = Math.max(0, 1 - age / 2.5);
    if (alpha > 0) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = hazardous ? '#ff6688' : '#88aacc';
      ctx.font        = `${Math.max(9, radius * 0.8)}px monospace`;
      ctx.textAlign   = 'center';
      ctx.fillText(ast.name, x, y - radius - 7);
      ctx.globalAlpha = 1;
    }
  }
}

function drawParticle(ctx, p) {
  ctx.globalAlpha = p.life;
  ctx.fillStyle   = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
}

function drawHUD(ctx, g, w, h) {
  // Score
  ctx.fillStyle = '#00d4ff';
  ctx.font      = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur  = 10;
  ctx.fillText(`SCORE  ${g.score.toString().padStart(6, '0')}`, 20, 32);
  ctx.shadowBlur  = 0;

  // Wave
  ctx.fillStyle   = '#ff8800';
  ctx.font        = 'bold 15px monospace';
  ctx.textAlign   = 'center';
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur  = 8;
  ctx.fillText(`WAVE  ${g.wave}`, w / 2, 30);
  ctx.shadowBlur  = 0;

  // Destroyed / missed
  ctx.fillStyle = '#5a8ab0';
  ctx.font      = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`INTERCEPTED: ${g.destroyed}   MISSED: ${g.missed}`, w / 2, 48);

  // Lives
  ctx.textAlign = 'right';
  ctx.font      = '22px monospace';
  for (let i = 0; i < MAX_LIVES; i++) {
    ctx.globalAlpha = i < g.lives ? 1.0 : 0.18;
    ctx.fillStyle   = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = i < g.lives ? 8 : 0;
    ctx.fillText('🌍', w - 20 - i * 32, 34);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;

  // Crosshair hint
  ctx.fillStyle = 'rgba(0,212,255,0.2)';
  ctx.font      = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CLICK ASTEROIDS TO INTERCEPT', w / 2, h - 14);
}

// ── Page ───────────────────────────────────────────────────────────────
export default function Defense() {
  const navigate   = useNavigate();
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const gameRef    = useRef({
    asteroids: [], particles: [], stars: [],
    score: 0, lives: MAX_LIVES, wave: 1,
    frameCount: 0, waveTimer: 0, flashTimer: 0,
    destroyed: 0, missed: 0,
    running: false, neoPool: [], neoIdx: 0,
    spawnInterval: 220, nextSpawn: 80,
  });

  const [gameState,  setGameState ] = useState('loading'); // loading | playing | paused | gameover
  const [scoreUI,    setScoreUI   ] = useState(0);
  const [livesUI,    setLivesUI   ] = useState(MAX_LIVES);
  const [waveUI,     setWaveUI    ] = useState(1);
  const [neoCount,   setNeoCount  ] = useState(0);
  const [highScore,  setHighScore ] = useState(() => parseInt(localStorage.getItem('aegis_hs') || '0'));
  const [destroyedUI,setDestroyedUI] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  // ── Fetch NEO data ───────────────────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    fetch(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${tomorrow}&api_key=${NASA_KEY}`
    )
      .then(r => r.json())
      .then(data => {
        const pool = Object.values(data.near_earth_objects || {})
          .flat()
          .map(neo => ({
            id:        neo.id,
            name:      neo.name.replace(/[()]/g, '').trim().slice(0, 22),
            diameter:  neo.estimated_diameter?.kilometers?.estimated_diameter_max || 0.1,
            hazardous: neo.is_potentially_hazardous_asteroid,
            velocity:  parseFloat(neo.close_approach_data?.[0]?.relative_velocity?.kilometers_per_second || 8),
            missDistance: parseFloat(neo.close_approach_data?.[0]?.miss_distance?.lunar || 20),
          }))
          .sort((a, b) => a.missDistance - b.missDistance);

        gameRef.current.neoPool = pool.length > 0 ? pool : generateFallbackPool();
        setNeoCount(pool.length);
        setGameState('ready');
      })
      .catch(() => {
        gameRef.current.neoPool = generateFallbackPool();
        setNeoCount(12);
        setGameState('ready');
      });
  }, []);

  // ── Fallback pool if NASA offline ────────────────────────────────
  function generateFallbackPool() {
    return Array.from({ length: 20 }, (_, i) => ({
      id:        `fallback_${i}`,
      name:      `2026 FX${i + 1}`,
      diameter:  0.05 + Math.random() * 0.8,
      hazardous: Math.random() < 0.3,
      velocity:  5 + Math.random() * 20,
      missDistance: Math.random() * 30,
    }));
  }

  // ── Generate background stars ────────────────────────────────────
  function initStars(w, h) {
    return Array.from({ length: 220 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.3,
      a: 0.2 + Math.random() * 0.7,
    }));
  }

  // ── Game loop ────────────────────────────────────────────────────
  const startGameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const g   = gameRef.current;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    g.stars       = initStars(canvas.width, canvas.height);
    g.running     = true;

    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;

    function loop() {
      if (!g.running) return;
      const w = canvas.width, h = canvas.height;

      // Clear
      ctx.fillStyle = '#000008';
      ctx.fillRect(0, 0, w, h);

      // Stars
      drawStars(ctx, g.stars);

      // Twinkle stars slightly
      g.frameCount++;
      if (g.frameCount % 4 === 0) {
        g.stars.forEach(s => {
          s.a += (Math.random() - 0.5) * 0.08;
          s.a  = Math.max(0.1, Math.min(0.9, s.a));
        });
      }

      // Earth
      drawEarth(ctx, cx, cy, g.frameCount, g.flashTimer);
      if (g.flashTimer > 0) g.flashTimer--;

      // Wave timer & new wave
      g.waveTimer++;
      if (g.waveTimer >= WAVE_SECS * 60) {
        g.wave++;
        g.waveTimer       = 0;
        g.spawnInterval   = Math.max(60, g.spawnInterval - 18);
        g.nextSpawn       = 30;
      }

      // Spawn asteroid
      g.nextSpawn--;
      if (g.nextSpawn <= 0 && g.neoPool.length) {
        const neo = g.neoPool[g.neoIdx % g.neoPool.length];
        g.asteroids.push(spawnAsteroid(neo, w, h, g.wave));
        g.neoIdx++;
        g.nextSpawn = g.spawnInterval - (g.wave * 8);
      }

      // Update & draw asteroids
      g.asteroids = g.asteroids.filter(ast => {
        if (!ast.active) return false;
        ast.x        += ast.vx;
        ast.y        += ast.vy;
        ast.rotation += ast.rotSpeed;

        // Hit Earth?
        const dEarth = Math.hypot(ast.x - cx, ast.y - cy);
        if (dEarth < EARTH_R + ast.radius * 0.6) {
          const damage = ast.hazardous ? 2 : 1;
          g.lives     = Math.max(0, g.lives - damage);
          g.missed++;
          g.flashTimer = 18;
          g.particles.push(...spawnParticles(cx + (ast.x - cx) * 0.6, cy + (ast.y - cy) * 0.6,
            ast.hazardous ? '#ff2244' : '#ff6600', 10));
          if (g.lives <= 0) { g.running = false; endGame(); }
          return false;
        }

        // Off screen
        if (ast.x < -60 || ast.x > w + 60 || ast.y < -60 || ast.y > h + 60) return false;

        drawAsteroid(ctx, ast);
        return true;
      });

      // Update & draw particles
      g.particles = g.particles.filter(p => {
        p.x   += p.vx;
        p.y   += p.vy;
        p.life = Math.max(0, p.life - p.decay);
        if (p.life <= 0) return false;
        drawParticle(ctx, p);
        return true;
      });

      // HUD
      drawHUD(ctx, g, w, h);

      // Sync UI every 20 frames
      if (g.frameCount % 20 === 0) {
        setScoreUI(g.score);
        setLivesUI(g.lives);
        setWaveUI(g.wave);
        setDestroyedUI(g.destroyed);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  function endGame() {
    const g = gameRef.current;
    setFinalScore(g.score);
    setScoreUI(g.score);
    setLivesUI(0);
    setDestroyedUI(g.destroyed);
    if (g.score > highScore) {
      setHighScore(g.score);
      localStorage.setItem('aegis_hs', g.score.toString());
    }
    setGameState('gameover');
  }

  // ── Start game ───────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const g          = gameRef.current;
    g.asteroids      = [];
    g.particles      = [];
    g.score          = 0;
    g.lives          = MAX_LIVES;
    g.wave           = 1;
    g.frameCount     = 0;
    g.waveTimer      = 0;
    g.flashTimer     = 0;
    g.destroyed      = 0;
    g.missed         = 0;
    g.neoIdx         = 0;
    g.spawnInterval  = 220;
    g.nextSpawn      = 80;
    g.running        = true;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setGameState('playing');
    setScoreUI(0); setLivesUI(MAX_LIVES); setWaveUI(1); setDestroyedUI(0);

    setTimeout(startGameLoop, 50);
  }, [startGameLoop]);

  // ── Pause ────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (gameState === 'playing') {
      g.running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setGameState('paused');
    } else if (gameState === 'paused') {
      g.running = true;
      setGameState('playing');
      startGameLoop();
    }
  }, [gameState, startGameLoop]);

  // ── ESC key ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && (gameState === 'playing' || gameState === 'paused')) togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, togglePause]);

  // ── Click handler ────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const g    = gameRef.current;

    let hit = false;
    g.asteroids.forEach(ast => {
      if (!ast.active) return;
      if (Math.hypot(mx - ast.x, my - ast.y) < ast.radius + 4) {
        ast.active  = false;
        g.score    += ast.points;
        g.destroyed++;
        const color = ast.hazardous ? '#ff4466' : '#ffaa44';
        g.particles.push(...spawnParticles(ast.x, ast.y, color, 18));
        hit = true;
      }
    });

    // Miss click flash
    if (!hit) {
      const canvas2 = canvasRef.current;
      if (canvas2) {
        const ctx = canvas2.getContext('2d');
        ctx.fillStyle = 'rgba(0,212,255,0.06)';
        ctx.beginPath();
        ctx.arc(mx, my, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [gameState]);

  // ── Resize ───────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      gameRef.current.stars = initStars(canvas.width, canvas.height);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      gameRef.current.running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="defense-page">

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="defense-canvas"
        onClick={handleCanvasClick}
        style={{ cursor: gameState === 'playing' ? 'crosshair' : 'default' }}
      />

      {/* Top HUD bar (always visible) */}
      <div className="def-topbar">
        <button className="def-back" onClick={() => { gameRef.current.running = false; navigate('/'); }}>
          <ArrowLeft size={13}/> BACK
        </button>
        <div className="def-title">
          <Shield size={13}/> DEFEND EARTH
        </div>
        <div className="def-topbar-right">
          <span className="def-hs">HI {highScore.toString().padStart(6, '0')}</span>
          {gameState === 'playing' && (
            <button className="def-pause-btn" onClick={togglePause}>
              ⏸ PAUSE
            </button>
          )}
        </div>
      </div>

      {/* LOADING overlay */}
      {gameState === 'loading' && (
        <div className="def-overlay">
          <div className="def-overlay-inner">
            <div className="def-loading-ring"/>
            <div className="def-overlay-title">ACQUIRING NEAR-EARTH OBJECTS</div>
            <div className="def-overlay-sub">CONNECTING TO NASA CNEOS DATABASE…</div>
            <div className="def-overlay-sub" style={{ marginTop: 6, color: '#5a8ab0' }}>
              DATE: {today}
            </div>
          </div>
        </div>
      )}

      {/* READY overlay */}
      {gameState === 'ready' && (
        <div className="def-overlay">
          <div className="def-overlay-inner def-ready-card">
            <div className="def-ready-icon">🌍</div>
            <div className="def-overlay-title">PLANETARY DEFENSE SYSTEM</div>
            <div className="def-neo-badge">
              <span className="def-neo-count">{neoCount}</span>
              <span className="def-neo-label">NEAR-EARTH OBJECTS DETECTED TODAY</span>
            </div>
            <div className="def-instructions">
              <div className="def-inst-row"><span className="def-inst-key">CLICK</span><span>Intercept asteroids before impact</span></div>
              <div className="def-inst-row"><span className="def-inst-key">ESC</span><span>Pause / resume</span></div>
              <div className="def-inst-row"><span className="def-inst-key red">RED ☄</span><span>Hazardous — costs 2 lives if missed</span></div>
              <div className="def-inst-row"><span className="def-inst-key">GREY ☄</span><span>Standard — costs 1 life if missed</span></div>
            </div>
            <button className="def-start-btn" onClick={startGame}>
              LAUNCH DEFENSE SYSTEM →
            </button>
            <div className="def-ready-sub">
              Powered by real NASA NeoWs data · {today}
            </div>
          </div>
        </div>
      )}

      {/* PAUSED overlay */}
      {gameState === 'paused' && (
        <div className="def-overlay def-overlay-transparent">
          <div className="def-overlay-inner">
            <div className="def-overlay-title def-pause-title">⏸ PAUSED</div>
            <div className="def-pause-stats">
              <div className="def-ps-row"><span>SCORE</span><span style={{ color: '#00d4ff' }}>{scoreUI}</span></div>
              <div className="def-ps-row"><span>WAVE</span><span style={{ color: '#ff8800' }}>{waveUI}</span></div>
              <div className="def-ps-row"><span>INTERCEPTED</span><span style={{ color: '#00ff88' }}>{destroyedUI}</span></div>
            </div>
            <div className="def-pause-actions">
              <button className="def-start-btn" onClick={togglePause}>▶ RESUME</button>
              <button className="def-exit-btn"  onClick={() => { gameRef.current.running = false; setGameState('ready'); }}>
                ABORT MISSION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER overlay */}
      {gameState === 'gameover' && (
        <div className="def-overlay">
          <div className="def-overlay-inner def-gameover-card">
            <div className="def-gameover-icon">💥</div>
            <div className="def-gameover-title">EARTH COMPROMISED</div>
            <div className="def-gameover-sub">PLANETARY DEFENSE FAILED</div>

            <div className="def-final-score">
              <span className="def-fs-val">{finalScore.toString().padStart(6, '0')}</span>
              <span className="def-fs-label">FINAL SCORE</span>
            </div>

            {finalScore >= highScore && finalScore > 0 && (
              <div className="def-new-hs">⭐ NEW HIGH SCORE</div>
            )}

            <div className="def-gameover-stats">
              <div className="def-go-stat">
                <span className="def-go-stat-val" style={{ color: '#00ff88' }}>{destroyedUI}</span>
                <span className="def-go-stat-label">INTERCEPTED</span>
              </div>
              <div className="def-go-stat">
                <span className="def-go-stat-val" style={{ color: '#ff6600' }}>{waveUI}</span>
                <span className="def-go-stat-label">WAVES SURVIVED</span>
              </div>
              <div className="def-go-stat">
                <span className="def-go-stat-val" style={{ color: '#5a8ab0' }}>{highScore}</span>
                <span className="def-go-stat-label">HIGH SCORE</span>
              </div>
            </div>

            <div className="def-gameover-actions">
              <button className="def-start-btn" onClick={startGame}>
                🔄 TRY AGAIN
              </button>
              <button className="def-exit-btn" onClick={() => navigate('/intel')}>
                VIEW INTEL →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
