@echo off
echo ========================================
echo   Sensor Monitoring System - Stopping
echo ========================================
echo.

echo [INFO] Stopping Django backend server...
taskkill /FI "WindowTitle eq Django Backend Server*" /T /F >nul 2>&1
if errorlevel 1 (
    echo No Django server found running
) else (
    echo Django server stopped
)

echo.
echo [INFO] Stopping React frontend server...
taskkill /FI "WindowTitle eq React Frontend Server*" /T /F >nul 2>&1
if errorlevel 1 (
    echo No React server found running
) else (
    echo React server stopped
)

REM Also kill any remaining node and python processes that might be serving
echo.
echo [INFO] Cleaning up any remaining processes...
taskkill /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *Vite*" /T /F >nul 2>&1
taskkill /FI "IMAGENAME eq python.exe" /FI "WINDOWTITLE eq *Django*" /T /F >nul 2>&1

echo.
echo ========================================
echo   All Servers Stopped
echo ========================================
echo.
pause
