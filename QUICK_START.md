# Quick Start Guide

## Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)

## Setup

### Option A: Automated (Windows)

Double-click `setup.bat`. It will:

1. Create a Python virtual environment
2. Install all Python dependencies from `requirements.txt`
3. Run database migrations
4. Prompt you to create a Django admin account
5. Optionally load sensor data from `sensor_data_sample.csv`
6. Install frontend npm packages

### Option B: Manual

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

## Running

### Option A: Automated (Windows)

```
start.bat      # Opens two terminal windows (Django + React)
stop.bat       # Kills both servers
```

### Option B: Manual

```bash
# Terminal 1 — Django backend
venv\Scripts\activate
python manage.py runserver
# → http://localhost:8000

# Terminal 2 — React frontend
cd sensor-dashboard
npm run dev
# → http://localhost:5173
```

## URLs

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| Analytics | http://localhost:5173/analytics |
| Django Admin | http://localhost:8000/admin |
| API (sensor list) | http://localhost:8000/api/sensors/list/ |

## Daily Workflow

1. `start.bat` → servers start
2. Open http://localhost:5173
3. `stop.bat` when done

## Loading Data

The repo includes a 1M-row sample dataset. To load it:

```bash
venv\Scripts\activate
python manage.py load_csv_data --clear
```

To generate a full dataset (24 hours, 15.7M rows):

```bash
python generate_dummy_data.py --hours 24 --frequency 1 --output sensor_data.csv
python manage.py load_csv_data --csv sensor_data.csv --clear
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | Run `stop.bat`, then `start.bat` |
| Virtual environment not found | Run `setup.bat` again |
| Database errors | `python manage.py migrate` |
| Missing Python packages | `pip install -r requirements.txt` |
| Missing npm packages | `cd sensor-dashboard && npm install` |
| No data on dashboard | `python manage.py load_csv_data --clear` |

## Script Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup.bat` | First-time setup | Once after cloning |
| `start.bat` | Start both servers | Every session |
| `stop.bat` | Stop both servers | End of session |
