@echo off
REM =====================================================================
REM 원클릭 재현 (Windows) — 설치 -> 테스트 -> 데모 서버
REM run.sh 의 Windows 판. 더블클릭 한 번으로 설치/테스트 후 관전 데모를 띄운다.
REM =====================================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 Node 20+ 를 설치하세요.
  pause
  exit /b 1
)

echo == npm install ==============================================
call npm install --no-fund --no-audit
if errorlevel 1 goto :err

echo == npm test ================================================
call npm test
if errorlevel 1 goto :err

echo == npm run demo ============================================
echo 데모 서버를 띄웁니다. 브라우저가 자동으로 열립니다 ^(안 열리면 아래 주소로 접속^).
echo   http://localhost:8173
echo 종료하려면 이 창에서 Ctrl+C 를 누르세요.
start "" http://localhost:8173
call npm run demo
goto :eof

:err
echo.
echo [실패] 위 로그를 확인하세요.
pause
exit /b 1
