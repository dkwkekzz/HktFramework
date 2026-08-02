@echo off
rem ============================================================================
rem  HktAdvProtoF — 한 번에 확인하는 실행기 (Windows)
rem
rem  더블클릭하면 준비 → 단위 테스트 → 타입 검사 → 눈 검증(증거 재생성) 순으로
rem  돌리고, 마지막에 브라우저 Lab 을 새 창에서 띄운다.
rem  이 창에는 검증 결과가 그대로 남고, 서버는 별도 창에서 돈다.
rem
rem  사용법:
rem    run.bat            전부 — 검사 3종 + Lab 실행
rem    run.bat check      검사 3종만 — Lab 을 띄우지 않는다
rem    run.bat verify     눈 검증만 — 터미널 7요소 출력 + 증거 재생성
rem    run.bat test       단위 테스트만
rem    run.bat lab        Lab 만 — 브라우저 자동 열기
rem    run.bat install    의존성 설치만
rem ============================================================================
setlocal EnableExtensions
chcp 65001 >nul 2>nul
title HktAdvProtoF - 한 번에 확인
pushd "%~dp0" || goto :no_dir

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"
if /i "%MODE%"=="help" goto :usage
if /i "%MODE%"=="-h" goto :usage
if /i "%MODE%"=="/?" goto :usage

set "KNOWN="
if /i "%MODE%"=="all" set "KNOWN=1"
if /i "%MODE%"=="check" set "KNOWN=1"
if /i "%MODE%"=="verify" set "KNOWN=1"
if /i "%MODE%"=="test" set "KNOWN=1"
if /i "%MODE%"=="lab" set "KNOWN=1"
if /i "%MODE%"=="install" set "KNOWN=1"
if not defined KNOWN (
  echo.
  echo  모르는 모드다: %MODE%
  goto :usage
)

echo.
echo ==============================================================================
echo  HktAdvProtoF — 목적 트리 기반 오픈월드 어드벤처 프로토타입
echo  실행 위치: %CD%
echo  모드: %MODE%
echo ==============================================================================

rem --- 0. 준비 ----------------------------------------------------------------
echo.
echo [0/4] 준비 — Node 확인과 의존성 설치
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
echo       Node v%NODE_MAJ%.%NODE_MIN% — 타입 스트리핑으로 .ts 를 빌드 없이 실행한다.

if exist "node_modules\typescript\package.json" goto :deps_ready
echo       node_modules 가 없다 — npm install 로 타입 검사기를 받는다. 런타임 의존성은 0개다.
call npm install
if errorlevel 1 (
  set "STEP=의존성 설치"
  goto :failed
)
goto :deps_ready

:deps_ready
echo       의존성 준비 완료.
if /i "%MODE%"=="install" goto :done_no_lab

rem --- 1. 단위 테스트 ----------------------------------------------------------
if /i "%MODE%"=="verify" goto :step_verify
if /i "%MODE%"=="lab" goto :step_lab

echo.
echo [1/4] 단위 테스트 — node --test, 워크스페이스 전체
echo ------------------------------------------------------------------------------
call npm test
if errorlevel 1 (
  set "STEP=단위 테스트"
  goto :failed
)
if /i "%MODE%"=="test" goto :done_no_lab

rem --- 2. 타입 검사 ------------------------------------------------------------
echo.
echo [2/4] 타입 검사 — tsc --noEmit, 산출물 없음
echo ------------------------------------------------------------------------------
call npm run typecheck
if errorlevel 1 (
  set "STEP=타입 검사"
  goto :failed
)

rem --- 3. 눈 검증 --------------------------------------------------------------
:step_verify
echo.
echo [3/4] 눈 검증 — 터미널 7요소 출력 + 증거 파일 재생성
echo ------------------------------------------------------------------------------
call npm run verify
if errorlevel 1 (
  set "STEP=눈 검증"
  goto :failed
)
if /i "%MODE%"=="verify" goto :done_no_lab
if /i "%MODE%"=="check" goto :done_no_lab

rem --- 4. Lab ------------------------------------------------------------------
:step_lab
echo.
echo [4/4] 브라우저 Lab — 새 창에서 개발 서버를 띄우고 브라우저를 연다
echo ------------------------------------------------------------------------------
echo       모듈당 페이지 1개, 화면 7요소. 첫 화면은 #/v1 이다.
start "HktAdvProtoF Lab - 이 창을 닫으면 서버가 멈춥니다" cmd /k npm run dev -w @hkt/lab -- --open
if errorlevel 1 (
  set "STEP=Lab 실행"
  goto :failed
)
echo       Lab 창이 열렸다. 준비되면 브라우저가 자동으로 뜬다 — 몇 초 걸린다.
goto :done_lab

rem --- 마무리 ------------------------------------------------------------------
:done_lab
echo.
echo ==============================================================================
echo  통과 — 볼 수 있는 것
echo ==============================================================================
echo   1. 위로 스크롤하면 모듈별 7요소 출력이 그대로 남아 있다.
echo   2. 증거 파일: packages\contracts\evidence\*.json — status 가 VERIFIED 인지 본다.
echo   3. 브라우저 Lab: http://localhost:5173/#/v1
echo      경로 예시 — #/v0 #/v1 #/v2 #/v3 #/v4 #/o0 #/o1 #/o2
echo                  #/s0 #/s1 #/s2 #/s3 #/d0 #/d1
echo      D1 페이지는 화면 가운데에 의존 그래프를 직접 그린다.
echo   4. 서버를 멈추려면 Lab 창에서 Ctrl+C 를 누르거나 그 창을 닫는다.
echo ==============================================================================
echo.
popd
pause
exit /b 0

:done_no_lab
echo.
echo ==============================================================================
echo  통과 — %MODE% 단계까지 정상이다.
echo  증거 파일: packages\contracts\evidence\*.json
echo  Lab 까지 보려면 run.bat 을 인자 없이 실행한다.
echo ==============================================================================
echo.
popd
pause
exit /b 0

rem --- 실패와 안내 -------------------------------------------------------------
:failed
echo.
echo ==============================================================================
echo  실패 — %STEP% 단계에서 멈췄다.
echo  위 출력에서 처음 붉은 줄 또는 첫 실패 이름을 찾는다.
echo  눈 검증이 실패했다면 어떤 모듈의 어떤 장면이 갈라졌는지 표로 나와 있다.
echo ==============================================================================
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

:usage
echo.
echo  run.bat            전부 — 단위 테스트 + 타입 검사 + 눈 검증 + Lab
echo  run.bat check      검사 3종만 — Lab 을 띄우지 않는다
echo  run.bat verify     눈 검증만 — 터미널 7요소 출력 + 증거 재생성
echo  run.bat test       단위 테스트만
echo  run.bat lab        Lab 만 — 브라우저 자동 열기
echo  run.bat install    의존성 설치만
echo.
popd
pause
exit /b 0
