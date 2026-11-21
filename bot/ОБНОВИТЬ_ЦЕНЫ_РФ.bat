@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================================
echo   Обновление курсов ЦБ РФ и цен российских магазинов
echo ========================================================
python scripts/update_cbr_rates.py --config config/rates.json
python scripts/collect_rf_prices.py --snapshot data/prices_rf_snapshot.json --best-effort
python scripts/record_price_history.py --snapshot data/prices_rf_snapshot.json --history-dir data/price_history

echo.
echo [OK] Готово! Откройте GitHub Desktop -> Commit -> Push origin,
echo      чтобы обновлённые цены РФ появились на сайте.
pause
