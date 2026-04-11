import { useEffect, useCallback } from 'react';
import Plot from 'react-plotly.js';
import './SensorDetail.css';

/**
 * SensorDetail Component
 * Full-screen modal overlay showing expanded sensor data.
 * Plotly colors are hardcoded resolved values (cannot use CSS variables).
 */

// Resolved Plotly-safe colors (dark theme)
const PLOTLY_COLORS = {
  textPrimary: '#E8ECF5',
  textSecondary: '#A0A8C0',
  bgSecondary: '#1A1F3A',
  bgTertiary: '#252B4A',
  borderColor: 'rgba(160, 168, 192, 0.1)',
  line: '#4F7BFF',
};

const CHART_COLORS = [
  '#4F7BFF', '#00E676', '#FFB800', '#00D9FF', '#FF6B9D', '#9D4FFF',
  '#00FFA3', '#FF8A00', '#4FFFB0', '#FFD600', '#FF4757', '#A0A8C0',
];

function SensorDetail({
  sensorId,
  sensorName = '',
  sensorModel = '',
  unit = '',
  liveData = [],
  latestValue,
  onClose,
}) {
  const displayName = sensorName || `Sensor ${sensorId}`;
  const chartColor = CHART_COLORS[(sensorId - 1) % CHART_COLORS.length];

  // Close on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Close when clicking backdrop (not the modal itself)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Statistics
  const values = liveData.map(d => d.value);
  const currentVal = latestValue;
  const minVal = values.length > 0 ? Math.min(...values) : null;
  const maxVal = values.length > 0 ? Math.max(...values) : null;
  const avgVal = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const stdVal = values.length > 1
    ? Math.sqrt(values.reduce((sum, v) => sum + (v - avgVal) ** 2, 0) / (values.length - 1))
    : null;

  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (Math.abs(val) >= 1000) return Math.round(val).toLocaleString('en-US');
    if (Math.abs(val) < 1) return val.toFixed(3);
    return val.toFixed(2);
  };

  // Convert hex to rgba for fill
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Plotly chart data
  const timestamps = liveData.map(d => d.timestamp);
  const chartValues = liveData.map(d => d.value);

  let yMin, yMax;
  if (chartValues.length > 0) {
    const dataMin = Math.min(...chartValues);
    const dataMax = Math.max(...chartValues);
    const padding = (dataMax - dataMin) * 0.1 || Math.abs(dataMax * 0.05) || 1;
    yMin = dataMin - padding;
    yMax = dataMax + padding;
  }

  const traceData = [{
    type: 'scatter',
    mode: 'lines',
    x: timestamps,
    y: chartValues,
    line: {
      color: chartColor,
      width: 2,
      shape: 'spline',
    },
    fill: 'tozeroy',
    fillcolor: hexToRgba(chartColor, 0.08),
    hovertemplate: '<b>%{y:.3f}</b> ' + (unit || '') + '<br>%{x|%H:%M:%S}<extra></extra>',
  }];

  const layout = {
    margin: { t: 10, b: 40, l: 60, r: 20 },
    paper_bgcolor: PLOTLY_COLORS.bgSecondary,
    plot_bgcolor: PLOTLY_COLORS.bgSecondary,
    height: 400,
    xaxis: {
      type: 'date',
      tickformat: '%H:%M:%S',
      showgrid: true,
      gridcolor: PLOTLY_COLORS.borderColor,
      tickfont: { size: 11, color: PLOTLY_COLORS.textSecondary },
      linecolor: PLOTLY_COLORS.borderColor,
    },
    yaxis: {
      showgrid: true,
      gridcolor: PLOTLY_COLORS.borderColor,
      tickfont: { size: 11, color: PLOTLY_COLORS.textSecondary },
      linecolor: PLOTLY_COLORS.borderColor,
      range: yMin !== undefined ? [yMin, yMax] : undefined,
      title: {
        text: unit || '',
        font: { size: 12, color: PLOTLY_COLORS.textSecondary },
      },
    },
    showlegend: false,
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor: PLOTLY_COLORS.bgTertiary,
      bordercolor: PLOTLY_COLORS.borderColor,
      font: { color: PLOTLY_COLORS.textPrimary, size: 12 },
    },
  };

  const config = {
    displayModeBar: false,
    responsive: true,
  };

  const stats = [
    { label: 'Current', value: formatValue(currentVal) },
    { label: 'Min', value: formatValue(minVal) },
    { label: 'Max', value: formatValue(maxVal) },
    { label: 'Avg', value: formatValue(avgVal) },
    { label: 'Std Dev', value: formatValue(stdVal) },
  ];

  return (
    <div className="sensor-detail-backdrop" onClick={handleBackdropClick}>
      <div className="sensor-detail-modal">
        <button className="sensor-detail-close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <div className="sensor-detail-header">
          <h2 className="sensor-detail-title">{displayName}</h2>
          <div className="sensor-detail-meta">
            {sensorModel && <span className="sensor-detail-model">{sensorModel}</span>}
            <span className="sensor-detail-unit">{unit || 'index'}</span>
          </div>
        </div>

        <div className="sensor-detail-chart">
          <div className="sensor-detail-chart-title">Live Data — Last 60 Seconds</div>
          {liveData.length > 0 ? (
            <Plot
              data={traceData}
              layout={layout}
              config={config}
              style={{ width: '100%', height: '400px' }}
            />
          ) : (
            <div style={{
              height: '400px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: PLOTLY_COLORS.textSecondary,
              fontSize: '14px',
              background: PLOTLY_COLORS.bgSecondary,
              borderRadius: '8px',
            }}>
              No data available
            </div>
          )}
        </div>

        <div className="sensor-detail-stats">
          {stats.map(({ label, value }) => (
            <div className="sensor-detail-stat-card" key={label}>
              <div className="sensor-detail-stat-label">{label}</div>
              <div className="sensor-detail-stat-value">{value}</div>
              <div className="sensor-detail-stat-unit">{unit || 'index'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SensorDetail;
