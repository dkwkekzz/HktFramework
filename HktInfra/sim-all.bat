@echo off
chcp 65001 >nul
rem ============================================================================
rem HktInfra 원클릭 전(全) 서버 시뮬레이션
rem   더블클릭 한 번으로 모든 서버(엣지·월드·서비스·버스·코디네이션·데이터)를
rem   headless 로 띄워 시뮬레이션하고 검증한다.
rem
rem   [1/3] 현재 step 전 서버 검증   : node run.js       (verify all — 실 멀티프로세스)
rem   [2/3] 전 역사 불변 회귀        : node run.js spine  (모든 박스/서버 누적 회귀)
rem   [3/3] 실 멀티프로세스 녹화      : node run.js report (→ report.html 타임라인)
rem
rem   끝나면 report.html 을 브라우저로 연다. 실시간 모니터가 필요하면:
rem     sim-all.bat live        (node run.js live — http://localhost:8080 상주)
rem ============================================================================
cd /d "%~dp0"

where node >nul 2>nul || (
  echo [오류] Node.js 22+ 가 필요합니다. https://nodejs.org
  pause & exit /b 1
)

rem ── live 모드: 실시간 모니터 서버 상주 (선택) ──────────────────────────────
if /i "%~1"=="live" (
  echo [live] 실시간 모니터 서버 기동 — http://localhost:8080 ^(Ctrl+C 종료^)
  start http://localhost:8080
  node run.js live
  exit /b %errorlevel%
)

echo [1/3] 현재 step 전(全) 서버 시뮬 검증 (verify all · 실 멀티프로세스)...
call node run.js || (
  echo [오류] verify 실패 — 위 출력을 확인하세요.
  pause & exit /b 1
)

echo.
echo [2/3] 전 역사 불변 회귀 (spine · 모든 박스/서버)...
call node run.js spine || (
  echo [오류] spine 회귀 실패 — 위 출력을 확인하세요.
  pause & exit /b 1
)

echo.
echo [3/3] 실 멀티프로세스 녹화 → report.html ...
call node run.js report || (
  echo [오류] report 생성 실패 — 위 출력을 확인하세요.
  pause & exit /b 1
)

echo.
echo ============================================================================
echo  전 서버 시뮬레이션 완료 — 모든 검증 통과.
echo  타임라인 리포트: report.html
echo ============================================================================
start "" "report.html"
pause
