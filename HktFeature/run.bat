@echo off
chcp 65001 >nul
rem ============================================================================
rem HktFeature 원클릭 시뮬레이션
rem   의존성 설치 → 불변식 테스트 → 원장 서버 → 봇 8기 → 관전 브라우저
rem 종료: 열린 [서버]/[봇] 창을 닫으면 된다.
rem ============================================================================
cd /d "%~dp0"

where node >nul 2>nul || (
  echo [오류] Node.js 22+ 가 필요합니다. https://nodejs.org
  pause & exit /b 1
)

if not exist node_modules (
  echo [1/4] 의존성 설치...
  call npm install || (pause & exit /b 1)
)

echo [2/4] 보존 불변식 테스트...
call npm test >nul 2>nul || (
  echo [오류] 테스트 실패 — npm test 로 확인하세요.
  pause & exit /b 1
)

echo [3/4] 원장 서버 기동 (10Hz)...
start "HktFeature 서버" cmd /k node server\index.js
timeout /t 2 /nobreak >nul

echo [4/4] 봇 8기 + 관전 브라우저...
start "HktFeature 봇" cmd /k node tools\bots.js 8
timeout /t 1 /nobreak >nul
start http://localhost:8080/?name=관전자

echo.
echo 시뮬레이션 가동 — 브라우저에서 직접 참가하려면 탭을 더 여세요.
echo 종료하려면 [서버]/[봇] 콘솔 창을 닫으세요.
