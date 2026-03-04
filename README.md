# Environmental Sensor Monitoring System

A real-time sensor monitoring dashboard for 12 environmental sensors streaming data at 60Hz.

## System Overview

**Complete Stack:**
- **Backend:** Django REST Framework + Django Channels + WebSockets
- **Frontend:** React (Vite) + Plotly.js
- **Database:** SQLite (development) → PostgreSQL (production)
- **Task Queue:** Celery + Redis
- **Real-time:** WebSockets via Django Channels

**Data Flow:**
```
Raspberry Pi (60Hz × 12 sensors)
    ↓ HTTP POST batches
Django REST API (bulk insert)
    ↓
SQLite Database (raw 60Hz data)
    ↓ Celery tasks (aggregation)
1-sec, 1-min, 1-hour summaries
    ↓ WebSocket broadcast
React Dashboard (real-time updates)
```

## Features Implemented

### ✅ Backend (100% Complete)

**Database Models:**
- `SensorReading` - Raw 60Hz data (7-day retention)
- `SensorAggregated1Sec` - 1-second summaries (30-day retention)
- `SensorAggregated1Min` - 1-minute summaries (1-year retention)
- `SensorAggregated1Hour` - 1-hour summaries (permanent)
- `Anomaly` - Anomaly detection and tracking

**REST API Endpoints:**
- `POST /api/sensors/ingest/` - Batch insert sensor readings
- `GET /api/sensors/list/` - List all 12 sensors with status
- `GET /api/sensors/{id}/live/` - Last 60 seconds of data
- `GET /api/sensors/{id}/history/` - Historical data (auto-aggregation)
- `GET /api/sensors/anomalies/` - Anomaly alerts

**WebSocket:**
- `ws://localhost:8000/ws/sensors/` - Real-time sensor data stream

**Celery Tasks (Automated):**
- `aggregate_1sec_data` - Runs every 1 second
- `aggregate_1min_data` - Runs every 1 minute
- `aggregate_1hour_data` - Runs every 1 hour
- `cleanup_old_readings` - Runs daily at 2 AM
- `detect_anomalies` - Statistical anomaly detection
- `check_sensor_dropouts` - Monitor sensor connectivity

**Management Commands:**
- `python manage.py seed_sensors` - Generate historical test data
- `python manage.py simulate_sensor_stream` - Simulate 60Hz sensor stream
- `python manage.py cleanup_old_readings` - Manual data cleanup

### ⏳ Frontend (In Progress)

**Completed:**
- ✅ React app with Vite
- ✅ Design system implementation (dark theme)
- ✅ CSS variables and styling foundation
- ✅ Dependencies installed (Plotly, Axios, React Router)

**TODO:**
- API service layer and state management
- Component library (SensorCard, Charts, Badges)
- Live Dashboard page (12 sensors + sparklines)
- Historical Analytics page (Plotly charts + filters)
- WebSocket integration for real-time updates

---

## Quick Start Guide

### 🚀 One-Click Setup (Recommended)

For the fastest setup experience, use the automated scripts:

1. **First time setup:** Double-click `setup.bat`
   - Creates virtual environment
   - Installs all dependencies
   - Sets up database
   - Creates admin user
   - Seeds test data

2. **Daily usage:** Double-click `start.bat`
   - Starts Django backend
   - Starts React frontend
   - Opens both in separate windows

3. **Stop servers:** Double-click `stop.bat`

📖 **Detailed instructions:** See [QUICK_START.md](QUICK_START.md)

### Manual Setup (Advanced)

If you prefer manual control:

**Prerequisites:**
- Python 3.13+
- Node.js 22+
- Redis server (for Celery and Channels)

### Installation

**1. Backend Setup**

```bash
# Activate virtual environment (already created)
venv\Scripts\activate

# Migrations are already run, database is ready
# Create a superuser for Django admin
python manage.py createsuperuser
```

**2. Frontend Setup**

```bash
cd sensor-dashboard
# Dependencies already installed
# Ready to run
```

**3. Install Redis** (Windows)

Download and run Redis from: https://github.com/microsoftarchive/redis/releases
Or use Docker:
```bash
docker run -d -p 6379:6379 redis:latest
```

---

## Running the Application

You need to run **5 services concurrently** (use 5 terminal windows):

### Terminal 1: Django Backend

```bash
venv\Scripts\activate
python manage.py runserver
```
→ API available at http://localhost:8000

### Terminal 2: Celery Worker

```bash
venv\Scripts\activate
celery -A sensor_backend worker -l info
```
→ Processes aggregation tasks

### Terminal 3: Celery Beat (Scheduler)

