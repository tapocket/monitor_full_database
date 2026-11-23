@echo off
chcp 65001 >nul
cd /d "%~dp0.."
python bot/telegram_bot.py
pause
