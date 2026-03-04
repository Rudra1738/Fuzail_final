# Fuzail — Environmental Sensor Monitoring System

A full-stack real-time dashboard for monitoring 12 environmental sensors across 5 physical sensor modules. Built with Django REST Framework and React + Plotly.js.

## Sensors

The system reads from **5 physical sensors** producing **12 data channels**:

| # | Channel | Sensor | Unit | Range |
|---|---------|--------|------|-------|
| 1 | Light Intensity | BH1750FVI | lx | 0 – 65,535 |
| 2 | Temperature | BME688 | °C | -40 – 85 |
| 3 | Humidity | BME688 | %RH | 0 – 100 |
| 4 | Pressure | BME688 | Pa | 30,000 – 110,000 |
| 5 | Gas Resistance | BME688 | Ω | 1,000 – 500,000 |
| 6 | IAQ Index | BME688 | index | 0 – 500 |
| 7 | CO | MiCS-6814 | ppm | 0 – 1,000 |
| 8 | NO₂ | MiCS-6814 | ppm | 0 – 10 |
| 9 | NH₃ | MiCS-6814 | ppm | 0 – 300 |
| 10 | TVOC | ZMOD4410 | ppb | 0 – 5,000 |
| 11 | eCO₂ | ZMOD4410 | ppm | 400 – 5,000 |
| 12 | PM2.5 | SEN5x | µg/m³ | 0 – 1,000 |

All ranges and units are derived from the manufacturer datasheets (included in `sensor_schematics/`).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5 + Django REST Framework |
| Frontend | React 19 (Vite) + Plotly.js |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Real-time | API polling (2s interval) + WebSocket infrastructure |
| Task Queue | Celery + Redis (for production aggregation) |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### One-Click Setup (Windows)

```
setup.bat      # First-time: venv, dependencies, migrations, data load
start.bat      # Start Django + React dev servers
stop.bat       # Stop both servers
```

### Manual Setup

```bash
# Backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
python manage.py makemigrations sensors
python manage.py migrate
python manage.py load_csv_data --clear
python manage.py createsuperuser

# Frontend
cd sensor-dashboard
npm install
```

### Running

```bash
# Terminal 1 — Backend (http://localhost:8000)
venv\Scripts\activate
python manage.py runserver

# Terminal 2 — Frontend (http://localhost:5173)
cd sensor-dashboard
npm run dev
```

## Project Structure

```
├── sensor_backend/          # Django project settings, URLs, ASGI/WSGI
├── sensors/                 # Django app
│   ├── models.py            # SensorReading, Aggregated tables, Anomaly
│   ├── views.py             # REST API endpoints + sensor metadata
│   ├── serializers.py       # DRF serializers
│   ├── consumers.py         # WebSocket consumer
│   ├── tasks.py             # Celery aggregation tasks
│   └── management/commands/ # CLI commands (load_csv_data, seed, simulate, cleanup)
├── sensor-dashboard/        # React frontend
│   └── src/
│       ├── pages/           # Dashboard.jsx, Analytics.jsx
│       ├── components/      # SensorCard, SensorGauge, Sparkline, AnomalyAlert, Navigation
│       └── services/        # api.js (Axios client), mockData.js, websocket.js
├── context/                 # Design principles + style guide
├── sensor_schematics/       # 5 sensor datasheets (PDF)
├── generate_dummy_data.py   # Physics-based CSV data generator
├── sensor_data_sample.csv   # 1M-row sample dataset (~94 MB)
├── requirements.txt         # Python dependencies
├── setup.bat                # One-click setup script
├── start.bat                # Start both servers
└── stop.bat                 # Stop both servers
```

## Features

### Live Dashboard (`/`)

- **12 sensor cards** each with:
  - Plotly gauge showing current value against datasheet range
  - 60-second sparkline chart with per-sensor color coding
  - Status badge: NORMAL / WARNING / CRITICAL / OFFLINE
  - Footer stats: Current, Min, Max, Avg (compact formatted)
- **Sensor-aware status logic**:
  - Pollutants (CO, NO₂, NH₃, TVOC, eCO₂, PM2.5, IAQ Index) — low is good, high triggers warning/critical
  - Gas Resistance — high is good (clean air), low triggers warning
  - Environmental (Temperature, Humidity, Pressure, Light) — mid-range normal, extremes trigger warning
- **Anomaly alert panel** with severity indicators and timestamps
- **Auto-polling** every 2 seconds for all 12 sensors

### Historical Analytics (`/analytics`)

