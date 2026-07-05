@echo off
rem HktSplatGenesis 원클릭 실행 — 로컬 정적 서버를 띄우고 브라우저를 연다.
rem WebGPU 는 http(s) 보안 컨텍스트가 필요하므로 file:// 직접 열기 대신 서버를 쓴다.
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PORT=8123

rem Python 탐색: py 런처 → python (tools\serve.py: Range 지원 — .rad LoD 스트리밍 필수)
set RUN=
where py >nul 2>nul && set RUN=py -3 tools\serve.py %PORT%
if not defined RUN where python >nul 2>nul && set RUN=python tools\serve.py %PORT%
if not defined RUN (
	echo [HktSplatGenesis] Python 을 찾지 못했습니다. https://www.python.org/downloads/ 에서 설치 후 다시 실행하세요.
	pause
	exit /b 1
)

echo [HktSplatGenesis] http://localhost:%PORT% 서버 시작 (창을 닫으면 종료)
start "HktSplatGenesis Server" cmd /k "%RUN%"
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%"
endlocal
