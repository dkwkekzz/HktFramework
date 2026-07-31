@echo off
rem ---------------------------------------------------------------------------
rem HktAdvProtoE 원클릭 확인 배치 (Windows)
rem
rem 더블클릭하면 지금까지의 작업을 순서대로 확인한다.
rem   1) 의존성 설치      pnpm install
rem   2) 타입 검사        pnpm run typecheck
rem   3) 전체 테스트      pnpm test        전 모듈 + 저장소 규약
rem   4) 브라우저 Lab     pnpm lab --open  모듈 상태 · 대표 장면 · 증거 화면
rem
rem 사용법
rem   run.bat            위 1~4 전부
rem   run.bat lab        설치만 확인하고 바로 Lab 만 띄운다
rem   run.bat test       1~3 만 하고 Lab 은 띄우지 않는다
rem
rem 이 파일은 반드시 CRLF 줄바꿈으로 저장한다. LF 로 저장하면 cmd.exe 가
rem goto/label 을 되짚어 읽지 못해 더블클릭 시 창이 그대로 닫힌다.
rem 저장소에서는 .gitattributes 의 `*.bat text eol=crlf` 가 이를 강제한다.
rem ---------------------------------------------------------------------------
setlocal
chcp 65001 >nul 2>nul

cd /d "%~dp0"
if errorlevel 1 goto :nodir

echo.
echo ===========================================================
echo  HktAdvProtoE - 지금까지의 작업 확인
echo  작업 폴더: %CD%
echo ===========================================================
echo.

if not exist "package.json" goto :nopkg

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"
echo 모드: %MODE%
echo.

rem --- 0. Node 확인 ----------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 goto :nonode
for /f "delims=" %%v in ('node -v') do echo [1/5] Node %%v

rem --- 1. pnpm 확인 (없으면 corepack 으로 켠다) --------------------------------
where pnpm >nul 2>nul
if not errorlevel 1 goto :havepnpm
echo [2/5] pnpm 이 없다 - corepack 으로 활성화한다...
call corepack enable >nul 2>nul
call corepack prepare pnpm@10.33.0 --activate
where pnpm >nul 2>nul
if errorlevel 1 goto :nopnpm

:havepnpm
for /f "delims=" %%v in ('pnpm -v') do echo [2/5] pnpm %%v

rem --- 2. 의존성 설치 ---------------------------------------------------------
echo.
echo [3/5] 의존성 설치 - pnpm install
call pnpm install
if errorlevel 1 (
  echo.
  echo [x] pnpm install 실패.
  goto :fail
)

if /i "%MODE%"=="lab" goto :lab

rem --- 3. 타입 검사 -----------------------------------------------------------
echo.
echo [4/5] 타입 검사 - pnpm run typecheck
call pnpm run typecheck
if errorlevel 1 (
  echo.
  echo [x] 타입 검사 실패 - 위 출력에 원인이 있다.
  goto :fail
)

rem --- 4. 전체 테스트 ---------------------------------------------------------
echo.
echo [5/5] 전체 테스트 - pnpm test  (전 모듈 단위/속성/통합 + 저장소 규약)
call pnpm test
if errorlevel 1 (
  echo.
  echo [x] 테스트 실패 - 위 출력의 실패 항목이 지금 막힌 지점이다.
  goto :fail
)

echo.
echo [OK] 타입 검사와 전체 테스트를 통과했다.

if /i "%MODE%"=="test" goto :done

rem --- 5. 브라우저 Lab --------------------------------------------------------
:lab
echo.
echo -----------------------------------------------------------
echo  브라우저 Lab 을 띄운다 - pnpm lab --open
echo    상단: 모든 모듈 상태 / 실패한 검증 / 의존성 그래프 /
echo          최신 코드 해시 / 리플레이 해시 / 자동 검증 결과
echo    탭:   모듈별 대표 검증 장면
echo  브라우저가 자동으로 열린다. 창을 닫거나 Ctrl+C 로 서버를 끈다.
echo -----------------------------------------------------------
echo.
call pnpm lab --open
goto :done

rem --- 실패 경로 --------------------------------------------------------------
:nodir
echo [x] 스크립트 위치로 이동하지 못했다: %~dp0
goto :fail

:nopkg
echo [x] 여기에 package.json 이 없다. run.bat 을 HktAdvProtoE 폴더 안에 둔 채로 실행한다.
goto :fail

:nonode
echo [x] Node.js 를 찾지 못했다. https://nodejs.org 에서 LTS 를 설치한 뒤 다시 실행한다.
goto :fail

:nopnpm
echo [x] pnpm 활성화에 실패했다.
echo     관리자 권한 명령 프롬프트에서 corepack enable 을 실행한 뒤 다시 시도한다.
goto :fail

:fail
echo.
echo 실패로 종료한다.
pause
exit /b 1

:done
echo.
echo 종료.
pause
exit /b 0
