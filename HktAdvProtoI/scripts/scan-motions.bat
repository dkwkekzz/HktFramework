@echo off
rem ============================================================
rem  모션 시트 정적 분석 (Windows) — 더블클릭 한 번
rem
rem  motions/ 안의 시트를 훑어 프레임이 실제로 놓인 자리를 찾아내고
rem  view/motion/motion-atlas.generated.ts 를 다시 만든다.
rem
rem  평소에는 이 파일을 실행할 필요가 없다 — run.bat 으로 게임을 띄우면
rem  개발 서버가 시작할 때, 그리고 motions/ 가 바뀔 때마다 알아서 돌린다.
rem  시트를 새로 넣거나 갈아 끼운 뒤 결과를 눈으로 확인하고 싶을 때 쓴다.
rem ============================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  echo        https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [준비] 의존성 설치 중...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [오류] npm install 에 실패했습니다. 네트워크 상태를 확인하세요.
    pause
    exit /b 1
  )
)

call npm run motions:scan

echo.
echo 분석이 끝났습니다. 경고가 있으면 위 내용을 확인하세요.
pause
