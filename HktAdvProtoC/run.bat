@echo off
rem ============================================================================
rem  HktAdvProtoC 원클릭 실행 (Windows) - 공통 실행기
rem
rem  더블클릭하면 ① Node.js 확인 -> ② 의존성 준비 -> ③ 개발 서버 실행
rem  -> ④ 브라우저 자동 열기까지 한 번에 처리한다.
rem
rem  두 국면(기획서 §3)은 진입 배치파일이 다르다:
rem    run-studio.bat  제작 국면 - 모듈 1~6 (세계 생성/검증/패키지 굽기, §36 네 화면)
rem    run-play.bat    플레이 국면 - 모듈 7 (구운 패키지를 불러와 플레이)
rem  이 파일을 직접 실행하면 스튜디오로 연다. (내부: run.bat [studio^|play])
rem  ※ 이 파일은 UTF-8(BOM 없음)이다. 한글이 깨지면 chcp 65001 이 적용됐는지 확인할 것.
rem ============================================================================
chcp 65001 >nul 2>nul
setlocal

set "MODE=%~1"
if /i "%MODE%"=="play" (
  set "OPEN_PATH=/#play"
  title HktAdvProtoC - 플레이 (§3 모듈 7)
) else (
  set "MODE=studio"
  set "OPEN_PATH=/#studio"
  title HktAdvProtoC - 스튜디오 (§3 모듈 1~6)
)

cd /d "%~dp0proto"
if not exist "package.json" goto :no_project

echo.
echo  ==========================================================
echo    HktAdvProtoC - 목적 트리 기반 오픈월드 프로토타입
if /i "%MODE%"=="play" (
  echo    [플레이 국면] 구운 세계 패키지를 그대로 불러와 플레이한다
) else (
  echo    [제작 국면] 세계를 생성/검증하고 플레이 패키지로 굽는다
)
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
echo        (열리지 않으면 아래에 찍히는 Local 주소 뒤에 %OPEN_PATH% 를 붙여 열 것)
echo.
if /i "%MODE%"=="play" (
  echo   놀이 방법 - 플레이 (§3 모듈 7)
  echo     1^) 세계 카드를 고른다              (보관된 패키지, 카드에서 §3 처리 기록 확인 가능^)
  echo     2^) 살아갈 주체 카드를 고른다       (§31 - 이미 세계에 살던 주체^)
  echo     3^) 조작: PC = WASD/방향키 이동, 빈 땅 클릭 = 이동, 개체 클릭 = 대상
  echo               모바일 = 좌하단 조이스틱, 탭 = 이동/대상 / 게이트 ^(이중화살표^) = 지역 이동
  echo        하단 행동 버튼으로 행동하고, 시간은 저절로 흐른다 ^(배속/일시정지 우상단^)
  echo     ※ 보관된 세계가 없으면 기본 세계로 바로 시작하거나, 스튜디오에서 먼저 굽는다
) else (
  echo   작업 방법 - 스튜디오 (§3 모듈 1~6)
  echo     1^) [세계를 생성한다] - §5 15단계 컴파일 + §42-6 수정 루프 ^(합격본까지^)
  echo     2^) [플레이 패키지로 보관] - 모듈 1~6 처리 기록이 ✓/✗ 와 수치로 펼쳐진다
  echo     3^) ②~④ 탭에서 구조 검토/시뮬레이션 관찰/사건을 확인한다
  echo     4^) 플레이로 넘어가려면 [플레이 모드] 버튼 또는 run-play.bat
)
echo.
echo   끝내려면 이 창에서 Ctrl+C 를 누르거나 창을 닫는다.
echo.
call npm run dev -- --open %OPEN_PATH%
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
