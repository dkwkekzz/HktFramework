@echo off
rem ---------------------------------------------------------------------------
rem HktAdvProtoE - one-click check (Windows)
rem
rem Double-click to walk through everything built so far, in order:
rem   1) install     pnpm install
rem   2) typecheck   pnpm run typecheck
rem   3) test        pnpm test        (all modules + repo conventions)
rem   4) lab         pnpm lab --open  (module board + scenes + evidence)
rem
rem Usage
rem   run.bat        steps 1-4
rem   run.bat lab    install check, then open the browser Lab only
rem   run.bat test   steps 1-3 only, no browser
rem
rem To capture output for a bug report:
rem   run.bat test > run-log.txt 2>&1
rem
rem ---------------------------------------------------------------------------
rem THIS FILE MUST STAY PURE ASCII, WITH CRLF LINE ENDINGS.
rem
rem   - CRLF: cmd.exe re-seeks batch files by byte offset. With LF-only endings
rem     the goto/label scan desyncs and the window closes with no output.
rem     Enforced by .gitattributes (*.bat text eol=crlf).
rem
rem   - ASCII: cmd.exe decodes the batch file with the console code page that is
rem     active while it reads ahead. On a Korean Windows (CP949) a UTF-8 comment
rem     is mis-split mid-character and the parser derails - the window opens and
rem     then nothing runs at all. The chcp below cannot fix that; it applies to
rem     the already-buffered chunk too late. So: no Korean inside this file.
rem     Korean notes live in progress/00-Module-Checklist.md instead.
rem
rem   - chcp 65001 is kept anyway, so that the KOREAN OUTPUT OF CHILD PROCESSES
rem     (vitest scenario names, verify logs) renders correctly in the console.
rem ---------------------------------------------------------------------------
setlocal
chcp 65001 >nul 2>nul

echo [run.bat] starting...

cd /d "%~dp0"
if errorlevel 1 goto :nodir

echo.
echo ===========================================================
echo  HktAdvProtoE - check everything built so far
echo  folder: %CD%
echo ===========================================================
echo.

if not exist "package.json" goto :nopkg

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"
echo mode: %MODE%
echo.

rem --- 0. Node ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 goto :nonode
for /f "delims=" %%v in ('node -v') do echo [1/5] Node %%v

rem --- 1. pnpm (enable via corepack when missing) -----------------------------
where pnpm >nul 2>nul
if not errorlevel 1 goto :havepnpm
echo [2/5] pnpm not found - enabling it through corepack...
call corepack enable >nul 2>nul
call corepack prepare pnpm@10.33.0 --activate
where pnpm >nul 2>nul
if errorlevel 1 goto :nopnpm

:havepnpm
for /f "delims=" %%v in ('pnpm -v') do echo [2/5] pnpm %%v

rem --- 2. install ------------------------------------------------------------
echo.
echo [3/5] install - pnpm install
echo       (first run downloads packages and can take several minutes)
call pnpm install
if errorlevel 1 (
  echo.
  echo [x] pnpm install failed.
  goto :fail
)

if /i "%MODE%"=="lab" goto :lab

rem --- 3. typecheck ----------------------------------------------------------
echo.
echo [4/5] typecheck - pnpm run typecheck
call pnpm run typecheck
if errorlevel 1 (
  echo.
  echo [x] typecheck failed - the cause is in the output above.
  goto :fail
)

rem --- 4. tests --------------------------------------------------------------
echo.
echo [5/5] tests - pnpm test  (all modules: unit/property/integration + conventions)
echo       (takes about a minute)
call pnpm test
if errorlevel 1 (
  echo.
  echo [x] tests failed - the failing entries above are where things stand.
  goto :fail
)

echo.
echo [OK] typecheck and the full test suite passed.

if /i "%MODE%"=="test" goto :done

rem --- 5. browser Lab --------------------------------------------------------
:lab
echo.
echo -----------------------------------------------------------
echo  Opening the browser Lab - pnpm lab --open
echo    top:  all module states / failed checks / dependency graph
echo          latest source hashes / replay hashes / audit result
echo    tabs: representative scene per module
echo  The browser opens by itself. Close the window or press Ctrl+C to stop.
echo -----------------------------------------------------------
echo.
call pnpm lab --open
goto :done

rem --- failure paths ---------------------------------------------------------
:nodir
echo [x] could not switch to the script folder: %~dp0
goto :fail

:nopkg
echo [x] no package.json here. Keep run.bat inside the HktAdvProtoE folder.
goto :fail

:nonode
echo [x] Node.js not found. Install the LTS build from https://nodejs.org and retry.
goto :fail

:nopnpm
echo [x] could not enable pnpm.
echo     Run "corepack enable" in an elevated command prompt, then retry.
goto :fail

:fail
echo.
echo Exiting with an error.
pause
exit /b 1

:done
echo.
echo Done.
pause
exit /b 0
