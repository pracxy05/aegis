import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard   from './pages/Dashboard';
import Login       from './pages/Login';
import Rockets     from './pages/Rockets';
import Profile     from './pages/Profile';
import Analytics   from './pages/Analytics';
import Stars       from './pages/Stars';
import Cosmos      from './pages/Cosmos';
import Conflict    from './pages/Conflict';
import Atmosphere  from './pages/Atmosphere';
import Defense     from './pages/Defense';
import Intel       from './pages/Intel';
import { useAuthStore } from './store/store';

function Guard({ children }) {
  const token = useAuthStore(s => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/"           element={<Guard><Dashboard  /></Guard>} />
        <Route path="/rockets"    element={<Guard><Rockets    /></Guard>} />
        <Route path="/profile"    element={<Guard><Profile    /></Guard>} />
        <Route path="/analytics"  element={<Guard><Analytics  /></Guard>} />
        <Route path="/stars"      element={<Guard><Stars      /></Guard>} />
        <Route path="/cosmos"     element={<Guard><Cosmos     /></Guard>} />
        <Route path="/conflict"   element={<Guard><Conflict   /></Guard>} />
        <Route path="/atmosphere" element={<Guard><Atmosphere /></Guard>} />
        <Route path="/defense"    element={<Guard><Defense    /></Guard>} />
        <Route path="/intel"      element={<Guard><Intel      /></Guard>} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
