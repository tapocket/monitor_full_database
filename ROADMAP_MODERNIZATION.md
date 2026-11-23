# План дальнейшего развития и эксплуатации `monitor_full_database`

## Что полностью реализовано и готово к запуску в продакшн

В папке `github_repo/monitor_full_database/` собран завершённый full-stack комплект (41 файл, 0 ошибок формул, 0 упоминаний версий):
1. **Единый источник истины и CI/CD**: `database_master.json`, `build_database.py`, `schema/monitor.schema.json`, `config/rates.json`, `scripts/update_cbr_rates.py`, `scripts/collect_rf_prices.py` (JSON-LD сборщик цен РФ), `scripts/record_price_history.py` (90-дневная история в JSONL), `scripts/check_links.py`, `scripts/parse_issue_update.py` и 4 workflow GitHub Actions (`build-and-verify.yml`, `daily-rates-and-links.yml`, `deploy-pages.yml`, `issue-to-pr.yml`).
2. **Excel (18 вкладок, 69 столбцов) и CSV (32 столбца)**: раздельные цены «Розница РФ» и «Маркетплейсы на руки», живая формула пошлины на Листе 8, статусы РФ на Листе 9, выровненная 6-колоночная таблица тестов на Листе 17 (187 строк).
3. **Офлайн-портал HTML (~5,75 МБ) и Тест-Лаборатория (46 стендов)**: словарное сжатие, офлайн-CSS + сборка Tailwind без CDN (`package.json`, `tailwind.config.js`), PWA (`manifest.webmanifest`, `sw.js`), **«Экспресс-мастер ПВЗ за 3 минуты»**, 4-категорийный фильтр стендов, **Стенд №46 (Реальный тест HDR)**, встроенный в карточку модели **SVG-график цен РФ за 90 дней** и **автоподбор пресета OSD / ICC с выгрузкой в файл**.
4. **Telegram-бот и стек VPS**: `bot/telegram_bot.py` с командами, **Inline-режимом (`@botname`)** и **подписками на снижение цен (`/alert`, SQLite)**; готовый стек `vps/docker-compose.vps.yml` (бот + приватная аналитика Umami) и ежедневный `vps/cron_update_prices.sh`.

---

## Что остаётся на этапе живого запуска и роста

1. **Выкатка на GitHub и VPS (выполняется с вашими токенами и доступами)**:
   * Залить `github_repo/monitor_full_database/` в GitHub, включить `Settings → Pages → Source: GitHub Actions`.
   * Запустить `vps/docker-compose.vps.yml` на российском VPS, прописать `TELEGRAM_BOT_TOKEN`, включить `/setinline` в `@BotFather` и добавить `vps/cron_update_prices.sh` в `crontab`.
2. **Расширение списка отслеживаемых карточек и реальные `.icm`-файлы**:
   * Пополнять `data/prices_rf_snapshot.json` прямыми ссылками на самые популярные модели РФ, чтобы `scripts/collect_rf_prices.py` автоматически строил по ним 90-дневную историю и триггерил `/alert` в Telegram-боте.
   * По мере поступления пользовательских замеров колориметром/спектрорадиометром добавлять в `data/icc/` реальные `.icm`-профили и привязывать ссылки на них в `data/icc_profiles.json`.
3. **Переход на Virtual List при росте каталога свыше 4 000–5 000 моделей**:
   * Добавить виртуализацию таблицы каталога (рендер только видимых строк во вьюпорте) и сборку фронтенда через Vite + `vite-plugin-singlefile` с прекомпилированным Tailwind CSS.
