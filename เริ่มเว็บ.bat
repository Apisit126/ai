@echo off
chcp 65001 >nul
cd /d "%~dp0"
python server.py
if errorlevel 1 (
  echo.
  echo เปิดเว็บไม่ได้ กรุณาติดตั้ง Python 3 ก่อน แล้วลองอีกครั้ง
  pause
)
