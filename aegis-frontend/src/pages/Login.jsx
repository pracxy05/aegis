import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [mode,     setMode]     = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [boot,     setBoot]     = useState(0);
  const { setAuth } = useAuthStore();
  const navigate    = useNavigate();

  useEffect(() => {
    [0,1,2].forEach((_, i) => setTimeout(() => setBoot(i+1), i * 600));
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

  return (
    <div className="login-page">
      <Toaster position="top-center" />

      {/* Star field particles */}
      <div className="login-stars">
        {PARTICLES.map(p => (
          <div key={p.id} className="login-star"
            style={{ left:`${p.x}%`, top:`${p.y}%`, width:p.size, height:p.size,
              animationDuration:`${p.dur}s`, animationDelay:`${p.delay}s` }} />
        ))}
      </div>

      {/* Animated grid */}
      <div className="login-grid" />

      {/* Scan line */}
      <div className="login-scanline" />

      {/* Card */}
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Corner brackets */}
        <span className="lc lc-tl"/><span className="lc lc-tr"/>
        <span className="lc lc-bl"/><span className="lc lc-br"/>

        {/* Logo block */}
        <div className="login-logo">
          <motion.div
            className="login-logo-ring"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
          />
          <div className="login-logo-inner">
            <div className="login-logo-text">AEGIS</div>
          </div>
        </div>

        {/* Boot lines */}
        <div className="login-boot">
          {['SENTINEL ONLINE', 'SCANNING THREATS', 'READY FOR OPERATOR'].slice(0, boot).map((s,i) => (
            <motion.div key={i} className="boot-line"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span className="boot-check">✓</span> {s}
            </motion.div>
          ))}
        </div>

        <div className="login-subtitle">GLOBAL SURVEILLANCE SYSTEM v2.0</div>

        {/* Mode tabs */}
        <div className="login-tabs">
          {['login','register'].map(m => (
            <button key={m} className={`login-tab ${mode===m?'active':''}`} onClick={() => setMode(m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label>OPERATOR ID</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="enter username"
              autoComplete="username"
              required
            />
          </div>
          <div className="login-field">
            <label>ACCESS CODE</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <motion.button
            type="submit"
            className="login-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{  scale: 0.97 }}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              mode === 'login' ? 'AUTHENTICATE →' : 'CREATE ACCOUNT →'
            )}
          </motion.button>
        </form>

        <div className="login-footer">
          PLANETARY MONITORING ACTIVE ● {new Date().toUTCString().slice(0,25)} UTC
        </div>
      </motion.div>
    </div>
  );
}