- **Sensor selector** dropdown with name, unit, and sensor model
- **Time range controls**: 1h, 6h, 24h, 7d, 30d, or custom date/time range
- **Resolution selector**: Auto, 1-second, 1-minute, 1-hour
- **Interactive Plotly chart** with:
  - Average line (WebGL-accelerated `scattergl`)
  - Min/Max shaded band
  - Hover tooltips with formatted values and timestamps
  - Zoom, pan, and mode bar controls
- **Statistics cards**: Minimum, Maximum, Average, Std Dev, Data Points
- **CSV export** of the currently displayed data

### Data Pipeline

```
sensor_data.csv (or sample)
    ↓  python manage.py load_csv_data --clear
Raw SensorReading table
    ↓  Automatic aggregation during load
SensorAggregated1Sec  →  SensorAggregated1Min  →  SensorAggregated1Hour
    ↓  3-sigma anomaly detection
Anomaly table (spike, out_of_range)
    ↓  Time-cycling replay
Live dashboard (maps wall-clock time to CSV position via modulo)
```

### Dummy Data Generator

`generate_dummy_data.py` produces realistic sensor data with:
- Diurnal light/temperature cycles (sunrise/sunset)
- Humidity anti-correlation with temperature
- Weather front pressure oscillations
- Traffic rush-hour CO/NO₂ peaks
- Rare pollution events with exponential decay
- Wind-driven particle dispersion effects

```bash
python generate_dummy_data.py --hours 24 --frequency 1 --output sensor_data.csv
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sensors/ingest/` | Batch insert sensor readings |
| GET | `/api/sensors/list/` | All 12 sensors with metadata and status |
| GET | `/api/sensors/{id}/live/` | Last 60 seconds of 1-sec aggregated data |
| GET | `/api/sensors/{id}/history/` | Historical data with auto-resolution |
| GET | `/api/sensors/anomalies/` | Anomalies with severity/sensor filtering |

**Historical data auto-resolution:**
- ≤ 1 hour → 1-second aggregations
- ≤ 24 hours → 1-minute aggregations
- \> 24 hours → 1-hour aggregations

## Database Schema

**5 tables** with indexed lookups on `(sensor_id, timestamp)`:

| Table | Purpose | Retention |
|-------|---------|-----------|
| `SensorReading` | Raw readings | 7 days |
| `SensorAggregated1Sec` | 1-second avg/min/max/std/count | 30 days |
| `SensorAggregated1Min` | 1-minute summaries | 1 year |
| `SensorAggregated1Hour` | 1-hour summaries | Forever |
| `Anomaly` | Detected anomalies (spike, dropout, out_of_range) | Forever |

## Design System

The frontend follows a comprehensive dark-theme design system documented in `context/style-guide.md`:

- **Dark backgrounds**: #0A0E27 (primary), #1A1F3A (secondary), #252B4A (tertiary)
- **12-color chart palette** for distinguishing sensors
- **Status colors**: Green (normal), Amber (warning), Red (critical)
- **8px spacing scale** with consistent border radii
- **Responsive**: Works on desktop (1440px+), tablet (768px), and mobile (375px)
- **Plotly charts** use resolved hex colors (Plotly cannot read CSS custom properties)

## Management Commands

```bash
# Load CSV data into all tables (raw + aggregations + anomalies)
python manage.py load_csv_data --csv sensor_data_sample.csv --clear

# Generate random test data (alternative to CSV loading)
python manage.py seed_sensors --hours 24 --frequency 1

# Simulate live 60Hz sensor stream via HTTP POST
python manage.py simulate_sensor_stream --sensor-id 1 --duration 60

# Clean up old raw readings (>7 days)
python manage.py cleanup_old_readings
```

## Anomaly Detection

Statistical anomaly detection runs during data load:
- **Spike detection**: 3-sigma rule on a 10-minute sliding window (600 data points)
  - Medium severity: 3–5 standard deviations
  - High severity: >5 standard deviations
- **Out-of-range detection**: Values outside sensor-specific normal ranges
- **Dropout detection**: No data received for >5 seconds (via Celery in production)

## Sample Data

The repo includes `sensor_data_sample.csv` (~94 MB, 1M rows) for testing. The full dataset (1.5 GB, 15.7M rows) can be generated with:

```bash
python generate_dummy_data.py --hours 24 --frequency 1 --output sensor_data.csv
```

## Future Enhancements

- WebSocket live streaming (infrastructure in place: `consumers.py`, `routing.py`, `asgi.py`)
- Celery Beat for continuous aggregation in production
- PostgreSQL migration for high-volume deployments
- User authentication and multi-tenancy
- Email/SMS alerting on anomalies
- ML-based anomaly detection (LSTM/Prophet)
- Mobile app for field monitoring
