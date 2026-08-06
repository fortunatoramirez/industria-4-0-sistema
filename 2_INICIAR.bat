@echo off
cd /d "%~dp0"
if not exist .env (
    echo Falta el archivo .env. Ejecute primero 1_PREPARAR.bat.
    pause
    exit /b 1
)
call npm start
pause
