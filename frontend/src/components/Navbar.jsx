import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import { apiFetch } from '../lib/api';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState({ loading: true, ok: false });
  const location = useLocation();
  const navigate = useNavigate();

  const doLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setAuth({ loading: false, ok: false });
    navigate('/login');
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location]);

  useEffect(() => {
    let alive = true;
    setAuth((prev) => ({ ...prev, loading: true }));
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!alive) return;
        setAuth({ loading: false, ok: res.ok });
      } catch {
        if (!alive) return;
        setAuth({ loading: false, ok: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors duration-150 px-1 py-0.5 border-b-2 ${
      isActive
        ? 'text-gray-900 border-gray-900'
        : 'text-gray-500 border-transparent hover:text-gray-900'
    }`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-white'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 group">
          <Logo className="h-10 w-auto" alt="Logo" />
        </NavLink>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          {auth.ok && <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          {auth.ok ? (
            <>
              <NavLink to="/dashboard" className="btn-primary text-sm">
                Open Dashboard &gt;
              </NavLink>
              <button onClick={doLogout} className="btn-secondary text-sm">
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn-secondary text-sm">
              Login
            </NavLink>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-600 hover:text-gray-900"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-4">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          {auth.ok && <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>}
          {auth.ok ? (
            <>
              <NavLink to="/dashboard" className="btn-primary text-sm text-center justify-center">
                Open Dashboard &gt;
              </NavLink>
              <button onClick={doLogout} className="btn-secondary text-sm text-center justify-center">
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn-secondary text-sm text-center justify-center">
              Login
            </NavLink>
          )}
        </div>
      )}
    </header>
  );
}
