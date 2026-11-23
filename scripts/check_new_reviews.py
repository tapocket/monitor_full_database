#!/usr/bin/env python3
"""Daily RSS & public channel radar for fresh monitor reviews (TFTCentral + Djun).

Fetches public feeds (zero external deps), compares URLs against database_master.json,
saves unlinked fresh items to data/new_reviews_radar.json, and appends a radar section
to data/DAILY_UPDATE_CHECKLIST.md. Gracefully exits 0 if offline.
"""

import argparse
import datetime
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET


HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MonitorDBRadar/1.0)"}


def fetch_text(url: str, timeout: int = 12) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def parse_tftcentral_rss(limit: int = 15) -> list[dict]:
    out = []
    try:
        xml_txt = fetch_text("https://tftcentral.co.uk/feed")
        root = ET.fromstring(xml_txt)
        for item in root.findall(".//item")[:limit]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            if title and link:
                out.append({"source": "TFTCentral", "title": title, "url": link, "date": pub})
    except Exception as exc:
        print(f"[RADAR] TFTCentral RSS skipped: {exc}")
    return out


def parse_djun_telegram(limit: int = 15) -> list[dict]:
    out = []
    try:
        html = fetch_text("https://t.me/s/djun1")
        urls = re.findall(r"https?://(?:youtu\.be/[A-Za-z0-9_-]{6,}|(?:www\.)?youtube\.com/watch\?v=[A-Za-z0-9_-]{6,})", html)
        seen = set()
        for u in reversed(urls):
            if u in seen:
                continue
            seen.add(u)
            out.append({"source": "Джун (YouTube/TG)", "title": "Видеообзор на канале «Джун»", "url": u, "date": ""})
            if len(out) >= limit:
                break
    except Exception as exc:
        print(f"[RADAR] Djun feed skipped: {exc}")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Check TFTCentral RSS & Djun channel for fresh unlinked reviews")
    parser.add_argument("--master", default="database_master.json")
    parser.add_argument("--out", default="data/new_reviews_radar.json")
    parser.add_argument("--checklist", default="data/DAILY_UPDATE_CHECKLIST.md")
    args = parser.parse_args()

    with open(args.master, "r", encoding="utf-8") as fp:
        db = json.load(fp)
    existing_urls = {
        str(m.get("rev_url") or "").strip().rstrip("/")
        for m in db.get("catalog", [])
        if m.get("rev_url")
    }

    candidates = parse_tftcentral_rss(15) + parse_djun_telegram(15)
    fresh = [c for c in candidates if c["url"].rstrip("/") not in existing_urls]

    report = {
        "checked_at": datetime.datetime.utcnow().isoformat() + "Z",
        "scanned": len(candidates),
        "new_unlinked": len(fresh),
        "items": fresh,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)

    if fresh and os.path.exists(args.checklist):
        with open(args.checklist, "r", encoding="utf-8") as fp:
            md = fp.read()
        marker = "## 5. Свежие обзоры и новости (RSS-радар TFTCentral / «Джун»)"
        if marker in md:
            md = md.split(marker)[0].rstrip() + "\n"
        sec = ["", marker, ""]
        for it in fresh[:15]:
            sec.append(f"- [ ] **[{it['source']}]** {it['title']} — {it['url']}")
        with open(args.checklist, "w", encoding="utf-8") as fp:
            fp.write(md + "\n".join(sec) + "\n")

    print(f"[RADAR] Scanned {len(candidates)} feed items, {len(fresh)} new unlinked -> {args.out}")


if __name__ == "__main__":
    main()
