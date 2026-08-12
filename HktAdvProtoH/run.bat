@echo off
rem ============================================================
rem  HktAdvProtoH 원클릭 실행 (Windows)
rem  더블클릭 한 번으로: 의존성 설치/동기화 -> dev 서버 -> 브라우저 오픈
rem  Cycle 이 확장되어도 이 파일은 그대로 쓴다 — 항상 현재 world/view 를 실행한다.
rem
rem    run.bat            최신 Cycle = 현재 게임 전체
rem    run.bat C001       C001 까지의 게임만 (이후 Cycle 의 Rule 은 꺼진다)
rem    run.bat --list     실행 가능한 Cycle 목록
rem ============================================================
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

set "CYCLE="
set "ARG=%~1"

if /i "%ARG%"=="--help" goto :usage
if /i "%ARG%"=="-h"     goto :usage
if /i "%ARG%"=="/?"     goto :usage
if /i "%ARG%"=="--list" goto :listcycles
if /i "%ARG%"=="-l"     goto :listcycles

if not "%ARG%"=="" (
  rem 지정한 Cycle 이 cycles\ 에 실재하는지 먼저 확인한다 — 브라우저를 띄우기 전에 실패시킨다.
  for /d %%D in (cycles\*) do (
    set "NAME=%%~nxD"
    for /f "tokens=1 delims=-" %%I in ("!NAME!") do set "ID=%%I"
    if /i "!NAME!"=="%ARG%" set "CYCLE=!ID!"
    if /i "!ID!"=="%ARG%"   set "CYCLE=!ID!"
  )
  if "!CYCLE!"=="" (
    echo [오류] 알 수 없는 Cycle: %ARG%
    echo 실행 가능한 Cycle:
    call :printcycles
    pause
    exit /b 1
  )
)

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
if "!CYCLE!"=="" (
  echo        실행 범위: 최신 Cycle ^(현재 게임^)
  call npm run dev -- --open
) else (
  echo        실행 범위: !CYCLE! 까지의 게임
  call npm run dev -- --open "/?cycle=!CYCLE!"
)

pause
exit /b 0

:usage
echo 사용법: run.bat [CycleId]
echo.
echo   (인자 없음)   최신 Cycle 까지 = 현재 게임 전체를 실행
echo   CycleId       그 Cycle 까지의 게임만 실행 (예: C001 또는 C001-stone-mining)
echo   --list, -l    실행 가능한 Cycle 목록 출력
echo   --help, -h    이 도움말
pause
exit /b 0

:listcycles
echo 실행 가능한 Cycle:
call :printcycles
pause
exit /b 0

:printcycles
for /d %%D in (cycles\*) do (
  set "NAME=%%~nxD"
  for /f "tokens=1 delims=-" %%I in ("!NAME!") do echo   %%I    !NAME!
)
exit /b 0
