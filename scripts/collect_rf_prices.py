#!/usr/bin/env python3
"""Pluggable Russian store price collector (JSON-LD + OpenGraph/meta Offer.price extractor)."""

import argparse
import datetime
import json
import re
import time
import urllib.request


def extract_jsonld_price(html_text: str) -> int | None:
    """Extract numeric RUB price from Schema.org JSON-LD or OpenGraph/meta price tags."""
    scripts = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
        html_text or "",
        flags=re.I,
    )
    for raw in scripts:
        try:
            data = json.loads(raw.strip())
        except Exception:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, dict):
                if "price" in node:
                    raw_p = str(node["price"]).replace(" ", "").replace("\u00a0", "").replace(",", ".")
                    m = re.search(r"\d+(?:\.\d+)?", raw_p)
                    if m:
                        val = int(round(float(m.group(0))))
                        if 3000 <= val <= 900000:
                            return val
                for v in node.values():
                    if isinstance(v, (dict, list)):
                        stack.append(v)

    for pat in (
        r'<meta[^>]+property=["\']product:price:amount["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+itemprop=["\']price["\'][^>]+content=["\']([^"\']+)["\']',
    ):
        m = re.search(pat, html_text or "", flags=re.I)
        if m:
            raw_p = m.group(1).replace(" ", "").replace("\u00a0", "").replace(",", ".")
            dm = re.search(r"\d+(?:\.\d+)?", raw_p)
            if dm:
                val = int(round(float(dm.group(0))))
                if 3000 <= val <= 900000:
                    return val
    return None


def fetch_page(url: str, timeout: int = 12) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
            "Accept-Language": "ru-RU,ru;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def main():
    parser = argparse.ArgumentParser(description="Collect live Russian store prices into prices_rf_snapshot.json")
    parser.add_argument("--snapshot", default="data/prices_rf_snapshot.json")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between requests in seconds")
    parser.add_argument("--best-effort", action="store_true", help="Exit 0 even if individual stores block requests")
    args = parser.parse_args()

    with open(args.snapshot, "r", encoding="utf-8") as fp:
        snap = json.load(fp)

    today = datetime.date.today().isoformat()
    updated = 0
    for it in snap.get("items", []):
        url = str(it.get("url") or "").strip()
        if not url.startswith("http"):
            continue
        try:
            html = fetch_page(url)
            price = extract_jsonld_price(html)
            if price:
                if any(d in url for d in ("dns-shop.ru", "citilink.ru", "regard.ru", "onlinetrade.ru")):
                    it["retail_rf_rub"] = price
                else:
                    it["mp_rf_rub"] = price
                it["min_90d_rub"] = min(it.get("min_90d_rub", price), price)
                it["checked_at"] = today
                updated += 1
        except Exception as e:
            if not args.best_effort:
                raise
            print(f"[WARN] Skipped {it.get('model_match')}: {e}")
        time.sleep(args.delay)

    if updated > 0:
        snap["updated_at"] = today
        with open(args.snapshot, "w", encoding="utf-8") as fp:
            json.dump(snap, fp, ensure_ascii=False, indent=2)
    print(f"RF price collection complete: {updated}/{len(snap.get('items', []))} updated.")


if __name__ == "__main__":
    main()
