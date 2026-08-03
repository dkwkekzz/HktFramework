@echo off
chcp 65001 >nul
rem ============================================================================
rem HktAdvProtoF 원클릭 Lab 실행 (Windows)
rem
rem   더블클릭하면 브라우저 검증 Lab 만 띄운다 — 목적에 달성한 결과를 눈으로 본다.
rem     0) Node 확인          node -v                    (>= 22.18)
rem     1) 의존성 설치        npm install                (node_modules 가 없을 때만)
rem     2) Lab 개발 서버      npm run dev -w @hkt/lab    (새 창)
rem     3) 브라우저 열기      http://localhost:5173/#/v1
rem
rem   검증(typecheck / test / verify)은 하지 않는다 — 관찰 전용이다.
rem   계약·증거 스냅샷(packages/lab/src/data.generated.ts)은 저장소에 커밋되어 있으므로
rem   재생성 없이 그대로 읽는다. 이 배치는 저장소 파일을 하나도 바꾸지 않는다.
rem
rem   종료: 열린 [HktAdvProtoF Lab] 콘솔 창에서 Ctrl+C 또는 창 닫기.
rem ============================================================================
setlocal
cd /d "%~dp0app" || (
  echo [x] app 폴더로 이동하지 못했다. run.bat 은 HktAdvProtoF 폴더에 있어야 한다.
  pause & exit /b 1
)

set "PORT=5173"
set "LABURL=http://localhost:%PORT%/#/v1"

echo.
echo ===========================================================
echo  HktAdvProtoF — 브라우저 Lab 관찰 (검증 없음)
echo  작업 폴더: %CD%
echo ===========================================================
echo.

rem --- 0. Node 확인 -----------------------------------------------------------
where node >nul 2>nul || (
  echo [x] Node.js 를 찾지 못했다.
  echo     https://nodejs.org 에서 22.18 이상을 설치한 뒤 다시 실행한다.
  pause & exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [1/3] Node %%v
node -e "const p=process.versions.node.split('.').map(Number);process.exit((p[0]>22||(p[0]===22&&p[1]>=18))?0:1)" >nul 2>nul
if errorlevel 1 (
  echo       [경고] 이 트랙은 Node ^>= 22.18 을 요구한다 ^(app/package.json engines^).
  echo              실행이 실패하면 Node 를 올린 뒤 다시 시도한다.
)

rem --- 1. 의존성 --------------------------------------------------------------
if exist node_modules (
  echo [2/3] 의존성 확인됨 ^(node_modules^).
) else (
  echo [2/3] 의존성 설치 — npm install  ^(최초 1회. 런타임 의존성은 0개이고 Vite·tsc 만 받는다^)
  call npm install || (
    echo.
    echo [x] npm install 실패 — 위 출력에 원인이 있다.
    pause & exit /b 1
  )
)

rem --- 2. Lab 개발 서버 (별도 창) ---------------------------------------------
echo [3/3] Lab 개발 서버 기동 — npm run dev -w @hkt/lab  ^(포트 %PORT%^)
start "HktAdvProtoF Lab" cmd /k npm run dev -w @hkt/lab

rem --- 3. 서버가 응답하면 브라우저를 연다 -------------------------------------
set "READY="
where curl.exe >nul 2>nul && (
  for /l %%i in (1,1,20) do (
    if not defined READY (
      curl.exe -s -o nul --max-time 2 http://localhost:%PORT%/ && set "READY=1"
      if not defined READY timeout /t 1 /nobreak >nul
    )
  )
)
if not defined READY timeout /t 5 /nobreak >nul

echo.
echo 브라우저를 연다 — %LABURL%
start "" "%LABURL%"

echo.
echo -----------------------------------------------------------
echo  무엇을 보는가 — 화면 왼쪽 목록이 지금까지 닫힌 모듈 전부다.
echo    V0~V4  기반   계약 레지스트리 / 결정적 실행 / 시나리오 실행기 / Lab / 증거
echo    O0~O2  세계   세계관 공리 / 공통 존재론 / 상태 스키마
echo    S0~S3  주체   공통 주체 모델 / 종 원형 / 문화·역할 / 개별 주체 생성
echo    D0~D4  의존   대상 타입 / 그래프 스키마 / 종 기본 그래프 / 변형 / 충족도
echo    P0~P5  가능성 행동 원자 / 대응 전략 / 가능성 문법 / 지연 확장 / 목적 / 계획
echo    R0~R3  굴림   세계 상태 저장소 / 사건 / 흔적 / 감지
echo.
echo  모든 페이지는 같은 틀이다 — 상단에 목적 한 문장과 판정 배지, 그 아래 7요소:
echo    1 입력  2 처리 과정  3 후보 결과  4 선택 결과  5 상태 전후  6 실패 이유  7 인과관계
echo  주소창의 #/v1 을 #/r3 처럼 바꾸면 그 모듈로 바로 간다.
echo -----------------------------------------------------------
echo.
echo 브라우저가 열리지 않으면 직접 %LABURL% 로 접속한다.
echo ^(포트가 사용 중이면 Vite 가 5174 등으로 올린다 — [HktAdvProtoF Lab] 창의 안내 URL 확인^)
echo 종료하려면 [HktAdvProtoF Lab] 콘솔 창에서 Ctrl+C 를 누르거나 창을 닫는다.
echo.
pause
exit /b 0
