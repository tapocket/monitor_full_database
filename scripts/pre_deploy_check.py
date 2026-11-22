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

    print("\nALL PRE-DEPLOY CHECKS PASSED! Ready for `git add . && git commit && git push`.")


if __name__ == "__main__":
    main()
