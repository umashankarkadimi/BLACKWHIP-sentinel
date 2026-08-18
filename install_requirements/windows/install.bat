@echo off
echo Installing BlackWhip SentinelX for Windows...
echo Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed! Please install Node.js (v18+) from https://nodejs.org/
    pause
    exit /b
)
echo Node.js is installed.
echo Installing dependencies...
cd ..\..
call npm install
echo.
echo ==============================================================
echo Setup Complete! 
echo Next steps:
echo 1. Create a .env file in the root directory.
echo 2. Add your Gemini API key: GEMINI_API_KEY=your_actual_api_key
echo 3. Run 'npm run dev' to start the SentinelX dashboard.
echo ==============================================================
pause
