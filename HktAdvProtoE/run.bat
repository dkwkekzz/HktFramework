@echo off
rem ============================================================================
rem  HktAdvProtoE 원클릭 확인 (Windows)
rem
rem  더블클릭하면 지금까지의 작업을 순서대로 확인한다.
rem    ① Node 확인 -> ② pnpm 확인 -> ③ 의존성 -> ④ 타입 검사 -> ⑤ 전체 테스트
rem    -> ⑥ 브라우저 Lab (모듈 상태 · 대표 장면 · 증거 화면)
rem
rem    run.bat        위 전부
rem    run.bat lab    의존성만 챙기고 바로 Lab 만 띄운다
rem    run.bat test   Lab 없이 콘솔 검증까지만 (타입 검사 + 전체 테스트)
rem
rem  ※ 이 파일은 UTF-8(BOM 없음)이다. 한글이 깨지면 chcp 65001 이 적용됐는지 확인할 것.
rem  ※ pnpm 호출을 `for /f` 로 감싸지 말 것 — stdout 이 캡처되어, corepack 이 pnpm 을
rem     내려받는 동안 화면에 아무것도 나오지 않는다 (창은 떠 있는데 멈춘 것처럼 보인다).
rem     패키지 매니저는 언제나 `call` 로 직접 부르고 출력을 그대로 흘려보낸다.
rem ============================================================================
chcp 65001 >nul 2>nul
setlocal

rem corepack 이 다운로드 여부를 묻고 stdin 에서 멈추는 일을 막는다.
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"
title HktAdvProtoE - 작업 확인 (%MODE%)

cd /d "%~dp0"
if not exist "package.json" goto :no_project

echo.
echo  ==========================================================
echo    HktAdvProtoE - 목적 트리 기반 오픈월드 어드벤처 프로토타입
echo    지금까지의 작업을 확인한다  (모드: %MODE%)
echo  ==========================================================
echo.

rem --- 1/5 : Node 확인 (vite 6 은 Node 20 이상이 필요하다) --------------------
where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "delims=" %%v in ('node -p "process.versions.node" 2^>nul') do set "NODE_VERSION=%%v"
for /f "tokens=1 delims=." %%v in ("%NODE_VERSION%") do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :no_node
if %NODE_MAJOR% LSS 20 goto :old_node
echo  [1/5] Node.js v%NODE_VERSION% 확인

rem --- 2/5 : pnpm 확인 --------------------------------------------------------
rem 이 저장소는 pnpm 워크스페이스다 (pnpm-workspace.yaml · 의존이 workspace:* ).
rem npm 으로는 설치되지 않으므로 pnpm 이 반드시 있어야 한다.
where pnpm >nul 2>nul
if errorlevel 1 goto :no_pnpm
echo  [2/5] pnpm 확인 - 버전을 확인한다 (처음이면 corepack 이 내려받느라 잠시 걸린다)
call pnpm -v
if errorlevel 1 goto :no_pnpm

rem --- 3/5 : 의존성 -----------------------------------------------------------
if exist "node_modules\vitest" (
  echo  [3/5] 의존성 준비됨 - 설치를 건너뛴다
) else (
  echo  [3/5] 처음 실행이다. 의존성을 내려받는다 - 몇 분 걸릴 수 있다...
  call pnpm install
  if errorlevel 1 goto :install_failed
)

if /i "%MODE%"=="lab" goto :lab

rem --- 4/5 : 타입 검사 --------------------------------------------------------
echo.
echo  [4/5] 타입 검사 - pnpm run typecheck
call pnpm run typecheck
if errorlevel 1 goto :typecheck_failed

rem --- 5/5 : 전체 테스트 ------------------------------------------------------
echo.
echo  [5/5] 전체 테스트 - pnpm test  (전 모듈 단위/속성/통합 + 저장소 규약, 1분 남짓)
call pnpm test
if errorlevel 1 goto :test_failed

echo.
echo  [통과] 타입 검사와 전체 테스트가 모두 통과했다.

if /i "%MODE%"=="test" goto :done

rem --- 브라우저 Lab -----------------------------------------------------------
:lab
echo.
echo  ----------------------------------------------------------
echo    브라우저 Lab 을 띄운다. 준비되면 브라우저가 저절로 열린다.
echo      상단 여섯 구획 - 모든 모듈 상태 / 실패한 검증 / 의존성 그래프 /
echo                       최신 코드 해시 / 리플레이 해시 / 자동 검증 결과
echo      탭            - 모듈별 대표 검증 장면
echo    (열리지 않으면 아래에 찍히는 Local 주소를 직접 열 것)
echo.
echo    끝내려면 이 창에서 Ctrl+C 를 누르거나 창을 닫는다.
echo  ----------------------------------------------------------
echo.
call pnpm lab --open
if errorlevel 1 goto :lab_failed
goto :done

rem --- 오류 처리 --------------------------------------------------------------
:no_project
echo.
echo  [오류] package.json 을 찾지 못했다.
echo         이 파일은 HktAdvProtoE 폴더 안에 있어야 한다.
goto :fail

:no_node
echo.
echo  [오류] Node.js 를 찾지 못했다.
echo         https://nodejs.org 에서 LTS 버전(20 이상)을 설치한 뒤 다시 실행할 것.
goto :fail

:old_node
echo.
echo  [오류] Node.js v%NODE_VERSION% 은 너무 낮다. vite 6 은 v20 이상이 필요하다.
echo         https://nodejs.org 에서 LTS 버전으로 올린 뒤 다시 실행할 것.
goto :fail

:no_pnpm
echo.
echo  [오류] pnpm 을 쓸 수 없다. 이 저장소는 pnpm 워크스페이스라 npm 으로는 설치되지 않는다.
echo.
echo         명령 프롬프트를 열고 아래 한 줄을 실행한 뒤 이 파일을 다시 실행할 것.
echo             corepack enable
echo.
echo         그래도 안 되면 관리자 권한 명령 프롬프트에서 같은 명령을 실행할 것.
echo         (corepack 은 Node.js 20 이상에 함께 들어 있다)
goto :fail

:install_failed
echo.
echo  [오류] pnpm install 실패. 네트워크 또는 프록시 설정을 확인할 것.
echo         (사내망이라면 pnpm config set proxy / https-proxy 필요)
goto :fail

:typecheck_failed
echo.
echo  [오류] 타입 검사 실패 - 위 출력에 원인이 있다.
goto :fail

:test_failed
echo.
echo  [오류] 테스트 실패 - 위 출력의 실패 항목이 지금 막힌 지점이다.
goto :fail

:lab_failed
echo.
echo  [오류] Lab 개발 서버가 비정상 종료했다. 위 메시지를 확인할 것.
echo         포트가 이미 쓰이고 있다면 그 프로그램을 닫고 다시 실행할 것.
goto :fail

:fail
echo.
pause
exit /b 1

:done
echo.
pause
endlocal
