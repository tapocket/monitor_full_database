@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if exist "bot\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("bot\.env") do (
    if /i "%%A"=="TELEGRAM_BOT_TOKEN" set "TELEGRAM_BOT_TOKEN=%%B"
  )
)

if "%TELEGRAM_BOT_TOKEN%"=="" (
  echo [!] Токен не найден в bot\.env
  set /p TELEGRAM_BOT_TOKEN=Вставьте токен бота от BotFather и нажмите Enter: 
)

echo Запуск Telegram-бота monitor_full_database...
python bot/telegram_bot.py
pause
