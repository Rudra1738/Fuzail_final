// Mock data based on real hardware readings (BME688, SEN50, BH1750FVI)
// Values extrapolated from actual Tera Term serial output

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

// Sensor configs based on actual hardware output and datasheets
// baseValue/variance from Tera Term screenshot, rangeMin/rangeMax from datasheets
const sensorConfigs = {
  1: { name: 'Light Intensity', model: 'BH1750FVI', unit: 'lx',    baseValue: 196,   variance: 2,    minClamp: 0,     maxClamp: 65535,  rangeMin: 0,     rangeMax: 65535  },
  2: { name: 'Temperature',     model: 'BME688',    unit: '°C',    baseValue: 24.5,  variance: 0.5,  minClamp: -40,   maxClamp: 85,     rangeMin: -40,   rangeMax: 85     },
  3: { name: 'Humidity',        model: 'BME688',    unit: '%RH',   baseValue: 24.2,  variance: 0.15, minClamp: 0,     maxClamp: 100,    rangeMin: 0,     rangeMax: 100    },
  4: { name: 'Pressure',        model: 'BME688',    unit: 'Pa',    baseValue: 30705, variance: 5,    minClamp: 30000, maxClamp: 110000, rangeMin: 30000, rangeMax: 110000 },
  5: { name: 'Gas Resistance',  model: 'BME688',    unit: 'Ω',     baseValue: 49800, variance: 1500, minClamp: 1000,  maxClamp: 500000, rangeMin: 1000,  rangeMax: 500000 },
  6: { name: 'IAQ Index',       model: 'BME688',    unit: '',      baseValue: 50,    variance: 0.5,  minClamp: 0,     maxClamp: 500,    rangeMin: 0,     rangeMax: 500    },
  7: { name: 'PM2.5',           model: 'SEN50',     unit: 'µg/m³', baseValue: 4,     variance: 4,    minClamp: 0,     maxClamp: 1000,   rangeMin: 0,     rangeMax: 1000   },
};

// Generate realistic sensor readings with slight variation
const generateReadings = (sensorId, count, intervalMs = 1000) => {
  const config = sensorConfigs[sensorId];
  if (!config) return [];
  const timestamps = generateTimestamps(count, intervalMs);

  return timestamps.map((timestamp, i) => {
    const sine = Math.sin(i / 10) * config.variance;
    const random = (Math.random() - 0.5) * config.variance;
    let value = config.baseValue + sine + random;

    // Occasional small spike on PM2.5
    if (sensorId === 7 && Math.random() < 0.05) {
      value += Math.random() * 10;
    }

    value = Math.max(config.minClamp, Math.min(config.maxClamp, value));

    return {
      timestamp,
      value: parseFloat(value.toFixed(2))
    };
  });
};

// Generate historical data with aggregations
const generateHistoricalData = (sensorId, hours, intervalMinutes = 1) => {
  const config = sensorConfigs[sensorId];
  if (!config) return [];
  const timestamps = generateHistoricalTimestamps(hours, intervalMinutes);

  return timestamps.map((timestamp, i) => {
    const sine = Math.sin(i / 20) * config.variance * 2;
    const trend = (i / timestamps.length) * config.variance;
    const random = (Math.random() - 0.5) * config.variance;
    const avg = config.baseValue + sine + trend + random;

    const min = avg - config.variance * 0.8;
    const max = avg + config.variance * 0.8;
    const std = config.variance * 0.5;

    return {
      timestamp,
      avg: parseFloat(Math.max(config.minClamp, Math.min(config.maxClamp, avg)).toFixed(2)),
      min: parseFloat(Math.max(config.minClamp, Math.min(config.maxClamp, min)).toFixed(2)),
      max: parseFloat(Math.max(config.minClamp, Math.min(config.maxClamp, max)).toFixed(2)),
      std: parseFloat(std.toFixed(2)),
      count: 60
    };
  });
};

