@echo off
echo ========================================
echo   Sensor Monitoring System - Starting
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found!
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo [INFO] Starting Django backend server...
echo Backend will be available at: http://localhost:8000
echo.

REM Start Django server in a new window
start "Django Backend Server" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python manage.py runserver"

REM Wait a bit for Django to start
timeout /t 3 /nobreak >nul

echo [INFO] Starting React frontend server...
echo Frontend will be available at: http://localhost:5173
echo.

REM Start React dev server in a new window
start "React Frontend Server" cmd /k "cd /d %~dp0\sensor-dashboard && npm run dev"

REM --- Serial Reader (optional) ---
echo.
echo ========================================
echo   Serial Port Connection (Optional)
echo ========================================
echo.
echo Available serial ports:
call venv\Scripts\activate.bat && python -c "from serial.tools.list_ports import comports; ports=comports(); [print(f'  {p.device:10s} {p.description}') for p in ports] if ports else print('  No ports found')" 2>nul
echo.
set /p comport="Enter COM port to connect (e.g. COM3), or press Enter to skip: "

if not "%comport%"=="" (
    echo.
    echo [INFO] Starting serial reader on %comport%...
    start "Serial Reader" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python manage.py serial_reader --port %comport% --baud 115200 --log-file serial.log"
    echo Serial reader started on %comport%
) else (
    echo [INFO] Skipping serial connection. You can start it manually:
    echo   python manage.py serial_reader --port COMx --baud 115200
)

echo.
echo ========================================
echo   Servers Started Successfully!
echo ========================================
echo.
echo Django Backend:  http://localhost:8000
echo Django Admin:    http://localhost:8000/admin
echo React Frontend:  http://localhost:5173
if not "%comport%"=="" echo Serial Reader:   %comport% @ 115200 baud
echo.
echo To stop everything, close the windows or run: stop.bat
echo.
pause
