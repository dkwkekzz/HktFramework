@echo off
rem ============================================================
rem  HktAdvProtoH — 세계와 클라이언트를 각각 다른 창으로 실행 (Windows)
rem
rem  창 2개가 뜹니다.
rem    [세계]        브라우저를 닫아도 계속 돕니다
rem    [클라이언트]  세계에 접속해 관찰합니다
rem
rem  세계 창을 닫으면 클라이언트 화면이 "세계와 끊김" 으로 바뀌고,
rem  세계를 다시 띄우면 스스로 이어집니다 — 분리를 눈으로 확인할 수 있습니다.
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

echo 의존성 확인/설치 중... (두 창이 동시에 설치하지 않도록 여기서 먼저 끝냅니다)
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [오류] npm install 에 실패했습니다. 네트워크 상태를 확인하세요.
  pause
  exit /b 1
)

echo 세계 창을 엽니다...
start "HktAdvProtoH 세계" cmd /k "cd /d "%~dp0" && npm run world"

rem 세계가 포트를 잡을 때까지 잠깐 기다린다 (없어도 클라이언트가 알아서 다시 잇는다)
timeout /t 3 /nobreak >nul

echo 클라이언트 창을 엽니다...
start "HktAdvProtoH 클라이언트" cmd /k "cd /d "%~dp0" && set HKT_WORLD_URL=http://127.0.0.1:5180 && npm run client -- --open"

echo.
echo 두 창이 열렸습니다. 이 창은 닫아도 됩니다.
timeout /t 3 /nobreak >nul
