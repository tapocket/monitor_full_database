#!/usr/bin/env python3
"""Fetch official daily EUR/USD/CNY exchange rates from CBR (cbr.ru) and update config/rates.json."""

import argparse
import datetime
import json
import os
import urllib.request
import xml.etree.ElementTree as ET

CBR_URL = "https://www.cbr.ru/scripts/XML_daily.asp"


def fetch_cbr_rates(timeout: int = 15) -> dict:
    req = urllib.request.Request(CBR_URL, headers={"User-Agent": "monitor-full-database-bot/1.0"})
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
        raise RuntimeError(f"Incomplete CBR rates received: {rates}")
    return rates


def main():
    parser = argparse.ArgumentParser(description="Update config/rates.json from CBR XML API")
    parser.add_argument("--config", default="config/rates.json", help="Path to rates.json")
    parser.add_argument("--dry-run", action="store_true", help="Print fetched rates without writing")
    args = parser.parse_args()

    cfg = {}
    if os.path.exists(args.config):
        with open(args.config, "r", encoding="utf-8") as fp:
            cfg = json.load(fp)

    rates = fetch_cbr_rates()
    cfg["updated_at"] = datetime.date.today().isoformat()
    cfg["source"] = "CBR XML API (cbr.ru)"
    cfg["currency_rates"] = rates
    cfg.setdefault("russia_customs", {
        "duty_free_threshold_eur": 200,
        "duty_rate": 0.15,
        "broker_fee_rub": 500,
    })

    if args.dry_run:
        print(json.dumps(cfg, ensure_ascii=False, indent=2))
        return

    os.makedirs(os.path.dirname(os.path.abspath(args.config)), exist_ok=True)
    with open(args.config, "w", encoding="utf-8") as fp:
        json.dump(cfg, fp, ensure_ascii=False, indent=2)
    print(f"Updated {args.config}: {rates}")


if __name__ == "__main__":
    main()
