FROM python:3.11-slim

WORKDIR /app
COPY bot/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY bot/telegram_bot.py ./telegram_bot.py
COPY database_master.json ./database_master.json

ENV MONITOR_DB_MASTER=/app/database_master.json
CMD ["python3", "telegram_bot.py"]
