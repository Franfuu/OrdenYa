@echo off
REM ─── OrdenYa · Mata los procesos en los 3 puertos ───

echo  Parando OrdenYa...
echo.

for %%P in (8000 8080 5173) do (
    echo  Liberando puerto %%P...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
        taskkill /F /PID %%a 2>nul
    )
)

echo.
echo  Hecho.
pause
