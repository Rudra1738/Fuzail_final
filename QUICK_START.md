# Quick Start Guide

This guide will help you set up and run the Sensor Monitoring System with just a few clicks.

## Prerequisites

Before running the setup, make sure you have:
- **Python 3.8+** installed ([Download](https://www.python.org/downloads/))
- **Node.js 16+** installed ([Download](https://nodejs.org/))

## First Time Setup

### Step 1: Run Setup Script

Double-click `setup.bat` or run from command line:
```batch
setup.bat
```

This script will:
1. Create a Python virtual environment
2. Install all Python dependencies (Django, Django REST Framework, etc.)
3. Run database migrations
4. Prompt you to create a Django admin superuser
5. Optionally seed the database with 24 hours of test data
6. Install all frontend dependencies (React, Plotly, etc.)

**Estimated time:** 3-5 minutes (depending on internet speed)

### Step 2: Create Admin User

When prompted, create an admin account:
- Username: (your choice)
- Email: (optional)
- Password: (your choice)

This account lets you access the Django admin panel at `http://localhost:8000/admin`

## Running the Application

### Start Servers

Double-click `start.bat` or run:
```batch
start.bat
```

This will open **two new terminal windows**:
1. **Django Backend Server** - Running on `http://localhost:8000`
2. **React Frontend Server** - Running on `http://localhost:5173`

### Access the Application

Once both servers are running:
- **Dashboard:** http://localhost:5173
- **Django Admin:** http://localhost:8000/admin
- **API Docs:** http://localhost:8000/api/

## Stopping the Servers

### Option 1: Use Stop Script

Double-click `stop.bat` or run:
```batch
stop.bat
```

### Option 2: Close Terminal Windows

Simply close the two server terminal windows that were opened by `start.bat`

## Daily Workflow

**After initial setup, your daily workflow is:**

1. Double-click `start.bat` → Servers start
2. Open browser to `http://localhost:5173`
3. When done, double-click `stop.bat` → Servers stop

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:
1. Run `stop.bat` to kill any existing servers
2. Or change ports in configuration files:
   - Django: `sensor_backend/settings.py` (default: 8000)
   - React: `sensor-dashboard/vite.config.js` (default: 5173)

### Virtual Environment Not Found

If `start.bat` says virtual environment not found:
- Run `setup.bat` again

### Database Errors

If you encounter database errors:
```batch
call venv\Scripts\activate.bat
python manage.py migrate
```

### Missing Dependencies

If you get import errors:
```batch
call venv\Scripts\activate.bat
pip install -r requirements.txt
```

Or for frontend:
```batch
cd sensor-dashboard
npm install
```

## Script Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup.bat` | First-time setup | Once, when you first clone the project |
| `start.bat` | Start servers | Every time you want to run the app |
| `stop.bat` | Stop servers | When you're done working |

## Advanced Usage

### Manual Commands

If you prefer manual control:

**Backend:**
```batch
call venv\Scripts\activate.bat
python manage.py runserver
```

**Frontend:**
```batch
cd sensor-dashboard
npm run dev
```

### Seeding More Data

To add more test data:
```batch
call venv\Scripts\activate.bat
python manage.py seed_sensors --hours 24 --frequency 60
```

### Simulating Live Sensor Stream

To simulate a live 60Hz sensor:
```batch
call venv\Scripts\activate.bat
python manage.py simulate_sensor_stream --sensor-id 1 --duration 60
```

## Need Help?

- Check the main README.md for detailed documentation
- Review CLAUDE.md for technical architecture details
- Check Django logs in the backend terminal window
- Check React logs in the frontend terminal window
