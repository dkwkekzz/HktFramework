@echo off
rem ============================================================================
rem  HktAdvProtoF — Lab 실행기 (Windows)
rem
rem  더블클릭하면 Node 확인 → 의존성 설치 → 브라우저 Lab 실행까지 한 번에 간다.
rem  브라우저는 준비되는 대로 자동으로 열린다. 멈추려면 이 창에서 Ctrl+C.
rem
rem  검증(단위 테스트·타입 검사·눈 검증)은 리눅스 개발 환경에서 돈다 —
rem  이 배치는 결과를 눈으로 보는 일만 한다. Lab 은 커밋된 스냅샷을 읽으므로
rem  검증을 돌리지 않아도 지금까지의 모든 모듈 페이지가 그대로 열린다.
rem ============================================================================
setlocal EnableExtensions
chcp 65001 >nul 2>nul
title HktAdvProtoF Lab
pushd "%~dp0" || goto :no_dir

echo.
echo ==============================================================================
echo  HktAdvProtoF — 브라우저 Lab
echo  실행 위치: %CD%
echo ==============================================================================

rem --- 1. Node 확인 ------------------------------------------------------------
where node >nul 2>nul || goto :no_node
where npm >nul 2>nul || goto :no_npm

set "NODE_MAJ=0"
set "NODE_MIN=0"
for /f "tokens=1,2 delims=." %%a in ('node -p "process.versions.node"') do (
  set "NODE_MAJ=%%a"
  set "NODE_MIN=%%b"
)
if %NODE_MAJ% LSS 22 goto :old_node
if %NODE_MAJ% EQU 22 if %NODE_MIN% LSS 18 goto :old_node
echo  [1/3] Node v%NODE_MAJ%.%NODE_MIN% — 타입 스트리핑으로 .ts 를 빌드 없이 실행한다.

rem --- 2. 의존성 ---------------------------------------------------------------
if exist "node_modules\vite\package.json" (
  echo  [2/3] 의존성 준비 완료.
) else (
  echo  [2/3] node_modules 가 없다 — npm install 로 받는다. 런타임 의존성은 0개다.
  call npm install
  if errorlevel 1 goto :install_failed
)

rem --- 3. Lab ------------------------------------------------------------------
echo  [3/3] Lab 개발 서버를 띄운다. 준비되면 브라우저가 자동으로 열린다.
echo.
echo   첫 화면: http://localhost:5173/#/v1
echo   경로 — #/v0 #/v1 #/v2 #/v3 #/v4 #/o0 #/o1 #/o2 #/s0 #/s1 #/s2 #/s3 #/d0 #/d1
echo   모듈당 페이지 1개, 화면 7요소. D1 페이지는 의존 그래프를 직접 그린다.
echo   멈추려면 Ctrl+C 를 누르거나 이 창을 닫는다.
echo.
echo ------------------------------------------------------------------------------
call npm run dev -w @hkt/lab -- --open
if errorlevel 1 goto :lab_failed

echo.
echo  Lab 서버가 멈췄다.
popd
pause
exit /b 0

rem --- 안내 --------------------------------------------------------------------
:install_failed
echo.
echo  npm install 이 실패했다. 네트워크와 프록시 설정을 확인한 뒤 다시 실행한다.
echo.
popd
pause
exit /b 1

:lab_failed
echo.
echo  Lab 서버가 오류로 멈췄다. 위 출력의 첫 오류 줄을 본다.
echo  5173 포트를 이미 쓰고 있다면 그 창을 먼저 닫는다.
echo.
popd
pause
exit /b 1

:no_node
echo.
echo  Node.js 를 찾지 못했다. https://nodejs.org 에서 22.18 이상 LTS 를 설치한 뒤
echo  이 창을 닫고 run.bat 을 다시 실행한다.
echo.
popd
pause
exit /b 1

:no_npm
echo.
echo  npm 을 찾지 못했다. Node.js 설치가 깨졌을 수 있다 — Node.js 를 다시 설치한다.
echo.
popd
pause
exit /b 1

:old_node
echo.
echo  Node v%NODE_MAJ%.%NODE_MIN% 은 너무 낮다. 22.18 이상이 필요하다.
echo  이 프로젝트는 네이티브 TypeScript 타입 스트리핑으로 .ts 를 빌드 없이 실행한다.
echo.
popd
pause
exit /b 1

:no_dir
echo.
echo  작업 폴더로 이동하지 못했다: %~dp0
echo.
pause
exit /b 1
