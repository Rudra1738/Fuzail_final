@echo off
echo ========================================
echo   Sensor Monitoring System - Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/6] Creating virtual environment...
if not exist "venv" (
    python -m venv venv
    echo Virtual environment created successfully
) else (
    echo Virtual environment already exists
)

echo.
echo [2/6] Activating virtual environment and installing Python dependencies...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt

echo.
echo [3/6] Running Django migrations...
python manage.py makemigrations sensors
python manage.py migrate

echo.
echo [4/6] Creating Django superuser...
echo You'll need to create an admin account for the Django admin panel
python manage.py createsuperuser

echo.
echo [5/6] Loading sensor data...
set /p load="Do you want to load sensor_data.csv into the database? (y/n): "
if /i "%load%"=="y" (
    if exist "sensor_data.csv" (
        python manage.py load_csv_data --csv sensor_data.csv --clear
    ) else (
        python manage.py load_csv_data --csv sensor_data_sample.csv --clear
    )
    echo Sensor data loaded successfully
)

echo.
echo [6/6] Installing frontend dependencies...
cd sensor-dashboard
call npm install
cd ..

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the servers, run: start.bat
echo.
pause
