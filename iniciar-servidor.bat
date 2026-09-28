@echo off
title Gerador de QR Code - servidor local
start "" http://localhost:8080
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Porta 8080
pause
