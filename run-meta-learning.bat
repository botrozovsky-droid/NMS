@echo off
REM Manual meta-learning runner
cd /d "%~dp0"
echo Running meta-learning optimization...
node meta-learn.js
pause
