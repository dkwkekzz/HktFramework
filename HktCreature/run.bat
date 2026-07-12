@echo off
REM HktCreature 개발 서버 — http://localhost:5173
cd /d "%~dp0"
call npm install
call npm run dev
