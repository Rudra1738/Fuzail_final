// Mock data for presentation screenshots
// This file provides hardcoded data showcasing varied sensor scenarios

// Generate timestamps for the last N seconds
const generateTimestamps = (count, intervalMs = 1000) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(now.getTime() - (count - 1 - i) * intervalMs);
    return timestamp.toISOString();
  });
};

// Generate timestamps for historical data
const generateHistoricalTimestamps = (hours, intervalMinutes = 1) => {
  const now = new Date();
  const count = (hours * 60) / intervalMinutes;
  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(now.getTime() - (count - 1 - i) * intervalMinutes * 60 * 1000);
    return timestamp.toISOString();
  });
};

// Sensor configurations with varied scenarios
const sensorConfigs = {
  1: { name: 'Temperature A', baseValue: 45, variance: 3, state: 'normal', color: '#10b981' },
  2: { name: 'Humidity B', baseValue: 52, variance: 4, state: 'normal', color: '#3b82f6' },
  3: { name: 'Pressure C', baseValue: 48, variance: 2, state: 'normal', color: '#8b5cf6' },
  4: { name: 'Temperature D', baseValue: 55, variance: 3.5, state: 'normal', color: '#ec4899' },
  5: { name: 'Air Quality E', baseValue: 42, variance: 5, state: 'normal', color: '#f59e0b' },
  6: { name: 'CO2 Level F', baseValue: 50, variance: 4, state: 'normal', color: '#06b6d4' },
  7: { name: 'Light Intensity G', baseValue: 58, variance: 3, state: 'normal', color: '#84cc16' },
  8: { name: 'Temperature H', baseValue: 75, variance: 2, state: 'warning', color: '#f59e0b' },
  9: { name: 'Humidity I', baseValue: 78, variance: 3, state: 'warning', color: '#f97316' },
  10: { name: 'Pressure J', baseValue: 88, variance: 4, state: 'critical', color: '#ef4444' },
  11: { name: 'Temperature K', baseValue: 12, variance: 2, state: 'critical', color: '#dc2626' },
  12: { name: 'Sensor L', baseValue: 0, variance: 0, state: 'dropout', color: '#6b7280' }
};

// Generate realistic sensor readings with slight variation
const generateReadings = (sensorId, count, intervalMs = 1000) => {
  const config = sensorConfigs[sensorId];
  const timestamps = generateTimestamps(count, intervalMs);

  if (config.state === 'dropout') {
    // No data for dropout scenario
    return [];
  }

  return timestamps.map((timestamp, i) => {
    // Add some sinusoidal variation for realism
    const sine = Math.sin(i / 10) * config.variance;
    const random = (Math.random() - 0.5) * config.variance;
    let value = config.baseValue + sine + random;

    // Add occasional spike for critical sensors
    if (config.state === 'critical' && Math.random() < 0.1) {
      value += (Math.random() - 0.5) * 10;
    }

    // Clamp values
    value = Math.max(0, Math.min(100, value));

    return {
      timestamp,
      value: parseFloat(value.toFixed(2))
    };
  });
};

// Generate historical data with aggregations
const generateHistoricalData = (sensorId, hours, intervalMinutes = 1) => {
  const config = sensorConfigs[sensorId];
  const timestamps = generateHistoricalTimestamps(hours, intervalMinutes);

  if (config.state === 'dropout') {
    // Sparse data for dropout scenario
    return timestamps.slice(0, 10).map(timestamp => ({
      timestamp,
      avg: 0,
      min: 0,
      max: 0,
      std: 0,
      count: 0
    }));
  }

  return timestamps.map((timestamp, i) => {
    const sine = Math.sin(i / 20) * config.variance * 2;
    const trend = (i / timestamps.length) * config.variance; // Slight upward trend
    const random = (Math.random() - 0.5) * config.variance;
    const avg = config.baseValue + sine + trend + random;

    const min = avg - config.variance * 0.8;
    const max = avg + config.variance * 0.8;
    const std = config.variance * 0.5;

    return {
      timestamp,
      avg: parseFloat(Math.max(0, Math.min(100, avg)).toFixed(2)),
      min: parseFloat(Math.max(0, Math.min(100, min)).toFixed(2)),
      max: parseFloat(Math.max(0, Math.min(100, max)).toFixed(2)),
      std: parseFloat(std.toFixed(2)),
      count: 60 // Assuming 60 readings per aggregation
    };
  });
};

