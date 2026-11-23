# 🚀 Запуск Telegram-бота 24/7 (без включённого ПК)

Чтобы команды `/oled`, `/miniled`, `/drops`, `/digest`, inline-поиск и уведомления о снижении цен работали круглосуточно, бота можно запустить в Docker на любом недорогом VPS (от 150–300 ₽/мес) или облачном сервисе с поддержкой Dockerfile (Railway, Render, Fly.io, Timeweb Cloud).

## Вариант 1: Любой Linux VPS через Docker (3 команды)

```bash
git clone https://github.com/tapocket/monitor_full_database.git
cd monitor_full_database
docker build -t monitor-fdb-bot .
docker run -d --name monitor-fdb-bot --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN="ВАШ_ТОКЕН_ОТ_BOTFATHER" \
  -e TELEGRAM_DIGEST_CHAT_ID="ОПЦИОНАЛЬНО_ID_КАНАЛА_ИЛИ_ЧАТА" \
  monitor-fdb-bot
```

Проверка логов:
```bash
docker logs -f monitor-fdb-bot
```

Обновление после пуша свежей базы:
```bash
git pull && docker build -t monitor-fdb-bot . && docker rm -f monitor-fdb-bot && \
docker run -d --name monitor-fdb-bot --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN="ВАШ_ТОКЕН" monitor-fdb-bot
```

## Вариант 2: Облачный хостинг (Railway / Render / Timeweb Apps)

1. Подключите репозиторий `tapocket/monitor_full_database` как **Background Worker** (Dockerfile определится автоматически).
2. В разделе **Environment Variables** добавьте:
   * `TELEGRAM_BOT_TOKEN` — ваш токен от `@BotFather`.
   * `TELEGRAM_DIGEST_CHAT_ID` *(опционально)* — ID канала/чата, куда бот будет сам отправлять еженедельный дайджест каждый понедельник в 10:00 МСК.
3. Нажмите **Deploy** — при каждом `git push` в `main` бот будет автоматически перезапускаться со свежей базой.
