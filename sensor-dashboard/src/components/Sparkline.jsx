import Plot from 'react-plotly.js';

/**
 * Sparkline Component
 * Small line chart showing recent sensor data trend
 * Color prop should be a resolved hex color (e.g. '#4F7BFF'), not a CSS variable.
 */
function Sparkline({ data = [], color = '#4F7BFF', height = 60 }) {
  const timestamps = data.map(d => d.timestamp);
  const values = data.map(d => d.value);

  // Convert hex color to rgba for fill
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const fillColor = hexToRgba(color, 0.1);

  const traceData = [{
    type: 'scatter',
    mode: 'lines',
    x: timestamps,
    y: values,
    line: {
      color: color,
      width: 2,
      shape: 'spline'
    },
    fill: 'tozeroy',
    fillcolor: fillColor,
    hovertemplate: '<b>%{y:.2f}</b><br>%{x|%H:%M:%S}<extra></extra>'
  }];

  // Auto-range Y-axis to data extent (with 10% padding) so trends are visible
  let yMin, yMax;
  if (values.length > 0) {
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const padding = (dataMax - dataMin) * 0.1 || Math.abs(dataMax * 0.05) || 1;
    yMin = dataMin - padding;
    yMax = dataMax + padding;
  }

  const layout = {
    margin: { t: 5, b: 20, l: 0, r: 0 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      visible: true,
      showgrid: false,
      showticklabels: true,
      tickfont: {
        size: 8,
        color: '#A0A8C0'
      },
      type: 'date',
      tickformat: '%H:%M:%S'
    },
    yaxis: {
      visible: true,
      showgrid: true,
      gridcolor: 'rgba(160, 168, 192, 0.05)',
      showticklabels: true,
      tickfont: {
        size: 8,
        color: '#A0A8C0'
      },
      range: yMin !== undefined ? [yMin, yMax] : undefined,
    },
    height: height,
    showlegend: false,
    hovermode: 'x unified'
  };

  const config = {
    displayModeBar: false,
    responsive: true
  };

  return (
    <div className="sparkline">
      {data.length > 0 ? (
        <Plot
          data={traceData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: `${height}px` }}
        />
      ) : (
        <div style={{
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#A0A8C0',
          fontSize: '12px'
        }}>
          No data available
        </div>
      )}
    </div>
  );
}

export default Sparkline;
