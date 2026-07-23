@echo off
chcp 65001 >nul
setlocal

rem === HktAdvProtoA 원클릭 실행 ===
rem 서버(server.mjs)를 새 창으로 띄우고, 준비되면 브라우저로 클라이언트를 연다.
rem 이 배치파일은 game 폴더 안에 위치한다 — 자기 폴더(=game)를 기준으로 동작한다.

cd /d "%~dp0"

set "PORT=8000"

rem 접속 이름 입력 (그냥 Enter 치면 기본값)
set "NAME=모험가"
set /p NAME=접속 이름 (Enter=기본):

rem node 설치 확인
where node >nul 2>nul
if errorlevel 1 (
  echo [오류] node 가 PATH 에 없습니다. Node.js 를 설치하거나 PATH 를 확인하세요.
  pause
  exit /b 1
)

rem 서버를 별도 창으로 기동 (창을 닫으면 서버 종료)
start "HktAdvProtoA World Server" cmd /k "cd /d "%~dp0" && node server.mjs %PORT%"

rem 서버가 포트를 열 때까지 잠깐 대기 후 브라우저 오픈
echo 서버 기동 대기 중...
timeout /t 2 /nobreak >nul

start "" "http://localhost:%PORT%/game/world.html?online&name=%NAME%"

echo.
echo 서버 창(HktAdvProtoA World Server)에서 로그를 확인하세요.
echo 멀티플레이 체험: 브라우저 탭을 여러 개 열어 각각 다른 이름으로 접속.
echo 종료하려면 서버 창을 닫으면 됩니다.
endlocal
