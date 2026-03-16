import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ExternalLink } from 'lucide-react';
import './Stars.css';

const NASA_KEY = 'j1EZNs2WaDw8zJD1yAyYW2m6ghrsF01EfmR8FVxD';

export default function Stars() {
  const [apod, setApod]       = useState(null);
  const [gallery, setGallery] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState('');
  const navigate = useNavigate();

  const fetchApod = async (targetDate = '') => {
    setLoading(true);
    try {
      // Fetch today's APOD
      const url = targetDate
        ? `https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}&date=${targetDate}`
        : `https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      setApod(data);
    } catch (e) {
      console.error('APOD fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGallery = async () => {
    try {
      // Fetch last 8 APODs
      const res  = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}&count=8`
      );
      const data = await res.json();
      setGallery(data.filter(d => d.media_type === 'image'));
    } catch (e) {
      console.error('Gallery fetch failed', e);
    }
  };

  useEffect(() => {
    fetchApod();
    fetchGallery();
  }, []);

  return (
    <div className="stars-page">
      <div className="stars-bg">
        {[...Array(60)].map((_, i) => (
          <div key={i} className="star-particle" style={{
            left: `${Math.random() * 100}%`,
            top:  `${Math.random() * 100}%`,
            width:  `${Math.random() > 0.9 ? 3 : Math.random() > 0.7 ? 2 : 1}px`,
            height: `${Math.random() > 0.9 ? 3 : Math.random() > 0.7 ? 2 : 1}px`,
            animationDelay:    `${Math.random() * 5}s`,
            animationDuration: `${2 + Math.random() * 4}s`,
          }} />
        ))}
      </div>

      {/* Header */}
      <div className="stars-header">
        <motion.button className="back-btn" onClick={() => navigate('/')} whileHover={{ x: -4 }}>
          <ArrowLeft size={14} /> MISSION CONTROL
        </motion.button>
        <div style={{ textAlign: 'center' }}>
          <h1 className="glow-text" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '6px', fontSize: '1.5rem' }}>
            COSMOS OBSERVATORY
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '3px', marginTop: 4 }}>
            NASA ASTRONOMY PICTURE OF THE DAY
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            className="date-picker"
            value={date}
            max={new Date().toISOString().split('T')[0]}
            min="1995-06-16"
            onChange={(e) => { setDate(e.target.value); fetchApod(e.target.value); }}
          />
        </div>
      </div>

      <div className="stars-content">

        {/* Hero APOD */}
        {loading ? (
          <div className="loading-screen" style={{ height: '400px' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              style={{ width: 40, height: 40, border: '2px solid var(--accent-cyan)', borderTopColor: 'transparent', borderRadius: '50%' }}
            />
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: 16, letterSpacing: 2 }}>
              CONNECTING TO COSMOS...
            </p>
          </div>
        ) : apod && (
          <motion.div className="apod-hero card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="apod-layout">
              <div className="apod-image-wrap">
                {apod.media_type === 'image' ? (
                  <img src={apod.url} alt={apod.title} className="apod-image" />
                ) : (
                  <iframe
                    src={apod.url}
                    title={apod.title}
                    className="apod-video"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="apod-info">
                <div className="apod-date">
                  <Calendar size={12} />
                  <span>{apod.date}</span>
                </div>
                <h2 className="apod-title">{apod.title}</h2>
                {apod.copyright && (
                  <p className="apod-credit">© {apod.copyright}</p>
                )}
                <p className="apod-explanation">{apod.explanation}</p>
                <a
                  href={apod.hdurl || apod.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ed-source-link"
                  style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)', marginTop: 'auto' }}
                >
                  <ExternalLink size={12} /> VIEW HIGH RESOLUTION
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Random Gallery */}
        {gallery.length > 0 && (
          <div className="gallery-section">
            <h3 className="chart-title" style={{ marginBottom: 16 }}>
              🌌 RANDOM COSMOS GALLERY
            </h3>
            <div className="apod-gallery">
              {gallery.map((item, i) => (
                <motion.div
                  key={i}
                  className="gallery-thumb card"
                  onClick={() => setSelected(item)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.03, borderColor: 'var(--accent-cyan)' }}
                >
                  <img src={item.url} alt={item.title} className="thumb-image" />
                  <div className="thumb-overlay">
                    <p className="thumb-title">{item.title}</p>
                    <p className="thumb-date">{item.date}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="lightbox-inner"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
            >
              <img src={selected.hdurl || selected.url} alt={selected.title} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }} />
              <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 12, textAlign: 'center' }}>
                {selected.title}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.7rem', textAlign: 'center' }}>
                {selected.date}
              </p>
              <button className="lightbox-close" onClick={() => setSelected(null)}>✕ CLOSE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
