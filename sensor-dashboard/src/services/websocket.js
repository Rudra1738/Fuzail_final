/**
 * WebSocket Service for Real-Time Sensor Data
 *
 * Manages WebSocket connection to Django Channels backend
 * Provides automatic reconnection, event handling, and data buffering
 */

// ============================================
// MOCK MODE - Disable WebSocket for screenshots
// Set to true to disable real-time updates (static data)
// Set to false to enable WebSocket connection
// ============================================
const MOCK_MODE = true;

const WS_URL = 'ws://localhost:8000/ws/sensors/';
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.listeners = new Map(); // Event listeners
    this.connected = false;
    this.intentionallyClosed = false;
    this.messageBuffer = []; // Buffer for recent messages
    this.maxBufferSize = 100;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (MOCK_MODE) {
      console.log('[WS] Mock mode enabled - WebSocket connection disabled');
      this.connected = false;
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[WS] Already connected or connecting');
      return;
    }

    this.intentionallyClosed = false;
    console.log(`[WS] Connecting to ${WS_URL}...`);

    try {
      this.ws = new WebSocket(WS_URL);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('[WS] Connected successfully');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', { timestamp: new Date() });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Message received:', data);

        // Add to buffer
        this.addToBuffer(data);

        // Emit to listeners
        this.emit('message', data);

        // Emit specific event types
        if (data.type === 'sensor_update') {
          this.emit('sensor_update', data.data);
        } else if (data.type === 'anomaly_detected') {
          this.emit('anomaly', data.data);
        }
      } catch (error) {
        console.error('[WS] Error parsing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = (event) => {
      console.log(`[WS] Connection closed (Code: ${event.code}, Reason: ${event.reason || 'None'})`);
      this.connected = false;
      this.emit('disconnected', { code: event.code, reason: event.reason });

      // Attempt reconnection if not intentionally closed
      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Schedule automatic reconnection
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[WS] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      this.emit('max_reconnect_attempts', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WS] Scheduling reconnection attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms`);

    this.reconnectTimer = setTimeout(() => {
      console.log(`[WS] Attempting reconnection (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      this.connect();
    }, RECONNECT_DELAY);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.intentionallyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      console.log('[WS] Disconnecting...');
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
  }

  /**
   * Send message to server
   * @param {Object} message - Message object to send
   */
  send(message) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot send message - not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log('[WS] Message sent:', message);
      return true;
    } catch (error) {
      console.error('[WS] Error sending message:', error);
      return false;
    }
  }

  /**
   * Subscribe to sensor updates for specific sensor
   * @param {number} sensorId - Sensor ID to subscribe to
   */
  subscribeSensor(sensorId) {
    this.send({
      type: 'subscribe',
      sensor_id: sensorId
    });
  }

  /**
   * Unsubscribe from sensor updates
   * @param {number} sensorId - Sensor ID to unsubscribe from
   */
  unsubscribeSensor(sensorId) {
    this.send({
      type: 'unsubscribe',
      sensor_id: sensorId
    });
  }

  /**
   * Request latest data for a sensor
   * @param {number} sensorId - Sensor ID
   */
  requestLatest(sensorId) {
    this.send({
      type: 'get_latest',
      sensor_id: sensorId
    });
  }

  /**
   * Add event listener
   * @param {string} event - Event name (connected, disconnected, message, sensor_update, anomaly, error)
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WS] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Add message to circular buffer
   * @param {*} message - Message to buffer
   */
  addToBuffer(message) {
    this.messageBuffer.push({
      timestamp: new Date(),
      data: message
    });

    // Maintain buffer size
    if (this.messageBuffer.length > this.maxBufferSize) {
      this.messageBuffer.shift();
    }
  }

  /**
   * Get buffered messages
   * @param {number} count - Number of messages to retrieve (default: all)
   * @returns {Array} - Buffered messages
   */
  getBufferedMessages(count = null) {
    if (count === null) {
      return [...this.messageBuffer];
    }
    return this.messageBuffer.slice(-count);
  }

  /**
   * Clear message buffer
   */
  clearBuffer() {
    this.messageBuffer = [];
  }

  /**
   * Get connection status
   * @returns {boolean} - True if connected
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   * @returns {string} - Connection state: 'connected', 'connecting', 'disconnected', 'error'
   */
  getConnectionState() {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'disconnecting';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
