import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

/**
 * Navigation Component
 * Top navigation bar with routing and theme toggle
 */
function Navigation() {
  const location = useLocation();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setTheme(next);
  };

  const isActive = (path) => {
    return location.pathname === path ? ' active' : '';
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <div className="brand-icon">📊</div>
          <div className="brand-text">
            <h1>Sensor Monitor</h1>
            <p>Environmental Monitoring System</p>
          </div>
        </div>

        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            <span className="nav-icon">🏠</span>
            Dashboard
          </Link>
          <Link to="/analytics" className={`nav-link ${isActive('/analytics')}`}>
            <span className="nav-icon">📈</span>
            Analytics
          </Link>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            <span className="nav-icon">{theme === 'dark' ? '☀' : '🌙'}</span>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
