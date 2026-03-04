import { useState, useEffect } from 'react';
import SensorGauge from './SensorGauge';
import Sparkline from './Sparkline';
import './SensorCard.css';

/**
 * SensorCard Component
 * Displays sensor gauge, sparkline, and status information
 * Uses real sensor metadata (name, unit, range) from the API
 */

// Sensors where LOW values are desirable (pollutants/contaminants)
const LOW_IS_GOOD_SENSORS = new Set([
  'CO', 'NO₂', 'NH₃', 'TVOC', 'eCO₂', 'PM2.5', 'IAQ Index',
]);
// Sensors where HIGH values are desirable
const HIGH_IS_GOOD_SENSORS = new Set(['Gas Resistance']);

function SensorCard({
  sensorId,
  sensorName = '',
  sensorModel = '',
  unit = '',
  liveData = [],
  latestValue,
  min = 0,
  max = 100,
}) {
  const [status, setStatus] = useState('normal');
  const [lastUpdate, setLastUpdate] = useState(null);

  const displayName = sensorName || `Sensor ${sensorId}`;

  // Determine sensor status based on value and sensor type
  useEffect(() => {
    if (latestValue === null || latestValue === undefined) {
      setStatus('offline');
      return;
    }

    // Clamp percentage to 0-100 for sensors whose values can exceed metadata range
    const rawPct = ((latestValue - min) / (max - min)) * 100;
    const percentage = Math.max(0, Math.min(100, rawPct));

    if (LOW_IS_GOOD_SENSORS.has(sensorName)) {
      // For pollutants: low=good, high=bad
      if (percentage > 80) setStatus('critical');
      else if (percentage > 60) setStatus('warning');
      else setStatus('normal');
    } else if (HIGH_IS_GOOD_SENSORS.has(sensorName)) {
      // For gas resistance: high=clean air=good
      if (percentage < 15) setStatus('critical');
      else if (percentage < 30) setStatus('warning');
      else setStatus('normal');
    } else {
      // For environmental readings (temp, humidity, pressure, light): mid-range=normal
      if (percentage > 90 || percentage < 10) setStatus('warning');
      else setStatus('normal');
    }

    setLastUpdate(new Date());
  }, [latestValue, min, max, sensorName]);

  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return 'var(--status-danger)';
      case 'warning':
        return 'var(--status-warning)';
      case 'normal':
        return 'var(--status-success)';
      case 'offline':
        return 'var(--text-secondary)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusBgColor = () => {
    switch (status) {
      case 'critical':
        return 'var(--status-danger-dim)';
      case 'warning':
        return 'var(--status-warning-dim)';
      case 'normal':
        return 'var(--status-success-dim)';
      default:
        return 'var(--status-neutral-dim)';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'critical': return 'CRITICAL';
      case 'warning': return 'WARNING';
      case 'normal': return 'NORMAL';
      case 'offline': return 'OFFLINE';
      default: return 'UNKNOWN';
    }
  };

  // Get chart color based on sensor ID (resolved hex for Plotly)
  const CHART_COLORS = [
    '#4F7BFF', '#00E676', '#FFB800', '#00D9FF', '#FF6B9D', '#9D4FFF',
    '#00FFA3', '#FF8A00', '#4FFFB0', '#FFD600', '#FF4757', '#A0A8C0'
  ];

  const getChartColor = () => CHART_COLORS[(sensorId - 1) % 12];

  // Format value with appropriate precision and thousand separators
  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A';
    let formatted;
    if (Math.abs(val) >= 1000) formatted = Math.round(val);
    else if (Math.abs(val) < 1) formatted = val.toFixed(3);
    else formatted = val.toFixed(2);
    return Number(formatted).toLocaleString('en-US', {
      maximumFractionDigits: Math.abs(val) >= 1000 ? 0 : Math.abs(val) < 1 ? 3 : 2,
    });
  };

  // Compact format for footer stats (abbreviated: 37k, 101.2k, 0.62)
  const formatCompact = (val) => {
    if (val === null || val === undefined) return 'N/A';
    const abs = Math.abs(val);
    if (abs >= 100000) return (val / 1000).toFixed(1) + 'k';
    if (abs >= 10000) return Math.round(val / 1000) + 'k';
    if (abs >= 1000) return (val / 1000).toFixed(1) + 'k';
    if (abs < 1) return val.toFixed(2);
    if (abs < 10) return val.toFixed(1);
    return Math.round(val).toString();
  };

  return (
    <div className="sensor-card">
      <div className="sensor-card-header">
        <div className="sensor-title">
          <span className="sensor-id">{displayName}</span>
          <span
            className="sensor-status"
            style={{ color: getStatusColor(), background: getStatusBgColor() }}
          >
            {getStatusText()}
          </span>
        </div>
        <div className="sensor-meta">
          {sensorModel && <span className="sensor-model">{sensorModel}</span>}
          <span className="sensor-unit">{unit || 'index'}</span>
        </div>
        {lastUpdate && (
          <div className="last-update">
            Updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="sensor-card-body">
        <SensorGauge
          sensorId={sensorId}
          value={latestValue || 0}
          min={min}
          max={max}
          title={displayName}
          unit={unit}
        />

        <div className="sparkline-section">
          <div className="sparkline-label">Last 60 seconds</div>
          <Sparkline
            data={liveData}
            color={getChartColor()}
            height={60}
          />
        </div>
      </div>

      <div className="sensor-card-footer">
        <div className="stat">
          <span className="stat-label">Current</span>
          <span className="stat-value">{formatCompact(latestValue)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Min</span>
          <span className="stat-value">{liveData.length > 0 ? formatCompact(Math.min(...liveData.map(d => d.value))) : 'N/A'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Max</span>
          <span className="stat-value">{liveData.length > 0 ? formatCompact(Math.max(...liveData.map(d => d.value))) : 'N/A'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg</span>
          <span className="stat-value">
            {liveData.length > 0
              ? formatCompact(liveData.reduce((sum, d) => sum + d.value, 0) / liveData.length)
              : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SensorCard;
