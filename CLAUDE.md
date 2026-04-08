# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a remote environmental sensor monitoring system designed for preventative measures. The system consists of:

- 12 individual environmental sensors providing readings at ~60Hz (60 readings per second)
- Raspberry Pi transmitter running a Python script for continuous data transmission
- Django REST API backend for data ingestion and processing
- React frontend dashboard for real-time visualization and historical analysis
- Anomaly detection and alerting system

**Total Data Volume:** ~8,640 sensor readings per second (12 sensors � 60Hz � 12 values)

## Technology Stack

### Backend
- **Framework:** Django 4.x with Django REST Framework
- **Database:** SQLite (development) � PostgreSQL (production)
- **Real-time:** Django Channels with WebSockets
- **Time-series:** Standard Django ORM with custom aggregation logic

### Frontend
- **Framework:** React (create-react-app or Vite)
- **Charting:** Plotly.js for interactive, scientific-grade visualizations
- **State Management:** React Context/Redux for real-time data streams
- **Real-time:** WebSocket client for live sensor data

### Deployment
- **Development:** Django dev server + React dev server
- **Production:** Gunicorn/uWSGI + Nginx + PostgreSQL

## Architecture Overview

### Data Flow Pipeline

```
Raspberry Pi (Python script)
    � (HTTP POST every 100ms with 6-reading batch)
Django REST API (/api/sensors/ingest/)
    �
Raw Sensor Data Table (60Hz data, 7-day retention)
    � (Aggregation worker/Celery task)
Aggregated Data Tables (1-sec, 1-min, 1-hour summaries)
    � (WebSocket broadcast)
React Dashboard (real-time updates)
```

### Database Schema Design

**Key Models:**

1. **SensorReading** (raw 60Hz data)
   - sensor_id (1-12)
   - timestamp (microsecond precision)
   - value (float)
   - Retention: 7 days, then auto-delete
   - Indexed on: timestamp, sensor_id

2. **SensorAggregated1Sec** (1-second summaries)
   - sensor_id
   - timestamp (second precision)
   - avg, min, max, std, count
   - Retention: 30 days

3. **SensorAggregated1Min** (1-minute summaries)
   - Same fields as above
   - Retention: 1 year

4. **SensorAggregated1Hour** (1-hour summaries)
   - Same fields as above
   - Retention: Forever

5. **Anomaly**
   - sensor_id
   - timestamp
   - anomaly_type (spike, dropout, out_of_range)
   - severity (low, medium, high)
   - value

### API Endpoints

**Data Ingestion:**
- `POST /api/sensors/ingest/` - Batch insert sensor readings (Raspberry Pi)

**Data Retrieval:**
- `GET /api/sensors/{sensor_id}/live/` - Last 60 seconds of data
- `GET /api/sensors/{sensor_id}/history/` - Historical data (auto-selects aggregation level)
- `GET /api/sensors/anomalies/` - Recent anomalies

**WebSocket:**
- `ws://host/ws/sensors/` - Real-time sensor data stream

## Development Commands

### Initial Setup

```bash
# Backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

pip install django djangorestframework django-channels channels-redis celery

django-admin startproject sensor_backend .
python manage.py startapp sensors
python manage.py migrate
python manage.py createsuperuser

# Frontend
npx create-react-app sensor-dashboard
cd sensor-dashboard
npm install plotly.js react-plotly.js axios
```

### Running the Application

```bash
# Backend (Terminal 1)
python manage.py runserver

# Celery worker for aggregation (Terminal 2)
celery -A sensor_backend worker -l info

# Frontend (Terminal 3)
cd sensor-dashboard
npm start

# Redis for Channels (Terminal 4)
redis-server
```

### Testing with Mock Data

```bash
# Seed database with mock sensor data
python manage.py seed_sensors --hours 24 --frequency 60

# Simulate live 60Hz sensor stream
python manage.py simulate_sensor_stream --sensor-id 1 --duration 60
```

### Database Operations

```bash
# Run migrations
python manage.py makemigrations
python manage.py migrate

# Run aggregation manually (normally runs via Celery)
python manage.py aggregate_sensor_data --interval 1sec

# Clean up old raw data (>7 days)
python manage.py cleanup_old_readings
```

## Key Implementation Strategies

### 1. Handling 60Hz Data Ingestion

**Problem:** 8,640 individual INSERT statements per second is too slow.

**Solution:** Batch insertion on Raspberry Pi
- Collect 6 readings (100ms worth) per sensor
- Send batch POST request every 100ms
- Use `bulk_create()` in Django for efficient insertion
- Results in ~120 requests/sec instead of 8,640

```python
# Raspberry Pi code pattern
batch = []
for sensor in sensors:
    batch.append({
        'sensor_id': sensor.id,
        'timestamp': time.time(),
        'value': sensor.read()
    })
    if len(batch) >= 72:  # 12 sensors � 6 readings
        requests.post(API_URL, json=batch)
        batch = []
```

### 2. Data Aggregation Strategy

- **Celery Beat** runs aggregation tasks every second
- Aggregates last second of raw data into 1-sec summaries
- Every minute, aggregates 1-sec data into 1-min summaries
- Every hour, aggregates 1-min data into 1-hour summaries
- Uses SQL window functions for efficiency

