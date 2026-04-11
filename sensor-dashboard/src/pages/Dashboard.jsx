import { useState, useEffect, useRef, useCallback } from 'react';
import SensorCard from '../components/SensorCard';
import SensorDetail from '../components/SensorDetail';
import AnomalyAlert from '../components/AnomalyAlert';
import AlertLevels from '../components/AlertLevels';
import api from '../services/api';
import './Dashboard.css';

/**
 * Dashboard Page
 * Real-time monitoring of all 12 sensors with API polling
 */
function Dashboard() {
  const [sensors, setSensors] = useState([]);
  const [sensorData, setSensorData] = useState({});
  const [latestValues, setLatestValues] = useState({});
  const [anomalies, setAnomalies] = useState([]);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [serialStatus, setSerialStatus] = useState({ connected: false, port: null });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [extrapolatedMode, setExtrapolatedMode] = useState(api.isMockMode());
  const [loading, setLoading] = useState(true);
  const [alertThresholds, setAlertThresholds] = useState(() => {
    const saved = localStorage.getItem('alertThresholds');
    return saved ? JSON.parse(saved) : {};
  });
  const [expandedSensor, setExpandedSensor] = useState(null);
  const [sensorOrder, setSensorOrder] = useState(() => {
    const saved = localStorage.getItem('sensorOrder');
    return saved ? JSON.parse(saved) : [];
  });
  const pollRef = useRef(null);
  const sensorPollRef = useRef(null);
  const anomalyRef = useRef(null);
  const abortRef = useRef(null);
  const notifyCooldownRef = useRef({});
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // Request notification permission on first load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check for threshold breaches and send browser notifications
  const checkThresholdBreaches = useCallback((values) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();

    sensors.forEach(sensor => {
      const sensorKey = String(sensor.id);
      const value = values[sensor.id];
      if (value === null || value === undefined) return;

      const sensorThresholds = alertThresholds[sensorKey];
      if (!sensorThresholds) return;

      // Check levels from highest to lowest severity
      const levelsDesc = ['critical', 'high', 'medium', 'low'];
      for (const level of levelsDesc) {
        const threshold = sensorThresholds[level];
        if (threshold !== undefined && threshold !== '' && value > Number(threshold)) {
          // Check cooldown (60 seconds per sensor)
          const lastNotify = notifyCooldownRef.current[sensorKey] || 0;
          if (now - lastNotify < 60000) break;

          notifyCooldownRef.current[sensorKey] = now;
          const displayName = sensor.name || `Sensor ${sensor.id}`;
          const unit = sensor.unit || '';
          new Notification(`\u26A0 ${displayName} Alert`, {
            body: `Value ${value}${unit} exceeds ${level.charAt(0).toUpperCase() + level.slice(1)} threshold (${threshold})`,
            icon: undefined,
          });
          break; // Only notify for the highest breached level
        }
      }
    });
  }, [sensors, alertThresholds]);

  // Handle alert levels/thresholds change from AlertLevels component
  const handleLevelsChange = useCallback((_levels, thresholds) => {
    setAlertThresholds(thresholds);
  }, []);

  // Initialize - load sensor list and anomalies
  useEffect(() => {
    abortRef.current = new AbortController();
    loadSensors();
    loadAnomalies();
    checkBackendHealth();

    // Re-fetch sensor list every 10 seconds to detect new/removed sensors
    sensorPollRef.current = setInterval(loadSensors, 10000);
    anomalyRef.current = setInterval(loadAnomalies, 30000);

    return () => {
      if (sensorPollRef.current) clearInterval(sensorPollRef.current);
      if (anomalyRef.current) clearInterval(anomalyRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Start polling once sensors are loaded
  useEffect(() => {
    if (sensors.length === 0) return;

    // Clear any previous poll interval
    if (pollRef.current) clearInterval(pollRef.current);

    // Initial load of live data for all sensors
    sensors.forEach(sensor => loadLiveData(sensor.id));

    // Poll every 2 seconds
    pollRef.current = setInterval(() => {
      sensors.forEach(sensor => loadLiveData(sensor.id));
    }, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sensors]);

  const loadSensors = async () => {
    try {
      const response = await api.getSensorList();
      const sensorsData = response.sensors || [];
      const mappedSensors = sensorsData.map(sensor => ({
        ...sensor,
        id: sensor.sensor_id
      }));

      // Only update if the sensor list actually changed
      setSensors(prev => {
        const prevIds = prev.map(s => s.id).sort().join(',');
        const newIds = mappedSensors.map(s => s.id).sort().join(',');
        return prevIds === newIds ? prev : mappedSensors;
      });

      // Mark loading complete after first successful fetch
      setLoading(false);

      // Initialize data for new sensors without wiping existing data
      setSensorData(prev => {
        const updated = { ...prev };
        mappedSensors.forEach(sensor => {
          if (!(sensor.id in updated)) {
            updated[sensor.id] = [];
          }
        });
        // Remove sensors no longer active
        const activeIds = new Set(mappedSensors.map(s => s.id));
        Object.keys(updated).forEach(id => {
          if (!activeIds.has(Number(id))) delete updated[id];
        });
        return updated;
      });

      setLatestValues(prev => {
        const updated = { ...prev };
        mappedSensors.forEach(sensor => {
          if (!(sensor.id in updated)) {
            updated[sensor.id] = null;
          }
        });
        const activeIds = new Set(mappedSensors.map(s => s.id));
        Object.keys(updated).forEach(id => {
          if (!activeIds.has(Number(id))) delete updated[id];
        });
        return updated;
      });
    } catch (error) {
      console.error('[Dashboard] Error loading sensors:', error);
    }
  };

  const loadLiveData = async (sensorId) => {
    try {
      const response = await api.getLiveSensorData(sensorId);
      const data = response.data || [];

      if (data && data.length > 0) {
        const mapped = data.map(d => ({
          timestamp: d.timestamp,
          value: d.avg !== undefined ? d.avg : d.value,
        }));

        setSensorData(prev => ({
          ...prev,
          [sensorId]: mapped.slice(-60)
        }));

        const latestReading = mapped[mapped.length - 1];
        setLatestValues(prev => {
          const updated = { ...prev, [sensorId]: latestReading.value };
          checkThresholdBreaches(updated);
          return updated;
        });

        setLastUpdate(new Date());
      }
    } catch {
      // Silently fail on individual sensor poll errors
    }
  };

  const loadAnomalies = async () => {
    try {
      const response = await api.getAnomalies({ limit: 20 });
      const anomaliesData = response.anomalies || [];
      setAnomalies(anomaliesData.slice(0, 10));
    } catch (error) {
      console.error('[Dashboard] Error loading anomalies:', error);
    }
  };

  const checkBackendHealth = async () => {
    const isHealthy = await api.healthCheck();
    setBackendStatus(isHealthy ? 'online' : 'offline');
    const serial = await api.getSerialStatus();
    setSerialStatus(serial);
  };

  const toggleExtrapolatedMode = () => {
    const newMode = !extrapolatedMode;
    api.setMockMode(newMode);
    setExtrapolatedMode(newMode);
    // Clear existing data and reload with new source
    setSensors([]);
    setSensorData({});
    setLatestValues({});
    setLoading(true);
    loadSensors();
    loadAnomalies();
    checkBackendHealth();
  };

  // Determine sensor status color for summary bar
  const getSensorStatus = (sensor) => {
    const value = latestValues[sensor.id];
    if (value === null || value === undefined) return 'offline';
    const sensorKey = String(sensor.id);
    const thresholds = alertThresholds[sensorKey];
    if (thresholds) {
      if (thresholds.critical !== undefined && thresholds.critical !== '' && value > Number(thresholds.critical)) return 'critical';
      if (thresholds.high !== undefined && thresholds.high !== '' && value > Number(thresholds.high)) return 'high';
      if (thresholds.medium !== undefined && thresholds.medium !== '' && value > Number(thresholds.medium)) return 'medium';
      if (thresholds.low !== undefined && thresholds.low !== '' && value > Number(thresholds.low)) return 'low';
      return 'normal';
    }
    return 'normal';
  };

  const getStatusDotColor = (statusLevel) => {
    switch (statusLevel) {
      case 'critical': return 'var(--status-danger)';
      case 'high': return '#FF8A00';
      case 'medium': return 'var(--status-warning)';
      case 'low': return 'var(--status-success)';
      case 'normal': return 'var(--status-success)';
      case 'offline': return 'var(--text-secondary)';
      default: return 'var(--text-secondary)';
    }
  };

  const formatSummaryValue = (val) => {
    if (val === null || val === undefined) return '--';
    if (Math.abs(val) >= 1000) return Math.round(val).toLocaleString();
    if (Math.abs(val) < 1) return val.toFixed(2);
    return val.toFixed(1);
  };

  // --- Drag-to-reorder handlers ---
  const getOrderedSensors = () => {
    if (sensorOrder.length === 0) return sensors;
    const orderMap = {};
    sensorOrder.forEach((id, idx) => { orderMap[id] = idx; });
    const ordered = [];
    const unordered = [];
    sensors.forEach(s => {
      if (s.id in orderMap) {
        ordered.push(s);
      } else {
        unordered.push(s);
      }
    });
    ordered.sort((a, b) => orderMap[a.id] - orderMap[b.id]);
    return [...ordered, ...unordered];
  };

  const handleDragStart = (index) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverItem.current = index;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const currentOrdered = getOrderedSensors();
    const reordered = [...currentOrdered];
    const [draggedItem] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, draggedItem);
    const newOrder = reordered.map(s => s.id);
    setSensorOrder(newOrder);
    localStorage.setItem('sensorOrder', JSON.stringify(newOrder));
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const orderedSensors = getOrderedSensors();

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Environmental Sensor Monitoring</h1>
          <p className="dashboard-subtitle">Real-time monitoring &mdash; {sensors.length} channel{sensors.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="status-indicators">
          <div className="status-item">
            <span className="status-label">Backend</span>
            <span className={`status-badge status-${backendStatus}`}>
              {backendStatus === 'online' ? '\u25CF Online' : backendStatus === 'checking' ? '\u25CF Checking' : '\u25CF Offline'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Serial</span>
            <span className={`status-badge ${serialStatus.connected ? 'status-connected' : 'status-serial-off'}`}>
              {serialStatus.connected ? `\u25CF ${serialStatus.port || 'COM3'}` : '\u25CF --'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Data Feed</span>
            <span className={`status-badge status-${lastUpdate ? 'connected' : 'disconnected'}`}>
              {lastUpdate ? '\u25CF Live (Polling)' : '\u25CF Waiting'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Last Update</span>
            <span className="status-badge">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : '\u2014'}
            </span>
          </div>

          <div className="status-item">
            <button
              className={`data-mode-toggle ${extrapolatedMode ? 'extrapolated-active' : ''}`}
              onClick={toggleExtrapolatedMode}
            >
              {extrapolatedMode ? 'Extrapolated Data' : 'Live Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {sensors.length > 0 && (
        <div className="summary-bar">
          {sensors.map(sensor => {
            const statusLevel = getSensorStatus(sensor);
            return (
              <div key={sensor.id} className="summary-item">
                <span
                  className="summary-dot"
                  style={{ backgroundColor: getStatusDotColor(statusLevel) }}
                />
                <span className="summary-name">{sensor.name || `Sensor ${sensor.id}`}</span>
                <span className="summary-value">
                  {formatSummaryValue(latestValues[sensor.id])}
                </span>
                <span className="summary-unit">{sensor.unit || ''}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="dashboard-content">
        <div className="sensor-grid">
          {sensors.length === 0 && loading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-header">
                    <div className="skeleton-line skeleton-line-title" />
                    <div className="skeleton-line skeleton-line-short" />
                  </div>
                  <div className="skeleton-body">
                    <div className="skeleton-gauge" />
                    <div className="skeleton-sparkline" />
                  </div>
                  <div className="skeleton-footer">
                    <div className="skeleton-stat" />
                    <div className="skeleton-stat" />
                    <div className="skeleton-stat" />
                    <div className="skeleton-stat" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            orderedSensors.map((sensor, index) => (
              <SensorCard
                key={sensor.id}
                sensorId={sensor.id}
                sensorName={sensor.name}
                sensorModel={sensor.sensor_model}
                unit={sensor.unit}
                liveData={sensorData[sensor.id] || []}
                latestValue={latestValues[sensor.id]}
                min={sensor.range_min}
                max={sensor.range_max}
                alertThresholds={alertThresholds[String(sensor.id)]}
                onClick={() => setExpandedSensor(sensor.id)}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
              />
            ))
          )}
        </div>

        <div className="anomaly-panel">
          <AnomalyAlert anomalies={anomalies} sensorMetadata={sensors} />
          <AlertLevels sensors={sensors} onLevelsChange={handleLevelsChange} />
        </div>
      </div>

      {expandedSensor !== null && (() => {
        const sensor = sensors.find(s => s.id === expandedSensor);
        if (!sensor) return null;
        return (
          <SensorDetail
            sensorId={sensor.id}
            sensorName={sensor.name}
            sensorModel={sensor.sensor_model}
            unit={sensor.unit}
            liveData={sensorData[sensor.id] || []}
            latestValue={latestValues[sensor.id]}
            onClose={() => setExpandedSensor(null)}
          />
        );
      })()}
    </div>
  );
}

export default Dashboard;
