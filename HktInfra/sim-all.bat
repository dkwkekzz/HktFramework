@echo off
chcp 65001 >nul
rem ============================================================================
rem HktInfra 원클릭 전(全) 서버 시뮬레이션
rem   더블클릭 한 번으로 모든 서버(엣지·월드·서비스·버스·코디네이션·데이터)를
rem   headless 로 띄워 실시간 시뮬레이션한다 (기본 = live 모니터).
rem
rem   sim-all.bat            실시간 모니터 서버 상주 (node run.js live · :8080)  [기본]
rem   sim-all.bat verify     전 서버 검증 파이프라인:
rem                            [1/3] node run.js       verify all — 실 멀티프로세스
rem                            [2/3] node run.js spine  모든 박스/서버 누적 회귀
rem                            [3/3] node run.js report → report.html 타임라인
rem ============================================================================
cd /d "%~dp0"

where node >nul 2>nul || (
  echo [오류] Node.js 22+ 가 필요합니다. https://nodejs.org
  pause & exit /b 1
)

rem ── verify 모드: 전 서버 검증 파이프라인 (선택) ────────────────────────────
if /i "%~1"=="verify" (
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
  echo  전 서버 시뮬레이션 검증 완료 — 모든 검증 통과.
  echo  타임라인 리포트: report.html
  echo ============================================================================
  start "" "report.html"
  pause
  exit /b 0
)

rem ── 기본: 실시간 모니터 서버 상주 (live) ───────────────────────────────────
echo [live] 전 서버 실시간 모니터 기동 — http://localhost:8080 ^(Ctrl+C 종료^)
start http://localhost:8080
node run.js live
exit /b %errorlevel%
