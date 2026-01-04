@echo off
title Vue PDF Tools Launcher

:menu
cls
echo ========================================
echo Vue PDF Tools - Launcher
echo ========================================
echo.
echo 1. Install Dependencies
echo 2. Start Dev Server
echo 3. Build Production
echo 4. Exit
echo.
set /p choice="Select option (1-4): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto dev
if "%choice%"=="3" goto build
if "%choice%"=="4" goto end

echo.
echo Invalid selection!
pause
goto menu

:install
echo.
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo Installation failed! Please check Node.js and npm
    pause
    goto menu
)
echo.
echo Dependencies installed successfully!
pause
goto menu

:dev
echo.
echo Starting development server...
call npm run dev
goto menu

:build
echo.
echo Building production version...
call npm run build
if errorlevel 1 (
    echo.
    echo Build failed! Please check errors
    pause
    goto menu
)
echo.
echo Build completed! Files in dist directory
pause
goto menu

:end
exit