// Mock sensor list
export const getMockSensorList = () => {
  return {
    sensors: Array.from({ length: 12 }, (_, i) => ({
      sensor_id: i + 1,
      name: sensorConfigs[i + 1].name,
      status: sensorConfigs[i + 1].state
    }))
  };
};

// Mock live data (last 60 seconds)
export const getMockLiveData = (sensorId) => {
  const config = sensorConfigs[sensorId];
  const data = generateReadings(sensorId, 60, 1000);

  return {
    sensor_id: sensorId,
    data: data,
    count: data.length,
    latest: data.length > 0 ? data[data.length - 1].value : null,
    status: config.state
  };
};

// Mock historical data
export const getMockHistoricalData = (sensorId, timeRange = '24h') => {
  // Parse time range
  let hours = 24;
  let intervalMinutes = 1;

  switch (timeRange) {
    case '1h':
      hours = 1;
      intervalMinutes = 1;
      break;
    case '6h':
      hours = 6;
      intervalMinutes = 1;
      break;
    case '24h':
      hours = 24;
      intervalMinutes = 5;
      break;
    case '7d':
      hours = 168;
      intervalMinutes = 60;
      break;
    case '30d':
      hours = 720;
      intervalMinutes = 240;
      break;
    default:
      hours = 24;
      intervalMinutes = 5;
  }

  const data = generateHistoricalData(sensorId, hours, intervalMinutes);

  return {
    sensor_id: sensorId,
    data: data,
    count: data.length,
    time_range: timeRange
  };
};

// Mock anomalies with varied types and severities
export const getMockAnomalies = () => {
  const now = new Date();

  return {
    anomalies: [
      {
        id: 1,
        sensor_id: 10,
        anomaly_type: 'spike',
        severity: 'high',
        value: 92.5,
        timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        expected_range_min: 40,
        expected_range_max: 60,
        description: 'Value exceeded 3 standard deviations from mean',
        acknowledged: false
      },
      {
        id: 2,
        sensor_id: 11,
        anomaly_type: 'out_of_range',
        severity: 'high',
        value: 8.3,
        timestamp: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
        expected_range_min: 40,
        expected_range_max: 60,
        description: 'Value below acceptable range',
        acknowledged: false
      },
      {
        id: 3,
        sensor_id: 12,
        anomaly_type: 'dropout',
        severity: 'high',
        value: null,
        timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
        expected_range_min: null,
        expected_range_max: null,
        description: 'No data received for more than 5 seconds',
        acknowledged: false
      },
      {
        id: 4,
        sensor_id: 8,
        anomaly_type: 'sudden_change',
        severity: 'medium',
        value: 78.2,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        expected_range_min: 40,
        expected_range_max: 60,
        description: 'Rapid change detected in sensor reading',
        acknowledged: true
      },
      {
        id: 5,
        sensor_id: 9,
        anomaly_type: 'out_of_range',
        severity: 'medium',
        value: 81.7,
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        expected_range_min: 40,
        expected_range_max: 60,
        description: 'Value approaching upper threshold',
        acknowledged: true
      }
    ],
    count: 5,
    unacknowledged_count: 3
  };
};

// Get latest value for a sensor (for gauge display)
export const getMockLatestValue = (sensorId) => {
  const config = sensorConfigs[sensorId];

  if (config.state === 'dropout') {
    return null;
  }

  // Add slight random variation to base value
  const random = (Math.random() - 0.5) * config.variance;
  let value = config.baseValue + random;

  // Clamp value
  value = Math.max(0, Math.min(100, value));

  return parseFloat(value.toFixed(2));
};

// Export all mock functions
export default {
  getMockSensorList,
  getMockLiveData,
  getMockHistoricalData,
  getMockAnomalies,
  getMockLatestValue,
  sensorConfigs
};
