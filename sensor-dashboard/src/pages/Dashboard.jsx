import { useState, useEffect, useRef } from 'react';
import SensorCard from '../components/SensorCard';
import AnomalyAlert from '../components/AnomalyAlert';
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
  const [lastUpdate, setLastUpdate] = useState(null);
  const pollRef = useRef(null);
  const sensorPollRef = useRef(null);
  const anomalyRef = useRef(null);
  const abortRef = useRef(null);

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
        setLatestValues(prev => ({
          ...prev,
          [sensorId]: latestReading.value
        }));

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
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Environmental Sensor Monitoring</h1>
          <p className="dashboard-subtitle">Real-time monitoring — {sensors.length} channel{sensors.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="status-indicators">
          <div className="status-item">
            <span className="status-label">Backend</span>
            <span className={`status-badge status-${backendStatus}`}>
              {backendStatus === 'online' ? '● Online' : backendStatus === 'checking' ? '● Checking' : '● Offline'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Data Feed</span>
            <span className={`status-badge status-${lastUpdate ? 'connected' : 'disconnected'}`}>
              {lastUpdate ? '● Live (Polling)' : '● Waiting'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Last Update</span>
            <span className="status-badge">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="sensor-grid">
          {sensors.map(sensor => (
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
            />
          ))}
        </div>

        <div className="anomaly-panel">
          <AnomalyAlert anomalies={anomalies} sensorMetadata={sensors} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
