FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY bot/requirements.txt /app/bot/requirements.txt
RUN pip install --no-cache-dir -r /app/bot/requirements.txt

COPY database_master.json /app/database_master.json
COPY data /app/data
COPY bot /app/bot

# Pass TELEGRAM_BOT_TOKEN (and optional TELEGRAM_DIGEST_CHAT_ID) via `docker run -e` or cloud env vars
CMD ["python3", "bot/telegram_bot.py"]