// Mock sensor list
export const getMockSensorList = () => {
  const ids = Object.keys(sensorConfigs).map(Number).sort((a, b) => a - b);
  return {
    sensors: ids.map(id => ({
      sensor_id: id,
      name: sensorConfigs[id].name,
      sensor_model: sensorConfigs[id].model,
      unit: sensorConfigs[id].unit,
      range_min: sensorConfigs[id].rangeMin,
      range_max: sensorConfigs[id].rangeMax,
      status: 'online',
      last_value: sensorConfigs[id].baseValue,
      last_reading_time: new Date().toISOString(),
    }))
  };
};

// Rolling buffers for continuous mock data (one per sensor)
const liveBuffers = {};
let mockTick = 0;

// Generate a single new value for a sensor using smooth drift
const generateNextValue = (sensorId) => {
  const config = sensorConfigs[sensorId];
  if (!config) return 0;
  const sine = Math.sin(mockTick / 15 + sensorId) * config.variance;
  const random = (Math.random() - 0.5) * config.variance * 0.5;
  let value = config.baseValue + sine + random;

  // Occasional PM2.5 spike
  if (sensorId === 7 && Math.random() < 0.03) {
    value += Math.random() * 15;
  }

  return parseFloat(Math.max(config.minClamp, Math.min(config.maxClamp, value)).toFixed(2));
};

// Mock live data — maintains a rolling buffer per sensor, appends a new point each call
export const getMockLiveData = (sensorId) => {
  const config = sensorConfigs[sensorId];
  if (!config) return { sensor_id: sensorId, data: [], count: 0, latest: null, status: 'offline' };

  // Initialize buffer with historical data on first call
  if (!liveBuffers[sensorId]) {
    liveBuffers[sensorId] = generateReadings(sensorId, 59, 1000);
  }

  mockTick++;

  // Append a new data point
  const newValue = generateNextValue(sensorId);
  liveBuffers[sensorId].push({
    timestamp: new Date().toISOString(),
    value: newValue,
  });

  // Keep only the last 60 points
  if (liveBuffers[sensorId].length > 60) {
    liveBuffers[sensorId] = liveBuffers[sensorId].slice(-60);
  }

  const data = liveBuffers[sensorId];

  return {
    sensor_id: sensorId,
    data: data,
    count: data.length,
    latest: data[data.length - 1].value,
    status: 'online'
  };
};

// Reset buffers when switching modes
export const resetMockBuffers = () => {
  Object.keys(liveBuffers).forEach(k => delete liveBuffers[k]);
  mockTick = 0;
};

// Mock historical data
export const getMockHistoricalData = (sensorId, timeRange = '24h') => {
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

// Mock anomalies based on realistic sensor values
export const getMockAnomalies = () => {
  const now = new Date();

  return {
    anomalies: [
      {
        id: 1,
        sensor_id: 7,
        anomaly_type: 'spike',
        severity: 'high',
        value: 42.8,
        timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        expected_range_min: 0,
        expected_range_max: 12,
        description: 'PM2.5 spike detected — value exceeded 3 standard deviations from mean',
        acknowledged: false
      },
      {
        id: 2,
        sensor_id: 5,
        anomaly_type: 'spike',
        severity: 'medium',
        value: 32100,
        timestamp: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
        expected_range_min: 45000,
        expected_range_max: 54000,
        description: 'Gas resistance dropped sharply — possible air quality event',
        acknowledged: false
      },
      {
        id: 3,
        sensor_id: 2,
        anomaly_type: 'out_of_range',
        severity: 'medium',
        value: 28.4,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        expected_range_min: 23.5,
        expected_range_max: 25.5,
        description: 'Temperature above normal indoor range',
        acknowledged: true
      },
      {
        id: 4,
        sensor_id: 1,
        anomaly_type: 'spike',
        severity: 'low',
        value: 3200,
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        expected_range_min: 150,
        expected_range_max: 250,
        description: 'Sudden light intensity increase — direct sunlight exposure',
        acknowledged: true
      }
    ],
    count: 4,
    unacknowledged_count: 2
  };
};

// Get latest value for a sensor
export const getMockLatestValue = (sensorId) => {
  const config = sensorConfigs[sensorId];
  if (!config) return null;

  const random = (Math.random() - 0.5) * config.variance;
  let value = config.baseValue + random;
  value = Math.max(config.minClamp, Math.min(config.maxClamp, value));

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
