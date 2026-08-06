@echo off
cd /d "%~dp0"
if not exist .env (
    copy .env.example .env >nul
    echo Se creo el archivo .env. Edite DB_PASSWORD antes de iniciar.
) else (
    echo El archivo .env ya existe.
)
echo.
echo Instalando dependencias...
call npm install
echo.
echo Preparacion terminada.
pause
