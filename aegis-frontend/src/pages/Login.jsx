import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loginUser, registerUser } from '../services/api';
import { useAuthStore } from '../store/store';
import toast, { Toaster } from 'react-hot-toast';
import './Login.css';

const PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2.5 + 0.5,
  dur: Math.random() * 4 + 3,
  delay: Math.random() * 4,
}));

export default function Login() {
  const [mode,     setMode    ] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading ] = useState(false);
  const [boot,     setBoot    ] = useState(0);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    [0, 1, 2].forEach((_, i) => setTimeout(() => setBoot(i + 1), i * 600));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fn  = mode === 'login' ? loginUser : registerUser;
      const res = await fn({ username, password });
      setAuth(res.data.username, res.data.token);
      toast.success('ACCESS GRANTED', { icon: '✅' });
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'ACCESS DENIED', { icon: '🔒' });
    } finally {
      setLoading(false);
    }
  };

  // Demo bypass — no backend needed for faculty presentation
  const handleDemo = () => {
    setAuth('OPERATOR', 'demo-token-aegis-2026');
    toast.success('DEMO MODE — WELCOME TO AEGIS', { icon: '⚡' });
    navigate('/');
  };

  return (
    <div className="login-page">
      <Toaster />

      {/* Particles */}
      <div className="login-particles">
        {PARTICLES.map(p => (
          <div
            key={p.id}
            className="login-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <motion.div
        className="login-card card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo */}
        <div className="login-logo">
          <h1 className="glow-text">AEGIS</h1>
          <p>Aerospace Earth Guardian Intelligence System</p>
        </div>

        {/* Boot status */}
        <div className="login-boot">
          {['SYSTEMS ONLINE', 'DATABASE CONNECTED', 'MONITORING ACTIVE'].map((msg, i) => (
            <div key={i} className={`boot-line ${boot > i ? 'visible' : ''}`}>
              <span className="boot-dot">▸</span> {msg}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="login-tabs">
          {['login', 'register'].map(m => (
            <button
              key={m}
              className={`tab-btn ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="enter callsign..."
              required
            />
          </div>
          <div className="input-group">
            <label>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="enter access code..."
              required
            />
          </div>

          <motion.button
            type="submit"
            className="login-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'AUTHENTICATING...' : mode === 'login' ? 'ACCESS SYSTEM' : 'CREATE ACCOUNT'}
          </motion.button>
        </form>

        {/* Divider */}
        <div className="login-divider"><span>OR</span></div>

        {/* Demo button */}
        <motion.button
          className="demo-btn"
          onClick={handleDemo}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
        >
          ⚡ DEMO ACCESS — INSTANT ENTRY
        </motion.button>

        <p className="login-footer">AEGIS v2.0 · PLANETARY MONITORING ACTIVE</p>
      </motion.div>
    </div>
  );
}