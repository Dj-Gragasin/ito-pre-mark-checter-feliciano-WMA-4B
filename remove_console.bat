@echo off
REM Console Statement Remover - Windows Batch Script
REM Usage: 
REM   remove_console.bat              (standard mode)
REM   remove_console.bat --aggressive (aggressive mode)

setlocal enabledelayedexpansion

cd /d "%~dp0"

if "%1"=="--aggressive" (
    echo Running in AGGRESSIVE mode...
    node remove_console_logs_aggressive.js
) else (
    echo Running in STANDARD mode...
    node remove_console_logs.js
)

pause
