#!/usr/bin/env python3
"""Pre-deploy verification gate for monitor_full_database.
Runs: Python syntax checks -> JSON Schema check (if jsonschema installed) -> Dual-mode Node DOM smoke tests.
"""
import glob
import json
import os
import subprocess
import sys


def run_step(title: str, cmd: list[str]) -> None:
    print(f"\n==> {title}")
    res = subprocess.run(cmd, text=True)
    if res.returncode != 0:
        print(f"FAILED: {title} (exit {res.returncode})")
        sys.exit(res.returncode)


def main() -> None:
    py_files = ["build_database.py", "bot/telegram_bot.py"] + sorted(glob.glob("scripts/*.py"))
    run_step("1. Python syntax check (py_compile)", [sys.executable, "-m", "py_compile"] + py_files)

    print("\n==> 2. database_master.json integrity & stores schema check")
    with open("database_master.json", "r", encoding="utf-8") as f:
        db = json.load(f)
    cat = db.get("catalog") or []
    assert len(cat) >= 2700, f"Unexpected catalog size: {len(cat)}"
    bad_stores = 0
    for m in cat:
        for st in (m.get("stores") or []):
            if not isinstance(st, dict) or "name" not in st or "url" not in st:
                bad_stores += 1
    assert bad_stores == 0, f"Found {bad_stores} non-dict store entries!"
    print(f"OK: {len(cat)} models, 0 invalid store objects")

    run_step("3. Node DOM smoke test — standalone offline HTML", ["node", "scripts/smoke_test_portal.js", "monitor_full_database.html"])
    run_step("4. Node DOM smoke test — fast split web index.html + data/db_payload.js", ["node", "scripts/smoke_test_portal.js", "index.html"])

    print("\n==> 5. Offline Telegram bot logic test (no network/token required)")
    bot_check = subprocess.run(
        [sys.executable, "-c", (
            "import sys, types; "
            "tg = types.ModuleType('telegram'); tg.__getattr__ = lambda n: type(n, (), {'DEFAULT_TYPE': object}); "
            "tg_ext = types.ModuleType('telegram.ext'); tg_ext.__getattr__ = lambda n: type(n, (), {'DEFAULT_TYPE': object}); "
            "sys.modules.setdefault('telegram', tg); sys.modules.setdefault('telegram.ext', tg_ext); "
            "sys.path.insert(0, 'bot'); import telegram_bot as tb; "
            "th = tb.filter_true_hdr(max_rub=80000, limit=5); "
            "assert len(th) == 5, f'Expected 5 truehdr, got {len(th)}'; "
            "ppi = tb.compute_ppi_and_distance(th[0]); "
            "assert 'PPI' in ppi, f'Bad PPI: {ppi}'; pk = tb.pick_monitor_of_the_day(); assert pk and pk.get('model'); "
            "print(f'OK: bot offline test passed (truehdr={len(th)}, sample_ppi={ppi})')"
        )],
        text=True
    )
    if bot_check.returncode != 0:
        print("FAILED: 5. Offline Telegram bot logic test")
        sys.exit(bot_check.returncode)

    print("\nALL PRE-DEPLOY CHECKS PASSED! Ready for `git add . && git commit && git push`.")


if __name__ == "__main__":
    main()
