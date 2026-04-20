import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { apiFetch } from './lib/api';

function RequireAuth({ children }) {
  const location = useLocation();
  const [state, setState] = React.useState({ loading: true, ok: false });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!alive) return;
        setState({ loading: false, ok: res.ok });
      } catch {
        if (!alive) return;
        setState({ loading: false, ok: false });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.loading) return null;
  if (!state.ok) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        </Routes>
      </main>
    </>
  );
}
