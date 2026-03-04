import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

/**
 * Navigation Component
 * Top navigation bar with routing
 */
function Navigation() {
  const location = useLocation();

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
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
