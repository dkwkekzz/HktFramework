@echo off
REM ============================================================
REM  hikito-flesh 원클릭 실행 (Windows)
REM  - Node.js/npm 확인 -> 최초 1회 npm install -> vite dev 서버 실행
REM  - 브라우저는 vite --open 이 자동으로 띄운다 (http://localhost:5173)
REM  이 파일이 있는 폴더에서 더블클릭하면 된다.
REM ============================================================
setlocal
chcp 65001 >nul
title hikito-flesh dev server

REM 이 배치 파일이 있는 폴더로 이동 (더블클릭 시 작업 폴더가 달라도 안전)
cd /d "%~dp0"

REM --- Node.js/npm 설치 확인 ---
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [오류] npm 을 찾을 수 없습니다. Node.js 가 설치되어 있어야 합니다.
  echo        https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

REM --- 의존성 최초 1회 설치 (node_modules 없을 때만) ---
if not exist "node_modules" (
  echo.
  echo [설치] 최초 실행입니다. 의존성을 설치합니다 ^(npm install^)...
  echo        수 분 걸릴 수 있습니다.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [오류] npm install 실패. 네트워크 연결을 확인한 뒤 다시 실행하세요.
    echo.
    pause
    exit /b 1
  )
)

REM --- 개발 서버 실행 + 브라우저 자동 오픈 ---
echo.
echo [실행] 개발 서버를 시작합니다. 브라우저가 자동으로 열립니다.
echo        서버를 끄려면 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요.
echo.
call npm run dev -- --open

REM 서버가 비정상 종료되어도 창이 바로 닫히지 않게 대기
echo.
echo [종료] 개발 서버가 종료되었습니다.
pause
endlocal
