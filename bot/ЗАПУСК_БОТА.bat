@echo off
cd /d "%~dp0.."
python -c "import os, runpy; p='bot/.env'; [os.environ.__setitem__(k.strip(), v.strip().strip('\"')) for l in open(p, encoding='utf-8-sig') if '=' in l and not l.lstrip().startswith('#') for k, v in [l.split('=', 1)]] if os.path.exists(p) else None; runpy.run_path('bot/telegram_bot.py', run_name='__main__')"
pause