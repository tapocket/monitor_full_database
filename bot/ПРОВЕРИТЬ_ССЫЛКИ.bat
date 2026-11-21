@echo off
cd /d "%~dp0.."
echo Checking store and review links...
python scripts/check_links.py --master database_master.json --out data/link_health_report.json --md-out data/LINK_AUDIT_REPORT.md --sample 150
echo.
echo [OK] Report saved to data\LINK_AUDIT_REPORT.md
pause
