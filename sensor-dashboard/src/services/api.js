import axios from 'axios';
import {
  getMockSensorList,
  getMockLiveData,
  getMockHistoricalData,
  getMockAnomalies
} from './mockData.js';

// ============================================
// MOCK DATA MODE - Toggle for screenshots
// Set to true to use hardcoded data for presentations
// Set to false to use real backend API
// ============================================
const USE_MOCK_DATA = false;

// API Base URL - change to your Django backend URL
const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method.toUpperCase()} ${config.url}`, config.data || '');
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response from ${response.config.url}:`, response.status);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('[API] Server error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[API] No response received:', error.request);
    } else {
      console.error('[API] Error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * API Service - All backend communication methods
 */
const api = {
  /**
   * Get list of all sensors
   * GET /api/sensors/list/
   */
  async getSensorList() {
    if (USE_MOCK_DATA) {
      console.log('[API] Using mock sensor list');
      return getMockSensorList();
    }

    try {
      const response = await apiClient.get('/sensors/list/');
      return response.data;
    } catch (error) {
      console.error('Error fetching sensor list:', error);
      throw error;
    }
  },

  /**
   * Ingest sensor readings (batch)
   * POST /api/sensors/ingest/
   * @param {Array} readings - Array of {sensor_id, timestamp, value}
   */
  async ingestReadings(readings) {
    try {
      const response = await apiClient.post('/sensors/ingest/', { readings });
      return response.data;
    } catch (error) {
      console.error('Error ingesting readings:', error);
      throw error;
    }
  },

  /**
   * Get live sensor data (last 60 seconds)
   * GET /api/sensors/{sensor_id}/live/
   * @param {number} sensorId - Sensor ID (1-12)
   */
  async getLiveSensorData(sensorId) {
    if (USE_MOCK_DATA) {
      console.log(`[API] Using mock live data for sensor ${sensorId}`);
      return getMockLiveData(sensorId);
    }

    try {
      const response = await apiClient.get(`/sensors/${sensorId}/live/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching live data for sensor ${sensorId}:`, error);
      throw error;
    }
  },

  /**
   * Get historical sensor data with auto-resolution
   * GET /api/sensors/{sensor_id}/history/
   * @param {number} sensorId - Sensor ID (1-12)
   * @param {Object} params - Query parameters
   * @param {string} params.start_time - ISO 8601 timestamp
   * @param {string} params.end_time - ISO 8601 timestamp
   * @param {string} [params.resolution='auto'] - '1sec', '1min', '1hour', or 'auto'
   */
  async getHistoricalData(sensorId, params) {
    if (USE_MOCK_DATA) {
      // Calculate time range from params if provided
      let timeRange = '24h'; // default
      if (params.start_time && params.end_time) {
        const start = new Date(params.start_time);
        const end = new Date(params.end_time);
        const diffHours = (end - start) / (1000 * 60 * 60);

        if (diffHours <= 1) timeRange = '1h';
        else if (diffHours <= 6) timeRange = '6h';
        else if (diffHours <= 24) timeRange = '24h';
        else if (diffHours <= 168) timeRange = '7d';
        else timeRange = '30d';
      }

      console.log(`[API] Using mock historical data for sensor ${sensorId} (${timeRange})`);
      return getMockHistoricalData(sensorId, timeRange);
    }

    try {
      const response = await apiClient.get(`/sensors/${sensorId}/history/`, { params });
      return response.data;
    } catch (error) {
      console.error(`Error fetching historical data for sensor ${sensorId}:`, error);
      throw error;
    }
  },

  /**
   * Get recent anomalies
   * GET /api/sensors/anomalies/
   * @param {Object} params - Query parameters
   * @param {number} [params.hours=24] - Number of hours to look back
   * @param {string} [params.severity] - Filter by severity: 'low', 'medium', 'high'
   * @param {number} [params.sensor_id] - Filter by sensor ID
   */
  async getAnomalies(params = {}) {
    if (USE_MOCK_DATA) {
      console.log('[API] Using mock anomalies');
      const mockData = getMockAnomalies();

      // Apply filters if provided
      if (params.severity || params.sensor_id) {
        let filtered = mockData.anomalies;

        if (params.severity) {
          filtered = filtered.filter(a => a.severity === params.severity);
        }

        if (params.sensor_id) {
          filtered = filtered.filter(a => a.sensor_id === params.sensor_id);
        }

        return {
          ...mockData,
          anomalies: filtered,
          count: filtered.length
        };
      }

      return mockData;
    }

    try {
      const response = await apiClient.get('/sensors/anomalies/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching anomalies:', error);
      throw error;
    }
  },

  /**
   * Health check - verify backend is reachable
   */
  async healthCheck() {
    if (USE_MOCK_DATA) {
      console.log('[API] Using mock mode - health check always returns true');
      return true;
    }

    try {
      const response = await apiClient.get('/sensors/list/');
      return response.status === 200;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  },
};

export default api;
