import { useState, useEffect } from 'react';
import './AlertLevels.css';

const DEFAULT_LEVELS = [
  { id: 'critical', name: 'Critical', color: '#FF4757', description: 'Immediate action required' },
  { id: 'high',     name: 'High',     color: '#FF8A00', description: 'Urgent attention needed' },
  { id: 'medium',   name: 'Medium',   color: '#FFB800', description: 'Monitor closely' },
  { id: 'low',      name: 'Low',      color: '#00E676', description: 'Informational' },
];

const STORAGE_KEY_LEVELS = 'alertLevels';
const STORAGE_KEY_THRESHOLDS = 'alertThresholds';

function AlertLevels({ sensors = [], onLevelsChange }) {
  const [levels, setLevels] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LEVELS);
    return saved ? JSON.parse(saved) : DEFAULT_LEVELS;
  });

  // Per-sensor thresholds: { [sensorId]: { low: number, medium: number, high: number, critical: number } }
  const [thresholds, setThresholds] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THRESHOLDS);
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedSensor, setSelectedSensor] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Auto-select first sensor when list loads
  useEffect(() => {
    if (sensors.length > 0 && !selectedSensor) {
      setSelectedSensor(sensors[0].id ?? sensors[0].sensor_id);
    }
  }, [sensors, selectedSensor]);

  const persistLevels = (updated) => {
    setLevels(updated);
    localStorage.setItem(STORAGE_KEY_LEVELS, JSON.stringify(updated));
    onLevelsChange?.(updated, thresholds);
  };

  const persistThresholds = (updated) => {
    setThresholds(updated);
    localStorage.setItem(STORAGE_KEY_THRESHOLDS, JSON.stringify(updated));
    onLevelsChange?.(levels, updated);
  };

  const updateLevelColor = (id, color) => {
    persistLevels(levels.map(l => l.id === id ? { ...l, color } : l));
  };

  const updateLevelName = (id, name) => {
    persistLevels(levels.map(l => l.id === id ? { ...l, name } : l));
  };

  const resetDefaults = () => {
    persistLevels(DEFAULT_LEVELS);
    persistThresholds({});
    setEditingId(null);
  };

  const handleThresholdChange = (levelId, value) => {
    if (!selectedSensor) return;
    const sensorKey = String(selectedSensor);
    const current = thresholds[sensorKey] || {};
    const updated = {
      ...thresholds,
      [sensorKey]: {
        ...current,
        [levelId]: value === '' ? '' : Number(value),
      },
    };
    persistThresholds(updated);
  };

  const getThresholdValue = (levelId) => {
    if (!selectedSensor) return '';
    const sensorKey = String(selectedSensor);
    const val = thresholds[sensorKey]?.[levelId];
    return val !== undefined ? val : '';
  };

  const selectedSensorInfo = sensors.find(
    s => (s.id ?? s.sensor_id) === selectedSensor
  );

  return (
    <div className="alert-levels-container">
      <div className="alert-levels-header">
        <h3>Alert Levels</h3>
      </div>

      {/* Sensor selector */}
      {sensors.length > 0 && (
        <div className="alert-sensor-selector">
          <label className="alert-sensor-label">Sensor</label>
          <select
            className="alert-sensor-select"
            value={selectedSensor ?? ''}
            onChange={(e) => setSelectedSensor(Number(e.target.value))}
          >
            {sensors.map(s => {
              const id = s.id ?? s.sensor_id;
              return (
                <option key={id} value={id}>
                  {s.name || `Sensor ${id}`}
                </option>
              );
            })}
          </select>
          {selectedSensorInfo?.unit && (
            <span className="alert-sensor-unit">{selectedSensorInfo.unit}</span>
          )}
        </div>
      )}

      {/* Alert level rows */}
      <div className="alert-levels-list">
        {levels.map((level) => (
          <div key={level.id} className="alert-level-item">
            <div className="alert-level-row">
              <span
                className="alert-level-indicator"
                style={{ backgroundColor: level.color, borderColor: level.color }}
              />

              <div className="alert-level-info">
                {editingId === level.id ? (
                  <input
                    className="alert-level-name-input"
                    value={level.name}
                    onChange={(e) => updateLevelName(level.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <span
                    className="alert-level-name"
                    style={{ color: level.color }}
                    onClick={() => setEditingId(level.id)}
                    title="Click to rename"
                  >
                    {level.name}
                  </span>
                )}
                <span className="alert-level-desc">{level.description}</span>
              </div>

              {/* Threshold input for selected sensor */}
              {selectedSensor && (
                <input
                  type="number"
                  className="alert-threshold-input"
                  placeholder="--"
                  value={getThresholdValue(level.id)}
                  onChange={(e) => handleThresholdChange(level.id, e.target.value)}
                  title={`${level.name} threshold for ${selectedSensorInfo?.name || 'sensor'}`}
                />
              )}

              <input
                type="color"
                className="alert-level-color-picker"
                value={level.color}
                onChange={(e) => updateLevelColor(level.id, e.target.value)}
                title="Change color"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      {selectedSensor && (
        <div className="alert-threshold-hint">
          Set the value above which each level triggers for the selected sensor.
        </div>
      )}

      <div className="alert-levels-footer">
        <button className="alert-levels-reset" onClick={resetDefaults}>
          Reset Defaults
        </button>
      </div>
    </div>
  );
}

export default AlertLevels;