```bash
venv\Scripts\activate
celery -A sensor_backend beat -l info
```
→ Triggers periodic aggregation tasks

### Terminal 4: React Frontend

```bash
cd sensor-dashboard
npm run dev
```
→ Dashboard available at http://localhost:5173

### Terminal 5: Sensor Simulator (for testing)

```bash
venv\Scripts\activate
python manage.py simulate_sensor_stream --duration 300
```
→ Simulates 12 sensors sending 60Hz data for 5 minutes

---

## Testing the System

### Step 1: Seed Historical Data

```bash
# Generate 24 hours of historical data for all 12 sensors
python manage.py seed_sensors --hours 24 --frequency 1
```

### Step 2: Start the Simulator

```bash
# Simulate live 60Hz data stream
python manage.py simulate_sensor_stream --duration 300
```

You should see output like:
```
[5.0s] Sent 3600 readings (720.0 readings/sec) - Errors: 0
```

### Step 3: Check the Admin Panel

Visit http://localhost:8000/admin and log in to see:
- Raw sensor readings
- Aggregated data (1-sec, 1-min, 1-hour)
- Detected anomalies

### Step 4: Test API Endpoints

```bash
# Get list of all sensors
curl http://localhost:8000/api/sensors/list/

# Get live data for sensor 1
curl http://localhost:8000/api/sensors/1/live/

# Get historical data
curl "http://localhost:8000/api/sensors/1/history/?start_time=2025-01-01T00:00:00Z&end_time=2025-01-02T00:00:00Z"

# Get anomalies
curl http://localhost:8000/api/sensors/anomalies/
```

### Step 5: Test WebSocket Connection

Use a WebSocket client or browser console:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/sensors/');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'get_latest' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

---

## API Documentation

### Ingest Sensor Data

**Endpoint:** `POST /api/sensors/ingest/`

**Request Body:**
```json
[
  {
    "sensor_id": 1,
    "timestamp": "2025-01-15T12:00:00Z",
    "value": 45.67
  },
  {
    "sensor_id": 2,
    "timestamp": "2025-01-15T12:00:00Z",
    "value": 52.34
  }
]
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "message": "Successfully inserted 2 sensor readings"
}
```

### Get Live Data

**Endpoint:** `GET /api/sensors/{sensor_id}/live/`

**Response:**
```json
{
  "sensor_id": 1,
  "data": [
    {
      "id": 123,
      "sensor_id": 1,
      "timestamp": "2025-01-15T12:00:00Z",
      "avg": 45.67,
      "min": 44.50,
      "max": 46.80,
      "std": 0.65,
      "count": 60
    }
  ],
  "count": 60
}
```

### Get Historical Data

**Endpoint:** `GET /api/sensors/{sensor_id}/history/?start_time=...&end_time=...&resolution=auto`

**Query Parameters:**
- `start_time` (required): ISO datetime
- `end_time` (required): ISO datetime
- `resolution` (optional): `auto`, `1sec`, `1min`, `1hour`

**Auto-resolution logic:**
- ≤1 hour → use 1-second aggregations
- ≤24 hours → use 1-minute aggregations
- >24 hours → use 1-hour aggregations

---

## Database Schema

```sql
-- Raw sensor readings (60Hz data)
CREATE TABLE sensor_readings (
    id INTEGER PRIMARY KEY,
    sensor_id INTEGER,
    timestamp DATETIME,
    value REAL,
    created_at DATETIME,
    INDEX (sensor_id, timestamp),
    INDEX (timestamp)
);

-- 1-second aggregations
CREATE TABLE sensor_aggregated_1sec (
    id INTEGER PRIMARY KEY,
    sensor_id INTEGER,
    timestamp DATETIME,
    avg REAL,
    min REAL,
    max REAL,
    std REAL,
    count INTEGER,
    created_at DATETIME,
    UNIQUE (sensor_id, timestamp)
);

-- Anomalies
CREATE TABLE anomalies (
    id INTEGER PRIMARY KEY,
    sensor_id INTEGER,
    timestamp DATETIME,
    anomaly_type VARCHAR(20),  -- spike, dropout, out_of_range
    severity VARCHAR(10),       -- low, medium, high
    value REAL,
    expected_range_min REAL,
    expected_range_max REAL,
    description TEXT,
    acknowledged BOOLEAN,
    created_at DATETIME
);
```

---

## Anomaly Detection

The system uses statistical methods to detect anomalies:

**Spike Detection:**
- Calculate rolling mean and std dev (last 10 minutes)
- Flag if value > 3 standard deviations from mean
- Severity:
  - Medium: 3-5 std devs
  - High: >5 std devs

