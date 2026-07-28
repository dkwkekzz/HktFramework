@echo off
rem ============================================================================
rem  HktAdvProtoC 원클릭 실행 (Windows)
rem
rem  이 파일을 더블클릭하면 ① Node.js 확인 -> ② 의존성 준비 -> ③ 개발 서버 실행
rem  -> ④ 브라우저 자동 열기까지 한 번에 처리한다.
rem  ※ 이 파일은 UTF-8(BOM 없음)이다. 한글이 깨지면 chcp 65001 이 적용됐는지 확인할 것.
rem ============================================================================
chcp 65001 >nul 2>nul
setlocal
title HktAdvProtoC - 세계 시뮬레이터

cd /d "%~dp0proto"
if not exist "package.json" goto :no_project

echo.
echo  ==========================================================
echo    HktAdvProtoC - 목적 트리 기반 오픈월드 프로토타입
echo  ==========================================================
echo.

rem --- 1/3 : Node.js 확인 (vite 6 은 Node 20 이상이 필요하다) -----------------
where node >nul 2>nul
if errorlevel 1 goto :no_node
where npm >nul 2>nul
if errorlevel 1 goto :no_npm

for /f "delims=" %%v in ('node -p "process.versions.node" 2^>nul') do set "NODE_VERSION=%%v"
for /f "tokens=1 delims=." %%v in ("%NODE_VERSION%") do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :no_node
if %NODE_MAJOR% LSS 20 goto :old_node
echo  [1/3] Node.js v%NODE_VERSION% 확인

rem --- 2/3 : 의존성 --------------------------------------------------------
if exist "node_modules\vite" (
  echo  [2/3] 의존성 준비됨 - 설치를 건너뛴다
) else (
  echo  [2/3] 처음 실행이다. 의존성을 내려받는다 - 몇 분 걸릴 수 있다...
  call npm install
  if errorlevel 1 goto :install_failed
)

rem --- 3/3 : 실행 -----------------------------------------------------------
echo  [3/3] 개발 서버를 띄운다. 준비되면 브라우저가 저절로 열린다.
echo        (열리지 않으면 아래에 찍히는 Local 주소를 브라우저에 붙여넣을 것)
echo.
echo   놀이 방법
echo     1) [개입 세계로 시작] 을 누른다        (수동 세계 + 개입/성장 층)
echo     2) [이 주체를 조작한다] 를 누른다      (사냥꾼 카엘을 잡는다)
echo     3) 행동 버튼을 고르고 [+1일] 로 시간을 민다
echo        - 아무것도 하지 않아도 세계는 계속 흐른다
echo.
echo   끝내려면 이 창에서 Ctrl+C 를 누르거나 창을 닫는다.
echo.
call npm run dev -- --open
if errorlevel 1 goto :dev_failed
goto :done

rem --- 오류 처리 -------------------------------------------------------------
:no_project
echo.
echo  [오류] proto 폴더를 찾지 못했다.
echo         이 파일은 HktAdvProtoC 폴더 안에 있어야 한다 (옆에 proto 폴더가 있어야 한다).
goto :fail

:no_npm
echo.
echo  [오류] npm 을 찾지 못했다. Node.js 를 다시 설치하면 함께 설치된다.
echo         https://nodejs.org
goto :fail

:no_node
echo.
echo  [오류] Node.js 를 찾지 못했다.
echo         https://nodejs.org 에서 LTS 버전(20 이상)을 설치한 뒤 이 파일을 다시 실행할 것.
goto :fail

:old_node
echo.
echo  [오류] Node.js v%NODE_VERSION% 은 너무 낮다. vite 6 은 v20 이상이 필요하다.
echo         https://nodejs.org 에서 LTS 버전으로 올린 뒤 다시 실행할 것.
goto :fail

:install_failed
echo.
echo  [오류] npm install 실패. 네트워크 또는 프록시 설정을 확인할 것.
echo         (사내망이라면 npm config set proxy / https-proxy 필요)
goto :fail

:dev_failed
echo.
echo  [오류] 개발 서버가 비정상 종료했다. 위 메시지를 확인할 것.
echo         포트가 이미 쓰이고 있다면 그 프로그램을 닫고 다시 실행할 것.
goto :fail

:fail
echo.
pause
exit /b 1

:done
endlocal
