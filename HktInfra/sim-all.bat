@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================================
rem  HktInfra one-click all-server simulation  (ASCII-only for reliable parsing)
rem    sim-all.bat            live monitor server - node run.js live - :8080   [default]
rem    sim-all.bat verify     verify pipeline: verify all -> spine -> report.html
rem  Batch text is ASCII on purpose; node's own output is Korean/UTF-8 - chcp 65001.
rem ============================================================================

where node >nul 2>nul
if errorlevel 1 goto :nonode

if /i "%~1"=="verify" goto :verify

rem ---- default: live monitor server (resident) ----
echo [live] All-server live monitor - http://localhost:8080   Ctrl+C to stop
start http://localhost:8080
node run.js live
goto :eof

:verify
echo [1/3] verify all - current step, real multiprocess
node run.js
if errorlevel 1 goto :failverify
echo.
echo [2/3] spine - full-history regression, all boxes/servers
node run.js spine
if errorlevel 1 goto :failspine
echo.
echo [3/3] report - real multiprocess recording to report.html
node run.js report
if errorlevel 1 goto :failreport
echo.
echo ============================================================================
echo  All-server simulation verified - all checks passed.
echo  Timeline report: report.html
echo ============================================================================
start "" "report.html"
pause
goto :eof

:nonode
echo [ERROR] Node.js 22+ required. https://nodejs.org
pause
exit /b 1

:failverify
echo [ERROR] verify failed - see output above.
pause
exit /b 1

:failspine
echo [ERROR] spine regression failed - see output above.
pause
exit /b 1

:failreport
echo [ERROR] report generation failed - see output above.
pause
exit /b 1
