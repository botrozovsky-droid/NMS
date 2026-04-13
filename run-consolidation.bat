@echo off
REM Manual consolidation runner
cd /d "%~dp0"
echo Running memory consolidation...
node consolidate.js
pause
