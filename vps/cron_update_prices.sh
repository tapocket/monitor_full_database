#!/usr/bin/env bash
set -euo pipefail

# Ежедневный cron-скрипт для российского VPS:
# 1) Обновляет курсы ЦБ РФ в config/rates.json
# 2) Собирает свежие цены витрин РФ (best-effort JSON-LD) в data/prices_rf_snapshot.json
# 3) Фиксирует срез цен в data/price_history/YYYY-MM.jsonl и пересчитывает min_90d_rub
# 4) Запускает сборку и валидацию базы, при изменениях отправляет коммит в GitHub

REPO_DIR="${1:-/opt/monitor_full_database}"
cd "$REPO_DIR"

git pull --rebase origin main
python3 scripts/update_cbr_rates.py --config config/rates.json
python3 scripts/collect_rf_prices.py --snapshot data/prices_rf_snapshot.json --best-effort
python3 scripts/record_price_history.py --snapshot data/prices_rf_snapshot.json --history-dir data/price_history
python3 build_database.py --master database_master.json --template-xlsx monitor_full_database.xlsx --template-html monitor_full_database.html --outdir . --recalc --verify

git add config/rates.json data/prices_rf_snapshot.json data/price_history/ monitor_full_database.csv monitor_full_database.xlsx monitor_full_database.html
if ! git diff --staged --quiet; then
  git commit -m "chore(vps): daily CBR rates & RF price history snapshot"
  git push origin main
fi
