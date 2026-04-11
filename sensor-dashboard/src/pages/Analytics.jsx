import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import api from '../services/api';
import './Analytics.css';

// Resolved colors for Plotly (Plotly cannot resolve CSS custom properties)
const PLOTLY_COLORS = {
  textPrimary: '#E8ECF5',
  textSecondary: '#A0A8C0',
  bgSecondary: '#1A1F3A',
  bgTertiary: '#252B4A',
  borderColor: 'rgba(160, 168, 192, 0.1)',
  line: '#4F7BFF',
  anomaly: '#FF4757',
  fontPrimary: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
};

/**
 * Analytics Page
 * Historical sensor data analysis with interactive charts
 */
function Analytics() {
  const [selectedSensor, setSelectedSensor] = useState(1);
  const [sensors, setSensors] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [resolution, setResolution] = useState('auto');
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [extrapolatedMode, setExtrapolatedMode] = useState(api.isMockMode());
  const [customRange, setCustomRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    loadSensors();
    loadAnomalies();
  }, []);

  useEffect(() => {
    if (selectedSensor) {
      loadHistoricalData();
      loadAnomalies();
    }
  }, [selectedSensor, timeRange, resolution]);

  const loadSensors = async () => {
    try {
      const response = await api.getSensorList();
      const sensorsData = response.sensors || [];
      const mappedSensors = sensorsData.map(sensor => ({
        ...sensor,
        id: sensor.sensor_id,
        // Normalize empty unit for IAQ Index
        unit: sensor.unit || (sensor.name === 'IAQ Index' ? 'index' : ''),
      }));
      setSensors(mappedSensors);
    } catch (error) {
      console.error('[Analytics] Error loading sensors:', error);
    }
  };

  const loadAnomalies = async () => {
    try {
      const response = await api.getAnomalies({ sensor_id: selectedSensor });
      setAnomalies(response.anomalies || []);
    } catch (error) {
      console.error('[Analytics] Error loading anomalies:', error);
    }
  };

  const toggleExtrapolatedMode = () => {
    const newMode = !extrapolatedMode;
    api.setMockMode(newMode);
    setExtrapolatedMode(newMode);
    setHistoricalData([]);
    setStats(null);
    setAnomalies([]);
    loadSensors();
    loadAnomalies();
    if (selectedSensor) {
      // Small delay to let mock mode settle
      setTimeout(() => loadHistoricalData(), 50);
    }
  };

  const refreshData = () => {
    loadHistoricalData();
    loadAnomalies();
  };

  const getSelectedSensorMeta = () => {
    return sensors.find(s => s.id === selectedSensor) || {};
  };

  const loadHistoricalData = async () => {
    setLoading(true);
    try {
      const endTime = new Date();
      const startTime = new Date();

      switch (timeRange) {
        case '1h':
          startTime.setHours(endTime.getHours() - 1);
          break;
        case '6h':
          startTime.setHours(endTime.getHours() - 6);
          break;
        case '24h':
          startTime.setHours(endTime.getHours() - 24);
          break;
        case '7d':
          startTime.setDate(endTime.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(endTime.getDate() - 30);
          break;
        case 'custom':
          if (customRange.start && customRange.end) {
            startTime.setTime(new Date(customRange.start).getTime());
            endTime.setTime(new Date(customRange.end).getTime());
          } else {
            setLoading(false);
            return;
          }
          break;
        default:
          startTime.setHours(endTime.getHours() - 1);
      }

      const params = {
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        resolution: resolution
      };

      const response = await api.getHistoricalData(selectedSensor, params);
      const data = response.data || [];
      setHistoricalData(data);

      if (data && data.length > 0) {
        const values = data.map(d => d.avg !== undefined ? d.avg : d.value);
        const statistics = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          count: data.length,
          std: calculateStd(values)
        };
        setStats(statistics);
      } else {
        setStats(null);
      }
    } catch (error) {
      console.error('[Analytics] Error loading historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStd = (values) => {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const getChartData = () => {
    if (!historicalData || historicalData.length === 0) return [];

    const timestamps = historicalData.map(d => d.timestamp);
    const values = historicalData.map(d => d.avg !== undefined ? d.avg : d.value);
    const mins = historicalData.map(d => d.min !== undefined ? d.min : d.value);
    const maxs = historicalData.map(d => d.max !== undefined ? d.max : d.value);

    const meta = getSelectedSensorMeta();

    const traces = [
      // Min trace first (bottom of the band)
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Min/Max Range',
        x: timestamps,
        y: mins,
        line: { color: 'rgba(160, 168, 192, 0.3)', width: 1 },
        hovertemplate: '<b>Min: %{y:,.2f}</b><extra></extra>',
        legendgroup: 'range',
      },
      // Max trace fills between Min (previous trace) and Max
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Max',
        x: timestamps,
        y: maxs,
        line: { color: 'rgba(160, 168, 192, 0.3)', width: 1 },
        fill: 'tonexty',
        fillcolor: 'rgba(79, 123, 255, 0.08)',
        hovertemplate: '<b>Max: %{y:,.2f}</b><extra></extra>',
        legendgroup: 'range',
        showlegend: false,
      },
      // Average on top (main line)
      {
        type: 'scattergl',
        mode: 'lines',
        name: `Average${meta.unit ? ` (${meta.unit})` : ''}`,
        x: timestamps,
        y: values,
        line: { color: PLOTLY_COLORS.line, width: 2 },
        hovertemplate: `<b>%{y:,.2f}${meta.unit ? ' ' + meta.unit : ''}</b><br>%{x|%Y-%m-%d %H:%M:%S}<extra></extra>`
      },
    ];

    // Add anomaly markers if any match the selected sensor and time range
    const sensorAnomalies = anomalies.filter(a => a.sensor_id === selectedSensor);
    if (sensorAnomalies.length > 0) {
      const chartStart = new Date(timestamps[0]).getTime();
      const chartEnd = new Date(timestamps[timestamps.length - 1]).getTime();
      const visibleAnomalies = sensorAnomalies.filter(a => {
        const t = new Date(a.timestamp).getTime();
        return t >= chartStart && t <= chartEnd;
      });

      if (visibleAnomalies.length > 0) {
        traces.push({
          type: 'scatter',
          mode: 'markers',
          name: 'Anomalies',
          x: visibleAnomalies.map(a => a.timestamp),
          y: visibleAnomalies.map(a => a.value),
          marker: {
            color: PLOTLY_COLORS.anomaly,
            size: 12,
            symbol: 'diamond',
            line: { color: '#fff', width: 1.5 }
          },
          hovertemplate: visibleAnomalies.map(a =>
            `<b>Anomaly: ${a.anomaly_type}</b><br>` +
            `Severity: ${a.severity}<br>` +
            `Value: ${a.value}${meta.unit ? ' ' + meta.unit : ''}<br>` +
            `${a.description || ''}<br>` +
            `%{x|%Y-%m-%d %H:%M:%S}<extra></extra>`
          ),
        });
      }
    }

    return traces;
  };

  const meta = getSelectedSensorMeta();

  const chartLayout = {
    title: {
      text: `${meta.name || `Sensor ${selectedSensor}`}${meta.sensor_model ? ` (${meta.sensor_model})` : ''} — Historical Data`,
      font: {
        color: PLOTLY_COLORS.textPrimary,
        size: 18,
        family: PLOTLY_COLORS.fontPrimary
      }
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: PLOTLY_COLORS.bgSecondary,
    xaxis: {
      title: { text: 'Time', font: { color: PLOTLY_COLORS.textSecondary } },
      gridcolor: PLOTLY_COLORS.borderColor,
      color: PLOTLY_COLORS.textSecondary,
      tickfont: { color: PLOTLY_COLORS.textSecondary }
    },
    yaxis: {
      title: { text: `${meta.name || 'Value'}${meta.unit ? ` (${meta.unit})` : ''}`, font: { color: PLOTLY_COLORS.textSecondary } },
      gridcolor: PLOTLY_COLORS.borderColor,
      color: PLOTLY_COLORS.textSecondary,
      tickfont: { color: PLOTLY_COLORS.textSecondary }
    },
    margin: { t: 60, b: 60, l: 80, r: 40 },
    hovermode: 'x unified',
    showlegend: true,
    legend: {
      font: { color: PLOTLY_COLORS.textSecondary },
      bgcolor: PLOTLY_COLORS.bgTertiary,
      bordercolor: PLOTLY_COLORS.borderColor,
      borderwidth: 1
    }
  };

  const chartConfig = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  };

  const exportCSV = () => {
    if (!historicalData || historicalData.length === 0) return;

    const headers = ['Timestamp', 'Value', 'Min', 'Max', 'Std', 'Count'];
    const rows = historicalData.map(d => [
      d.timestamp,
      d.avg ?? d.value,
      d.min ?? '',
      d.max ?? '',
      d.std ?? '',
      d.count ?? ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensor_${selectedSensor}_${meta.name || 'data'}_${timeRange}_${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!historicalData || historicalData.length === 0) return;

    const meta = getSelectedSensorMeta();
    const sensorName = meta.name || `Sensor ${selectedSensor}`;
    const unit = meta.unit || '';

    const rows = historicalData.map(d => `
      <tr>
        <td>${new Date(d.timestamp).toLocaleString()}</td>
        <td>${d.avg ?? d.value ?? ''}</td>
        <td>${d.min ?? ''}</td>
        <td>${d.max ?? ''}</td>
        <td>${d.std ?? ''}</td>
        <td>${d.count ?? ''}</td>
      </tr>
    `).join('');

    const statsHtml = stats ? `
      <div class="stats-section">
        <h2>Statistical Summary</h2>
        <table class="stats-table">
          <tr><td><strong>Minimum</strong></td><td>${stats.min.toFixed(2)}${unit ? ' ' + unit : ''}</td></tr>
          <tr><td><strong>Maximum</strong></td><td>${stats.max.toFixed(2)}${unit ? ' ' + unit : ''}</td></tr>
          <tr><td><strong>Average</strong></td><td>${stats.avg.toFixed(2)}${unit ? ' ' + unit : ''}</td></tr>
          <tr><td><strong>Std Dev</strong></td><td>${stats.std.toFixed(2)}${unit ? ' ' + unit : ''}</td></tr>
          <tr><td><strong>Data Points</strong></td><td>${stats.count.toLocaleString()}</td></tr>
        </table>
      </div>
    ` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${sensorName} - Sensor Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #1a1a2e; margin: 0; padding: 32px; }
          h1 { font-size: 24px; margin-bottom: 4px; color: #1a1a2e; }
          .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #333; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 24px; font-size: 13px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f4f4f8; font-weight: 600; }
          tr:nth-child(even) { background: #fafafe; }
          .stats-table { width: auto; }
          .stats-table td { border: none; padding: 4px 16px 4px 0; }
          .stats-section { margin-bottom: 24px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <h1>${sensorName}${meta.sensor_model ? ' (' + meta.sensor_model + ')' : ''}</h1>
        <p class="subtitle">Time Range: ${timeRange} | Resolution: ${resolution} | Exported: ${new Date().toLocaleString()}</p>
        ${statsHtml}
        <h2>Data Table</h2>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Value${unit ? ' (' + unit + ')' : ''}</th>
              <th>Min</th>
              <th>Max</th>
              <th>Std</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const formatStat = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (Math.abs(val) >= 1000) return Math.round(val).toLocaleString('en-US');
    if (Math.abs(val) < 1) return val.toFixed(4);
    return val.toFixed(2);
  };

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h1>Historical Analytics</h1>
          <p className="analytics-subtitle">Analyze sensor data trends and patterns</p>
        </div>
        <div className="analytics-header-actions">
          <button
            className={`data-mode-toggle ${extrapolatedMode ? 'extrapolated-active' : ''}`}
            onClick={toggleExtrapolatedMode}
          >
            {extrapolatedMode ? 'Extrapolated Data' : 'Live Data'}
          </button>
          <button className="export-btn" onClick={refreshData} disabled={loading}>
            Refresh
          </button>
          <button className="export-btn" onClick={exportCSV} disabled={!historicalData || historicalData.length === 0}>
            Export CSV
          </button>
          <button className="export-btn export-btn-pdf" onClick={exportPDF} disabled={!historicalData || historicalData.length === 0}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="analytics-controls">
        <div className="control-group">
          <label>Sensor</label>
          <select
            value={selectedSensor}
            onChange={(e) => setSelectedSensor(Number(e.target.value))}
          >
            {sensors.map(sensor => (
              <option key={sensor.id} value={sensor.id}>
                {sensor.name || `Sensor ${sensor.id}`} {sensor.unit ? `(${sensor.unit})` : ''} — {sensor.sensor_model || ''}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Time Range</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {timeRange === 'custom' && (
          <>
            <div className="control-group">
              <label>Start Time</label>
              <input
                type="datetime-local"
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="control-group">
              <label>End Time</label>
              <input
                type="datetime-local"
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <button className="apply-btn" onClick={loadHistoricalData}>
              Apply
            </button>
          </>
        )}

        <div className="control-group">
          <label>Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="1sec">1 Second</option>
            <option value="1min">1 Minute</option>
            <option value="1hour">1 Hour</option>
          </select>
        </div>
      </div>

      {sensors.length > 0 && (
        <div className="sensor-chips">
          {sensors.map(sensor => (
            <button
              key={sensor.id}
              className={`sensor-chip ${sensor.id === selectedSensor ? 'active' : ''}`}
              onClick={() => setSelectedSensor(sensor.id)}
            >
              {sensor.name || `Sensor ${sensor.id}`}
            </button>
          ))}
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Minimum</span>
            <span className="stat-value">{formatStat(stats.min)}{meta.unit ? ` ${meta.unit}` : ''}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Maximum</span>
            <span className="stat-value">{formatStat(stats.max)}{meta.unit ? ` ${meta.unit}` : ''}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Average</span>
            <span className="stat-value">{formatStat(stats.avg)}{meta.unit ? ` ${meta.unit}` : ''}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Std Dev</span>
            <span className="stat-value">{formatStat(stats.std)}{meta.unit ? ` ${meta.unit}` : ''}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Data Points</span>
            <span className="stat-value">{stats.count.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="chart-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading historical data...</p>
          </div>
        ) : historicalData && historicalData.length > 0 ? (
          <Plot
            data={getChartData()}
            layout={chartLayout}
            config={chartConfig}
            style={{ width: '100%', height: '600px' }}
          />
        ) : (
          <div className="empty-state">
            <p>No data available for the selected time range</p>
            <p className="empty-subtitle">Try selecting a different time range or sensor</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
