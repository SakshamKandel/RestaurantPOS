@echo off
setlocal EnableExtensions DisableDelayedExpansion
title KhadkaPOS Administrator PIN Recovery

echo KhadkaPOS Administrator PIN Recovery
echo ===================================
echo Close KhadkaPOS completely before continuing.
echo.

"%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq KhadkaPOS.exe" /NH >nul 2>&1
if errorlevel 1 goto tasklist_failed
"%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq KhadkaPOS.exe" /NH 2>nul | "%SystemRoot%\System32\find.exe" /I "KhadkaPOS.exe" >nul
if not errorlevel 1 goto app_running

if not "%~2"=="" goto usage
if "%~1"=="" if not defined APPDATA goto default_database_unavailable
set "RECOVERY_DB=%APPDATA%\KhadkaPOS\pos.db"
if not "%~1"=="" set "RECOVERY_DB=%~1"
if not exist "%RECOVERY_DB%" goto database_missing

set "KPOS_EXE=%LOCALAPPDATA%\Programs\KhadkaPOS\KhadkaPOS.exe"
if exist "%KPOS_EXE%" goto executable_found
set "KPOS_EXE=%ProgramFiles%\KhadkaPOS\KhadkaPOS.exe"
if exist "%KPOS_EXE%" goto executable_found
set "KPOS_EXE=%ProgramFiles(x86)%\KhadkaPOS\KhadkaPOS.exe"
if exist "%KPOS_EXE%" goto executable_found

echo KhadkaPOS is installed in a custom location.
echo Right-click its desktop shortcut and choose Open file location.
echo Copy the full path of KhadkaPOS.exe from that folder.
echo Example: E:\My Apps\KhadkaPOS\KhadkaPOS.exe
echo.
set "KPOS_EXE="
set /p "KPOS_EXE=Full path to KhadkaPOS.exe: "
set "KPOS_EXE=%KPOS_EXE:"=%"
if not defined KPOS_EXE goto executable_missing
if not exist "%KPOS_EXE%" goto executable_missing

:executable_found
if not exist "%~dp0run-recovery.cjs" goto kit_incomplete
if not exist "%~dp0scripts\reset-admin-pin.cjs" goto kit_incomplete
if not exist "%~dp0electron\auth.cjs" goto kit_incomplete
if not exist "%~dp0node_modules\node-sqlite3-wasm\package.json" goto kit_incomplete
if not defined TEMP goto temp_unavailable

:new_receipt
set "RECOVERY_RECEIPT=%TEMP%\KhadkaPOS-admin-recovery-%RANDOM%-%RANDOM%-%RANDOM%.receipt"
if exist "%RECOVERY_RECEIPT%" goto new_receipt

echo.
echo Database: "%RECOVERY_DB%"
echo Keep KhadkaPOS closed until this window finishes.
echo.
set "ELECTRON_RUN_AS_NODE=1"
"%KPOS_EXE%" "%~dp0run-recovery.cjs" "%RECOVERY_DB%" "%RECOVERY_RECEIPT%"
set "RECOVERY_EXIT=%ERRORLEVEL%"
if not "%RECOVERY_EXIT%"=="0" goto recovery_failed
if not exist "%RECOVERY_RECEIPT%" goto receipt_missing
"%SystemRoot%\System32\findstr.exe" /X /C:"KHADKAPOS_ADMIN_RECOVERY_COMPLETED" "%RECOVERY_RECEIPT%" >nul 2>&1
if errorlevel 1 goto receipt_missing

echo.
echo Recovery completed successfully.
echo 1. Reopen KhadkaPOS.
echo 2. Click Administrator at the bottom-left of the sign-in screen.
echo 3. Enter 8865, then click Sign in.
echo Select Administrator, rather than a staff account named Admin.
echo Keep the verified database backup printed above, if one was created.
echo.
pause
endlocal
exit /b 0

:app_running
echo KhadkaPOS is still running. Close every KhadkaPOS window and try again.
echo No recovery was started.
goto failed

:tasklist_failed
echo Could not check whether KhadkaPOS is closed. Recovery was not started.
echo Contact support before trying again.
goto failed

:default_database_unavailable
echo The Windows app-data location is unavailable. Contact support.
goto failed

:database_missing
echo The existing database was not found at:
echo "%RECOVERY_DB%"
echo No database was created. Contact support for the correct existing path.
echo See README.txt for using an explicit database path.
goto failed

:executable_missing
echo KhadkaPOS.exe was not found at the path provided.
echo Use the installed app's shortcut to find its location and try again.
goto failed

:kit_incomplete
echo Recovery files are missing. Extract the complete recovery ZIP first.
echo Keep all extracted files and folders together.
goto failed

:temp_unavailable
echo The Windows temporary-folder location is unavailable. Contact support.
goto failed

:receipt_missing
echo Recovery could not be confirmed by the installed application.
echo Do not assume that the PIN was changed. Keep KhadkaPOS closed.
echo Contact support and share the messages shown in this window.
goto failed

:recovery_failed
echo Recovery did not complete successfully. Read the error above.
echo Keep KhadkaPOS closed and contact support.
goto failed

:usage
echo Usage: "Restore Administrator PIN.cmd" "C:\full\path\pos.db"
echo The optional argument must name the existing database to recover.
goto failed

:failed
echo.
pause
endlocal
exit /b 1
