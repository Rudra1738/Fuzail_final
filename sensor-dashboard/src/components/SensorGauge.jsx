import Plot from 'react-plotly.js';

// Resolved color constants (Plotly can't resolve CSS custom properties)
const COLORS = {
  textPrimary: '#E8ECF5',
  textSecondary: '#A0A8C0',
  bgSecondary: '#1A1F3A',
  bgTertiary: '#252B4A',
  borderColor: 'rgba(160, 168, 192, 0.1)',
  success: '#00E676',
  warning: '#FFB800',
  danger: '#FF4757',
  blue: '#4F7BFF',
  amber: '#FFB800',
  fontPrimary: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  fontMono: 'Fira Code, Consolas, Monaco, monospace',
};

/**
 * SensorGauge Component
 * Displays current sensor value as a gauge chart with proper units
 */
function SensorGauge({ sensorId, value, min = 0, max = 100, title, unit = '' }) {
  // Clamp value to display range for gauge (bar won't overflow)
  const displayValue = Math.max(min, Math.min(max, value));

  // Determine bar color based on percentage within range
  const getColor = () => {
    const percentage = ((displayValue - min) / (max - min)) * 100;
    if (percentage < 20) return COLORS.success;
    if (percentage < 40) return COLORS.blue;
    if (percentage < 60) return COLORS.amber;
    if (percentage < 80) return COLORS.warning;
    return COLORS.danger;
  };

  // Auto-format based on value magnitude
  const getValueFormat = () => {
    if (Math.abs(max) >= 10000) return ',.0f';
    if (Math.abs(max) >= 100) return ',.1f';
    if (Math.abs(max) < 1) return '.4f';
    return '.2f';
  };

  const gaugeData = [{
    type: 'indicator',
    mode: 'gauge+number',
    value: displayValue,
    title: {
      text: title || `Sensor ${sensorId}`,
      font: {
        color: COLORS.textPrimary,
        size: 14,
        family: COLORS.fontPrimary
      }
    },
    number: {
      font: {
        color: COLORS.textPrimary,
        size: 24,
        family: COLORS.fontMono
      },
      suffix: unit ? ` ${unit}` : '',
      valueformat: getValueFormat(),
    },
    gauge: {
      axis: {
        range: [min, max],
        tickcolor: COLORS.textSecondary,
        tickfont: {
          color: COLORS.textSecondary,
          size: 10
        }
      },
      bar: { color: getColor() },
      bgcolor: COLORS.bgSecondary,
      borderwidth: 2,
      bordercolor: COLORS.borderColor,
      steps: [
        { range: [min, min + (max - min) * 0.33], color: COLORS.bgTertiary },
        { range: [min + (max - min) * 0.33, min + (max - min) * 0.67], color: 'rgba(79, 123, 255, 0.05)' },
        { range: [min + (max - min) * 0.67, max], color: 'rgba(255, 71, 87, 0.05)' }
      ],
      threshold: {
        line: { color: COLORS.danger, width: 4 },
        thickness: 0.75,
        value: max * 0.9
      }
    }
  }];

  const layout = {
    margin: { t: 40, b: 10, l: 10, r: 10 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      family: COLORS.fontPrimary,
      color: COLORS.textPrimary
    },
    height: 200
  };

  const config = {
    displayModeBar: false,
    responsive: true
  };

  return (
    <div className="sensor-gauge">
      <Plot
        data={gaugeData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '200px' }}
      />
    </div>
  );
}

export default SensorGauge;
