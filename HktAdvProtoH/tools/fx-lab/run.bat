@echo off
REM FX Lab 원클릭 실행 — 프로젝트 루트를 정적 서빙하고 랩 페이지를 연다.
cd /d "%~dp0..\.."
set PORT=%1
if "%PORT%"=="" set PORT=8200
start "" http://localhost:%PORT%/tools/fx-lab/index.html
python -m http.server %PORT%
