@echo off
rem ============================================================
rem  HktAdvProtoH — 클라이언트만 실행 (Windows)
rem
rem  이 창에는 세계가 없습니다. 먼저 run-world.bat 으로 세계를 띄우세요.
rem  세계가 아직 없으면 화면에 "세계에 잇는 중…" 이 뜨고, 세계가 뜨는 순간
rem  스스로 이어집니다. 세계를 껐다 켜도 다시 이어집니다.
rem
rem  다른 PC 의 세계에 붙으려면 아래 주소를 그 PC 의 것으로 바꾸세요.
rem    예)  set HKT_WORLD_URL=http://192.168.0.10:5180
rem ============================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

if "%HKT_WORLD_URL%"=="" set HKT_WORLD_URL=http://127.0.0.1:5180

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

echo [2/2] 클라이언트를 시작합니다 — 붙을 세계: %HKT_WORLD_URL%
echo        브라우저가 자동으로 열립니다. 종료: Ctrl+C
echo.
call npm run client -- --open

pause