### 3. Anomaly Detection

Implement simple statistical anomaly detection:
- Calculate rolling mean and std (last 10 minutes)
- Flag values > 3 standard deviations from mean
- Detect dropouts (no data for >5 seconds)
- Check against sensor-specific min/max thresholds

### 4. WebSocket Real-Time Updates

- Frontend subscribes to WebSocket on mount
- Backend broadcasts aggregated 1-second data (not raw 60Hz)
- Frontend updates charts with new data point every second
- Use circular buffer in React (keep last 60 seconds in memory)

### 5. Chart Performance Optimization

**Plotly Configuration:**
```javascript
// For real-time charts, use Plotly.react() not Plotly.newPlot()
Plotly.react('chart', data, layout, {
  responsive: true,
  displayModeBar: false
});

// For historical charts with lots of data, use scattergl (WebGL)
{
  type: 'scattergl',
  mode: 'lines',
  // ... data
}
```

### 6. Frontend Page Structure

**Page 1: Live Dashboard** (`/dashboard`)
- 12 gauge/indicator components (one per sensor)
- Small sparkline charts (last 60 seconds)
- Anomaly alert panel
- Auto-updates via WebSocket

**Page 2: Historical Analytics** (`/analytics`)
- Sensor selector
- Date/time range picker
- Large Plotly line charts with zoom/pan
- Statistical summary cards (min, max, avg, std)
- Anomaly timeline
- CSV export functionality

## Database Migration Path (SQLite � PostgreSQL)

When ready to move to production:

1. Install PostgreSQL and update `settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'sensor_db',
        'USER': 'sensor_user',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

2. Export existing data:
```bash
python manage.py dumpdata > data.json
```

3. Run migrations on PostgreSQL and import:
```bash
python manage.py migrate
python manage.py loaddata data.json
```

4. Add indexes for performance:
```python
# In models.py
class Meta:
    indexes = [
        models.Index(fields=['sensor_id', '-timestamp']),
        models.Index(fields=['timestamp']),
    ]
```

## Testing Approach

### Unit Tests
- Test data aggregation logic (ensure accurate mean/std calculations)
- Test anomaly detection algorithms
- Test batch insertion performance

### Integration Tests
- Test full data pipeline (ingest � aggregate � retrieve)
- Test WebSocket connections and broadcasting
- Test API endpoints with realistic data volumes

### Load Testing
- Simulate 60Hz data stream for extended periods
- Monitor database performance and query times
- Test frontend performance with large datasets

### Mock Sensor Simulator
Create management command to simulate all 12 sensors:
```bash
python manage.py simulate_all_sensors --duration 3600  # 1 hour
```

## Design Principles

Refer to `context/design-principles.md` for comprehensive UI/UX guidelines. Key points for this project:

- **Data Visualization:** Use clear, accessible color schemes for charts
- **Real-time Feedback:** Provide visual confirmation when data is updating
- **Accessibility:** Ensure charts have proper ARIA labels and keyboard navigation
- **Responsive Design:** Dashboard must work on tablets for field monitoring
- **Error States:** Clear messaging when WebSocket disconnects or sensors fail

## Visual Development Guidelines

### Design Resources
- **Comprehensive design checklist:** `context/design-principles.md`
- **Brand style guide:** `context/style-guide.md` (if available)
- When making visual (front-end, UI/UX) changes, **always refer to these files for guidance**

### Quick Visual Check
**IMMEDIATELY after implementing any front-end change:**

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `context/design-principles.md` and `context/style-guide.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review
Invoke the design-review agent for thorough design validation when:

- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing

**Example usage:**
```bash
# After making significant frontend changes
# Use Claude Code's Task tool with subagent_type=design-review
```

The design-review agent will verify:
- Visual consistency with design system
- Accessibility compliance (WCAG standards)
- Responsive design across viewports
- User experience quality
- Performance of UI interactions

## Performance Considerations

- **Database:** Add indexes on timestamp and sensor_id columns
- **API:** Implement pagination for historical queries
- **Frontend:** Use React.memo() to prevent unnecessary re-renders
- **WebSocket:** Throttle updates to 1Hz instead of 60Hz on frontend
- **Caching:** Use Redis for frequently accessed aggregated data

## Common Issues & Solutions

**Issue:** Database locks with high write volume
- **Solution:** Use PostgreSQL with proper connection pooling

**Issue:** Frontend becomes sluggish with too much data
- **Solution:** Limit live dashboard to last 60 seconds, use virtualization for tables

**Issue:** WebSocket disconnects frequently
- **Solution:** Implement automatic reconnection with exponential backoff

**Issue:** Anomaly detection has too many false positives
- **Solution:** Tune thresholds per sensor type, implement cooldown periods

## Future Enhancements

- Add user authentication and multi-tenancy
- Implement configurable alerting (email/SMS when anomaly detected)
- Add ML-based anomaly detection (LSTM/Prophet)
- Create mobile app for remote monitoring
- Add sensor calibration and maintenance tracking
- Implement data export in multiple formats (CSV, JSON, Parquet)
