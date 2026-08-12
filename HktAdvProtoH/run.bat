@echo off
rem ============================================================
rem  HktAdvProtoH 원클릭 실행 (Windows)
rem  더블클릭 한 번으로: 의존성 설치/동기화 -> dev 서버 -> 브라우저 오픈
rem  Cycle 이 확장되어도 이 파일은 그대로 쓴다 — 항상 현재 world/view 를 실행한다.
rem ============================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  echo        https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

echo [1/2] 의존성 확인/설치 중... (Cycle 확장으로 의존성이 늘어도 여기서 자동 동기화)
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [오류] npm install 에 실패했습니다. 네트워크 상태를 확인하세요.
  pause
  exit /b 1
)

echo [2/2] 게임 시작 — 브라우저가 자동으로 열립니다.
echo        종료하려면 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요.
call npm run dev -- --open

pause
