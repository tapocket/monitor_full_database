#!/usr/bin/env python3
"""Send a concise Telegram summary from daily GitHub Actions when new reviews or dead links appear.

Requires TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID env vars (GitHub Secrets).
Exits 0 silently if credentials are not configured so CI never fails.
"""

import json
import os
import urllib.parse
import urllib.request


def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    if not token or not chat_id:
        print("[NOTIFY] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not set — skipping notification.")
        return

    radar_items = []
    if os.path.exists("data/new_reviews_radar.json"):
        try:
            radar_items = json.load(open("data/new_reviews_radar.json", encoding="utf-8")).get("items", [])
        except Exception:
            pass

    dead_urls = []
    if os.path.exists("data/link_health_report.json"):
        try:
            dead_urls = json.load(open("data/link_health_report.json", encoding="utf-8")).get("dead_urls", [])
        except Exception:
            pass

    if not radar_items and not dead_urls:
        print("[NOTIFY] No new unlinked reviews or dead links — nothing to send.")
        return

    lines = ["📡 *Ежедневный отчёт CI-радара monitor_full_database*"]
    if radar_items:
        lines.append(f"\n🆕 *Новые обзоры/релизы ({len(radar_items)}):*")
        for it in radar_items[:8]:
            lines.append(f"• [{it.get('source', 'Web')}] {it.get('title', 'Обзор')} — {it.get('url', '')}")
    if dead_urls:
        lines.append(f"\n⚠️ *Битые ссылки 404/410 ({len(dead_urls)}):*")
        for d in dead_urls[:8]:
            lines.append(f"• {d.get('model', '')} ({d.get('status', 404)}): {d.get('url', '')}")

    payload = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": "\n".join(lines)[:4000],
        "parse_mode": "Markdown",
        "disable_web_page_preview": "true",
    }).encode("utf-8")

    try:
        req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=payload)
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(f"[NOTIFY] Telegram summary sent (HTTP {resp.status}).")
    except Exception as exc:
        print(f"[NOTIFY] Telegram send skipped due to error: {exc}")


if __name__ == "__main__":
    main()
