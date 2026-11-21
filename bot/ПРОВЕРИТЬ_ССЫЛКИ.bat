@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================================
echo   Проверка прямых ссылок магазинов РФ и обзоров
echo ========================================================
python scripts/check_links.py --master database_master.json --out data/link_health_report.json --md-out data/LINK_AUDIT_REPORT.md --sample 150

echo.
echo [OK] Отчёт сохранён в data\LINK_AUDIT_REPORT.md и data\link_health_report.json
pause
