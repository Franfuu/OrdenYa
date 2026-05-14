@echo off
REM ─── OrdenYa · Lanza los 3 servicios en ventanas separadas ───

set ROOT=%~dp0

echo.
echo  ============================================
echo    OrdenYa - arrancando servicios
echo  ============================================
echo.

echo  [1/3] Backend (Laravel API)  :: http://localhost:8000
start "OrdenYa - API"      cmd /k "cd /d %ROOT%backend && php artisan serve"

echo  [2/3] Reverb (WebSockets)    :: ws://localhost:8080
start "OrdenYa - Reverb"   cmd /k "cd /d %ROOT%backend && php artisan reverb:start"

echo  [3/3] Frontend (Vite)         :: http://localhost:5173
start "OrdenYa - Frontend" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo.
echo  Listo. Abre http://localhost:5173 cuando Vite cargue.
echo  Cierra las 3 ventanas (o pulsa Ctrl+C en cada una) para parar.
echo.
pause
