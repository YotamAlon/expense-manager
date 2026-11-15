@echo off
setlocal
echo =========================================================
echo    ExpenseManager - PyInstaller Build Script
echo =========================================================

if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

echo Using Python: %PYTHON_EXE%
%PYTHON_EXE% build.py %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo Build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo Done!
endlocal
