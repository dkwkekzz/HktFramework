@echo off
REM HktSplatLife 원클릭 실행 (Windows) — 로컬 정적 서버 + 브라우저 열기
setlocal
cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8200"

REM python3 우선, 없으면 python
where python >nul 2>nul && (set "PY=python") || (
	where py >nul 2>nul && (set "PY=py") || (
		echo python 필요 ^(python.org 에서 설치^) >&2 & exit /b 1
	)
)

set "URL=http://localhost:%PORT%/index.html"
echo [HktSplatLife] %URL% 서비스 중 — Ctrl+C 로 종료
REM 서버 기동 후 기본 브라우저로 열기
start "" "%URL%"
"%PY%" -m http.server %PORT%

endlocal
