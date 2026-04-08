import './AnomalyAlert.css';

/**
 * AnomalyAlert Component
 * Displays recent sensor anomalies with severity indicators
 */
function AnomalyAlert({ anomalies = [], sensorMetadata = [] }) {
  const getSensorInfo = (sensorId) => {
    const sensor = sensorMetadata.find(s => s.id === sensorId || s.sensor_id === sensorId);
    return sensor || null;
  };

  const getSensorName = (sensorId) => {
    const sensor = getSensorInfo(sensorId);
    return sensor ? sensor.name : `Sensor ${sensorId}`;
  };

  const getSensorUnit = (sensorId) => {
    const sensor = getSensorInfo(sensorId);
    return sensor?.unit || '';
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getSeverityClass = (severity) => `anomaly-item severity-${severity}`;

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatAnomalyValue = (value, sensorId) => {
    if (value === null || value === undefined) return 'N/A';
    const unit = getSensorUnit(sensorId);
    let formatted;
    if (Math.abs(value) >= 1000) formatted = Math.round(value).toLocaleString('en-US');
    else if (Math.abs(value) < 1) formatted = value.toFixed(3);
    else formatted = value.toFixed(2);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const getAnomalyTypeLabel = (type) => {
    const labels = {
      spike: 'Spike Detected',
      dropout: 'Signal Dropout',
      out_of_range: 'Out of Range',
      sudden_change: 'Sudden Change'
    };
    return labels[type] || type;
  };

  return (
    <div className="anomaly-alert-container">
      <div className="anomaly-header">
        <h3>Recent Anomalies</h3>
        <span className={`anomaly-count ${anomalies.length > 0 ? 'has-anomalies' : ''}`}>
          {anomalies.length}
        </span>
      </div>

      <div className="anomaly-list">
        {anomalies.length === 0 ? (
          <div className="no-anomalies">
            <span className="checkmark">✓</span>
            <p>All sensors operating normally</p>
          </div>
        ) : (
          anomalies.map((anomaly) => (
            <div key={anomaly.id || `${anomaly.sensor_id}-${anomaly.timestamp}`} className={getSeverityClass(anomaly.severity)}>
              <div className="anomaly-icon">{getSeverityIcon(anomaly.severity)}</div>

              <div className="anomaly-content">
                <div className="anomaly-title">
                  <span className="anomaly-sensor">{getSensorName(anomaly.sensor_id)}</span>
                  <span className="anomaly-type">{getAnomalyTypeLabel(anomaly.anomaly_type)}</span>
                </div>

                <div className="anomaly-details">
                  <span className="anomaly-value">{formatAnomalyValue(anomaly.value, anomaly.sensor_id)}</span>
                  <span className="anomaly-time">{formatTimestamp(anomaly.timestamp)}</span>
                </div>
              </div>

              <div className={`anomaly-severity-badge severity-${anomaly.severity}`}>
                {anomaly.severity.toUpperCase()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AnomalyAlert;
