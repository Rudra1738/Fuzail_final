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

echo.
echo ========================================
echo   Servers Started Successfully!
echo ========================================
echo.
echo Django Backend:  http://localhost:8000
echo Django Admin:    http://localhost:8000/admin
echo React Frontend:  http://localhost:5173
echo.
echo Two new windows have been opened for the servers.
echo To stop the servers, close those windows or run: stop.bat
echo.
pause
