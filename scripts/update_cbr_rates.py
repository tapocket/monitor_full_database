#!/usr/bin/env python3
"""Fetch official daily EUR/USD/CNY exchange rates from CBR (cbr.ru XML + cbr-xml-daily JSON fallback)
and update config/rates.json and optionally database_master.json."""

import argparse
import datetime
import json
import os
import urllib.request
import xml.etree.ElementTree as ET

CBR_XML_URL = "https://www.cbr.ru/scripts/XML_daily.asp"
CBR_JSON_FALLBACK = "https://www.cbr-xml-daily.ru/daily_json.js"


def fetch_cbr_xml(timeout: int = 15) -> dict:
    req = urllib.request.Request(CBR_XML_URL, headers={"User-Agent": "monitor-full-database-bot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        xml_bytes = resp.read()
    root = ET.fromstring(xml_bytes)
    wanted = {"EUR", "USD", "CNY"}
    rates = {}
    for valute in root.findall("Valute"):
        code = (valute.findtext("CharCode") or "").strip().upper()
        if code in wanted:
            nominal = float((valute.findtext("Nominal") or "1").replace(",", "."))
            value = float((valute.findtext("Value") or "0").replace(",", "."))
            if nominal > 0 and value > 0:
                rates[f"{code}_RUB"] = round(value / nominal, 2)
    if len(rates) != 3:
        raise RuntimeError(f"Incomplete CBR XML rates received: {rates}")
    return rates


def fetch_cbr_json_fallback(timeout: int = 15) -> dict:
    req = urllib.request.Request(CBR_JSON_FALLBACK, headers={"User-Agent": "monitor-full-database-bot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    valutes = data.get("Valute") or {}
    rates = {}
    for code in ("EUR", "USD", "CNY"):
        item = valutes.get(code) or {}
        nominal = float(item.get("Nominal") or 1)
        value = float(item.get("Value") or 0)
        if nominal > 0 and value > 0:
            rates[f"{code}_RUB"] = round(value / nominal, 2)
    if len(rates) != 3:
        raise RuntimeError(f"Incomplete CBR JSON fallback rates received: {rates}")
    return rates


def fetch_cbr_rates(timeout: int = 15) -> tuple[dict, str]:
    try:
        return fetch_cbr_xml(timeout=timeout), "CBR XML API (cbr.ru)"
    except Exception:
        return fetch_cbr_json_fallback(timeout=timeout), "CBR JSON Mirror (cbr-xml-daily.ru)"


def main():
    parser = argparse.ArgumentParser(description="Update config/rates.json & database_master.json from CBR API")
    parser.add_argument("--config", default="config/rates.json", help="Path to rates.json")
    parser.add_argument("--master", default="", help="Optional path to database_master.json to sync meta.cbr_rates")
    parser.add_argument("--dry-run", action="store_true", help="Print fetched rates without writing")
    args = parser.parse_args()

    cfg = {}
    if os.path.exists(args.config):
        with open(args.config, "r", encoding="utf-8") as fp:
            cfg = json.load(fp)

    rates, source_label = fetch_cbr_rates()
    today = datetime.date.today().isoformat()
    cfg["updated_at"] = today
    cfg["source"] = source_label
    cfg["currency_rates"] = rates
    cfg.setdefault("russia_customs", {
        "duty_free_threshold_eur": 200,
        "duty_rate": 0.15,
        "broker_fee_rub": 500,
        "note": "Пошлина 15% взимается с суммы превышения порога 200 € для зарубежных заказов (Ozon Global / CN).",
    })

    if args.dry_run:
        print(json.dumps(cfg, ensure_ascii=False, indent=2))
        return

    os.makedirs(os.path.dirname(args.config) or ".", exist_ok=True)
    with open(args.config, "w", encoding="utf-8") as fp:
        json.dump(cfg, fp, ensure_ascii=False, indent=2)
    print(f"[CBR] Updated {args.config} ({source_label}): {rates}")

    if args.master and os.path.exists(args.master):
        with open(args.master, "r", encoding="utf-8") as fp:
            master = json.load(fp)
        master.setdefault("meta", {})
        master["meta"]["cbr_rates"] = rates
        master["meta"]["rates_updated_at"] = today
        with open(args.master, "w", encoding="utf-8") as fp:
            json.dump(master, fp, ensure_ascii=False, indent=2)
        print(f"[CBR] Synced meta.cbr_rates into {args.master}")


if __name__ == "__main__":
    main()
