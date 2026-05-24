@echo off
title Mission Control updater
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Upgrade %*
echo.
pause