**Dropout Detection:**
- Check if no data received for >5 seconds
- Create high severity anomaly

**Out of Range:**
- Check against sensor-specific min/max thresholds
- Default range: 0-100

---

## Performance Metrics

**Data Volume:**
- Raw data: 8,640 readings/second (12 sensors × 60Hz × 12 values)
- Batch size: 6 readings per sensor (100ms batches)
- Request rate: ~120 HTTP POST requests/second
- Database writes: Bulk insert ~72 readings per request

**Retention Policies:**
- Raw data: 7 days (~5.2 million readings)
- 1-sec aggregations: 30 days (~31 million records)
- 1-min aggregations: 1 year (~6.3 million records)
- 1-hour aggregations: Forever

**Database Size Estimates:**
- Raw data (7 days): ~200 MB
- 1-sec agg (30 days): ~1.2 GB
- 1-min agg (1 year): ~250 MB

---

## Next Steps

**Frontend Development (TODO):**
1. Create API service layer (`src/services/api.js`)
2. Build component library:
   - `SensorCard` - Display sensor with gauge and sparkline
   - `SensorGauge` - Circular gauge component
   - `LiveChart` - Real-time sparkline chart
   - `HistoricalChart` - Large Plotly chart
   - `AnomalyAlert` - Alert panel
3. Implement routing:
   - `/` → Live Dashboard (12 sensors)
   - `/analytics` → Historical Analytics
4. Add WebSocket integration for real-time updates
5. Implement state management (React Context)
6. Build data export (CSV)

**Backend Enhancements (Optional):**
- Migrate to PostgreSQL for production
- Add user authentication
- Implement configurable alerting (email/SMS)
- Add ML-based anomaly detection
- Create mobile app

---

## Troubleshooting

**Redis Connection Error:**
```
Error: No connection could be made because the target machine actively refused it
```
→ Make sure Redis is running: `redis-server` or start Docker container

**Celery Not Running:**
```
WARNING: No nodes replied within time constraint
```
→ Start Celery worker in a separate terminal

**No Data in Dashboard:**
- Run the seed command: `python manage.py seed_sensors --hours 24`
- Start the simulator: `python manage.py simulate_sensor_stream --duration 300`

**WebSocket Connection Failed:**
- Check that Daphne/Django Channels is running
- Verify Redis is running
- Check browser console for errors

---

## Architecture Diagram

```
┌─────────────────┐
│  Raspberry Pi   │
│  (12 sensors    │
│   @ 60Hz each)  │
└────────┬────────┘
         │ HTTP POST (batches)
         ↓
┌─────────────────────────────────┐
│     Django REST API             │
│  /api/sensors/ingest/           │
└────────┬────────────────────────┘
         │ Bulk Insert
         ↓
┌─────────────────────────────────┐
│     SQLite Database             │
│  • sensor_readings (raw 60Hz)   │
│  • sensor_aggregated_*          │
│  • anomalies                    │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│   Celery (Redis broker)         │
│  • aggregate_1sec_data (1s)     │
│  • aggregate_1min_data (1min)   │
│  • aggregate_1hour_data (1hr)   │
│  • detect_anomalies             │
│  • cleanup_old_readings         │
└────────┬────────────────────────┘
         │ Broadcast
         ↓
┌─────────────────────────────────┐
│  Django Channels (WebSockets)   │
│  ws://host/ws/sensors/          │
└────────┬────────────────────────┘
         │ Real-time stream
         ↓
┌─────────────────────────────────┐
│   React Frontend (Plotly.js)    │
│  • Live Dashboard (12 sensors)  │
│  • Historical Analytics         │
│  • Anomaly Alerts               │
└─────────────────────────────────┘
```

---

## Project Status

**Phase 1: Backend** ✅ **100% Complete**
- Database models and migrations
- REST API endpoints
- Celery tasks and aggregation
- WebSocket consumers
- Anomaly detection
- Management commands

**Phase 2: Frontend** ⏳ **20% Complete**
- Design system implemented
- Dependencies installed
- TODO: Components, routing, WebSocket integration

**Phase 3: Testing** ⏳ **Pending**
- Unit tests for aggregation logic
- Integration tests for API endpoints
- Load testing with simulator
- WebSocket connection stability tests

**Phase 4: Deployment** ⏳ **Pending**
- PostgreSQL migration
- Production settings
- Docker containerization
- Nginx configuration

---

## License

This project is for environmental sensor monitoring and preventative measures.

## Support

For issues or questions, check:
1. Django admin panel: http://localhost:8000/admin
2. API documentation above
3. Check all 5 services are running (Django, Celery worker, Celery beat, Redis, Frontend)
4. Review logs in terminal outputs
