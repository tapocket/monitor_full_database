@echo off
cd /d "%~dp0.."
echo Updating CBR rates and RF monitor prices...
python scripts/update_cbr_rates.py --config config/rates.json
python scripts/collect_rf_prices.py --snapshot data/prices_rf_snapshot.json --best-effort
python scripts/record_price_history.py --snapshot data/prices_rf_snapshot.json --history-dir data/price_history
echo.
echo [OK] Done! Open GitHub Desktop -> Commit -> Push origin.
pause
