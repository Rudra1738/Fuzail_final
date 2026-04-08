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
  const [customRange, setCustomRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    loadSensors();
  }, []);

  useEffect(() => {
    if (selectedSensor) {
      loadHistoricalData();
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

    return [
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
        <button className="export-btn" onClick={exportCSV} disabled={!historicalData || historicalData.length === 0}>
          Export CSV
        </button>
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
