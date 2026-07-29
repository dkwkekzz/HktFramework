@echo off
chcp 65001 >nul
rem ============================================================================
rem HktAssetGeneratorA 원클릭 실행 — 파라메트릭 검 생성기
rem   Node 확인 -> 의존성 설치 -> 검증 게이트(vitest) -> 뷰어 서버 + 브라우저
rem
rem   사용법
rem     run.bat          전체: 검증 게이트 통과 후 뷰어 실행 (기본, 더블클릭)
rem     run.bat check    검증만: vitest 전체 (결정성/불변식/golden 게이트)
rem     run.bat dev      뷰어만: 검증 건너뛰고 바로 실행
rem     run.bat golden   golden 해시 재생성 (생성 알고리즘을 의도적으로 바꾼 뒤)
rem
rem   종료: 열린 [뷰어] 콘솔 창에서 Ctrl+C 또는 창 닫기.
rem ============================================================================
setlocal
cd /d "%~dp0"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"

rem ── 0. Node 확인 (package.json engines: node >=22 <23) ──────────────────────
where node >nul 2>nul || (
  echo [오류] Node.js 22 LTS 가 필요합니다. https://nodejs.org
  pause & exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODEMAJOR=%%v"
if not "%NODEMAJOR%"=="22" (
  echo [경고] Node 22 LTS 기준으로 고정된 트랙입니다 ^(현재 major: %NODEMAJOR%^).
  echo        golden 해시가 어긋나면 Node 22 로 다시 시도하세요.
)

rem ── 1. 의존성 ───────────────────────────────────────────────────────────────
if not exist node_modules (
  echo [1/3] 의존성 설치 ^(최초 1회, 수 분 소요^)...
  call npm install || (
    echo [오류] npm install 실패.
    pause & exit /b 1
  )
) else (
  echo [1/3] 의존성 확인됨 ^(node_modules^).
)

if /i "%MODE%"=="golden" goto :golden
if /i "%MODE%"=="dev" goto :dev

rem ── 2. 검증 게이트 ──────────────────────────────────────────────────────────
echo.
echo [2/3] 검증 게이트 실행 ^(vitest — 결정성/불변식/golden^)...
echo.
call npm run check || (
  echo.
  echo [실패] 검증 게이트가 통과하지 못했습니다. 위 vitest 출력을 확인하세요.
  pause & exit /b 1
)
echo.
echo [OK] 검증 게이트 통과.

if /i "%MODE%"=="check" (
  echo.
  echo 검증만 수행했습니다. 뷰어까지 보려면 run.bat 을 인자 없이 실행하세요.
  pause & exit /b 0
)

rem ── 3. 뷰어 ────────────────────────────────────────────────────────────────
:dev
echo.
echo [3/3] 뷰어 서버 기동 ^(Vite — http://localhost:5173^)...
start "HktAssetGeneratorA 뷰어" cmd /k npm run dev
timeout /t 4 /nobreak >nul
start http://localhost:5173/

echo.
echo 브라우저가 열리지 않으면 직접 http://localhost:5173/ 로 접속하세요.
echo ^(포트가 사용 중이면 Vite 가 5174 등으로 올립니다 — [뷰어] 창의 안내 URL 확인^)
echo.
echo   먼저 해볼 것
echo     1) 오른쪽 슬라이더로 칼날/가드/손잡이/폼멜 파라미터 조정
echo     2) "베이크 ^(1024²^)" 버튼 = CPU 절차 PBR 텍스처 ^(~3초^)
echo     3) "표면 상태 Operation" 패널 = 낡은 검 프리셋/제작 이력 편집
echo     4) "참조 맞춤" 패널 = 참조 이미지 -^> 어노테이션 -^> 형상 자동 맞춤
echo     5) "GLB 다운로드" / "텍스처 PNG" 로 결과 내보내기
echo.
echo 종료하려면 [뷰어] 콘솔 창을 닫으세요.
exit /b 0

rem ── golden 재생성 ──────────────────────────────────────────────────────────
:golden
echo.
echo [2/2] golden 해시 재생성 ^(npm run golden^)...
echo       주의: 생성 알고리즘을 의도적으로 바꾼 경우에만 실행하고,
echo             generatorVersion 을 올린 뒤 갱신 사유를 함께 커밋하세요.
call npm run golden || (
  echo [오류] golden 생성 실패.
  pause & exit /b 1
)
echo.
echo [OK] test/golden/*.json 갱신됨. git diff 로 변경분을 반드시 확인하세요.
pause & exit /b 0
