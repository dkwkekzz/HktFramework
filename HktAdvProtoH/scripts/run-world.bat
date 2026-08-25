@echo off
rem ============================================================
rem  HktAdvProtoH — 세계(서버)만 실행 (Windows)
rem
rem  세계가 이 창에서 자기 시계로 돕니다. 창을 닫으면 세계가 멈춥니다.
rem  클라이언트는 run-client.bat 으로 따로 띄우세요.
rem  (한 번에 다 띄우려면 run.bat, 두 창을 동시에 열려면 run-split.bat)
rem ============================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

if "%PORT%"=="" set PORT=5180

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  echo        https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

echo [1/2] 의존성 확인/설치 중...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [오류] npm install 에 실패했습니다. 네트워크 상태를 확인하세요.
  pause
  exit /b 1
)

echo [2/2] 세계를 시작합니다 — 포트 %PORT%
echo        접속자가 없어도 세계는 계속 돕니다.
echo        종료하려면 Ctrl+C 를 누르거나 이 창을 닫으세요.
echo.
call npm run world

pause
