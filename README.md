# 🖥️ monitor_full_database

![Модели](https://img.shields.io/badge/Моделей-2%20710-005fb8?style=for-the-badge)
![Бренды](https://img.shields.io/badge/Брендов-85-0f7b0f?style=for-the-badge)
![Excel](https://img.shields.io/badge/Excel-18%20вкладок%20%7C%200%20ошибок-1d4ed8?style=for-the-badge)
![HTML Portal](https://img.shields.io/badge/HTML%20Портал-Zero--CDN%20WinUI%203%20PWA-334155?style=for-the-badge)
![Static API](https://img.shields.io/badge/JSON%20API-api%2Fv1%2F-7c3aed?style=for-the-badge)
![CI](https://img.shields.io/badge/CI%20%2B%20Smoke%20Test-Passing-16a34a?style=for-the-badge)

Открытая инженерная база мониторов (**2 710 моделей**, **85 брендов**, 361 OLED, 235 Mini-LED) с единым источником истины (`database_master.json`), книгой Excel на **18 вкладок** (0 ошибок формул), плоской выгрузкой CSV (**30 столбцов**), полностью автономным веб-порталом в стиле **WinUI 3 / Fluent Design 2** (Zero-CDN), статическим **JSON API (`api/v1/`)**, **Тест-Лабораторией и Режимом ПВЗ**, CI/CD на GitHub Actions и **Telegram-ботом** подбора.

🌐 **Живой портал (GitHub Pages):** https://tapocket.github.io/monitor_full_database/


## 📸 Скриншоты

![monitor_full_database — Обложка портала](og-cover.png)

| Веб-портал (WinUI 3, 7 вкладок) | Обзор каталога (Excel — 18 вкладок) |
| :---: | :---: |
| ![Веб-портал WinUI 3](docs/screenshots/portal_winui3_overview.png) | ![Обзор каталога Excel](docs/screenshots/excel_overview.png) |
| Витрина «Рынок РФ» | Сводная аналитика по 85 брендам |
| ![Рынок РФ](docs/screenshots/excel_market_rf.png) | ![Сводная по брендам](docs/screenshots/excel_brands_summary.png) |

## ✨ Главные возможности портала

* **Zero-CDN WinUI 3 (Dark / Light Mica) + Dual-Mode сборка:**
  * Быстрая веб-версия (`index.html` + `data/db_payload.js`) и единый автономный офлайн-файл (`monitor_full_database.html`) без внешних CDN и шрифтов.
  * Переключатель **Упрощённый / Полный режим**, полная адаптация под ПК и смартфон, кэширование PWA (`sw.js`).
* **Умный каталог, поиск и выгрузка:**
  * Поиск с пониманием кириллических синонимов (`асус`, `ксиаоми`, `олед`, `минилед`, `ультраширик`, `2к`, `4к`) и автокоррекцией раскладки (`фыгы щдув` → `asus oled`).
  * Виджет **«📉 Топ скидок и выгодных цен РФ»** (по `data/price_history/`), встроенный **калькулятор пошлины и курса EUR** (пересчёт порога 200 € / 100 € / 50 € / 0 € в реальном времени по всей таблице) и экспорт текущей отфильтрованной подборки в **Excel-совместимый CSV (UTF-8 BOM)**.
* **Подборщик и Сравнение в лоб:**
  * **6 быстрых 1-кликовых сценариев** (Киберспорт 24–25″ 360+ Гц, 4K OLED для ПК/PS5/Xbox, Текст и код 4K/5K, Mini-LED до 35к, Ультраширик 34″, Универсальный 27″ QHD 240+ Гц).
  * Вкладка «Сравнение» с фильтром **«Только различающиеся параметры»**, визуальным симулятором диагоналей в сантиметрах и **автоматическим инженерным вердиктом** по 5 метрикам (цена, Гц, GtG, контраст, HDR).
* **Карточка монитора:**
  * Расчёт итоговой цены «на руки» + пошлины + рисков ПВЗ, кнопка **«🖨️ Шпаргалка ПВЗ (Печать / PDF)»** на 1 лист A4.
  * Инженерный аккордеон (5 инструментов): **Совместимость PS5 / Xbox / MacBook / RTX & RX**, SVG-график истории цен, калибровка ICC/OSD/Win11 HDR, расчёт расстояния/PPI/Retina и калькулятор кабеля DP 1.4/2.1/HDMI 2.1 + DSC.
  * Автоподбор **похожих аналогов** (дешевле или с гарантией РФ) с переходом в сравнение в 1 клик.
* **Тест-Лаборатория и Режим ПВЗ (`#test=pvz`, `#test=guided`):**
  * 26 HiDPI-тестов экрана («Ресурсы для тестов») (битые пиксели, 5% Grey OLED, FALD, 3× HiDPI, осциллограф Frame-Time), мобильный чек-лист приёмки и база сервисных меню для 47 брендов.
  * Прямые карточки магазинов РФ: **415+ прямых карточек DNS** (`/product/`), Ситилинк, Регард, ОнлайнТрейд, Ozon, Яндекс Маркет и AliExpress.

## 📡 Публичный статический JSON API (`api/v1/`)

После каждого обновления на GitHub Pages доступны лёгкие статические JSON-срезы (без авторизации и лимитов):

| Эндпоинт | Назначение |
| :--- | :--- |
| `api/v1/summary.json` | Сводка: дата обновления, число моделей/брендов, счётчики OLED/Mini-LED/LCD, список эндпоинтов |
| `api/v1/oled.json` | Компактный каталог всех **361 OLED**-моделей |
| `api/v1/miniled.json` | Компактный каталог всех **235 Mini-LED**-моделей |
| `api/v1/market_rf.json` | Витрина **«Рынок РФ»** (53 модели) |
| `api/v1/flagships.json` | Витрина **«Флагманы»** (41 модель) |
| `api/v1/brands.json` | Список всех **85 брендов** |
| `api/v1/monitors.json` | Полный каталог всех 2 710 моделей |

**Пример в JavaScript / Discord-боте:**
```js
const res = await fetch("https://tapocket.github.io/monitor_full_database/api/v1/summary.json");
const stats = await res.json();
console.log(stats.total_models, stats.counts.oled);
```

**Пример в Python:**
```python
import urllib.request, json
url = "https://tapocket.github.io/monitor_full_database/api/v1/oled.json"
oleds = json.loads(urllib.request.urlopen(url).read().decode("utf-8"))
print(f"OLED в базе: {len(oleds)}")
```

## 🤖 Telegram-бот (`bot/telegram_bot.py`)

* Пошаговый кнопочный подбор и команды: `/find`, `/pick` (подбор дня), `/truehdr [бюджет]`, `/oled [бюджет]`, `/miniled [бюджет]`, `/drops` (скидки РФ по истории цен), `/digest` (еженедельный дайджест новинок и скидок), `/model`, `/compare A vs B`, `/pvz <бренд>` (сервисные меню 47 брендов), `/alert`, `/myalerts`, `/delalert`.
* **Inline-режим** (`@имя_бота <модель>`): отправка карточек мониторов в любые чаты Telegram с кнопками портала, ПВЗ и магазинов.
* Автоматическая загрузка токена из локального `bot/.env` (`TELEGRAM_BOT_TOKEN=...`, файл исключён из Git).

## 🌐 Статические SEO-подборки (генерируются автоматически)

* `/seo/oled/` — Лучшие OLED / QD-OLED мониторы 2026
* `/seo/miniled/` — Лучшие Mini-LED мониторы с зонами FALD
* `/seo/budget-25k/` — Лучшие мониторы до 25 000 ₽ в РФ
* `/seo/4k-240hz/` — Флагманы 4K 240 Гц+ для ПК и PS5 Pro
* `/seo/27-qhd/` — Лучшие игровые 27″ QHD (180–360 Гц)
* `/seo/ultrawide/` — Лучшие ультраширокие 34″–49″ (21:9 и 32:9)
* `/seo/ps5-pro/` — Лучшие мониторы для PS5 Pro и Xbox Series X (HDMI 2.1)
* `/seo/macbook-hidpi/` — Лучшие 4K / 5K HiDPI мониторы для MacBook (USB-C PD)
* `/seo/tests/` — Посадочная страница 26 HiDPI-тестов экрана

## 🛠️ Сборка и проверка

```bash
# Полная пересборка CSV, XLSX (с пересчётом формул LibreOffice), HTML (standalone + split) и api/v1/
python3 build_database.py \
  --master database_master.json \
  --template-xlsx monitor_full_database.xlsx \
  --template-html monitor_full_database.html \
  --outdir . \
  --recalc --verify

# Полная преддеплойная проверка (py_compile, схема stores, Node DOM smoke-тесты обоих режимов)
python3 scripts/pre_deploy_check.py
```

## ⚙️ Автоматизация (GitHub Actions)

* `.github/workflows/build-and-verify.yml` — проверка схемы, `py_compile`, сборка `--recalc --verify` и прогон `scripts/smoke_test_portal.js` на каждом push/PR.
* `.github/workflows/daily-rates-and-links.yml` — **ежедневное** (раз в сутки) обновление курсов ЦБ РФ, запись истории цен, аудит 120 ссылок магазинов и обзоров (`data/LINK_AUDIT_REPORT.md`), генерация чеклиста `data/DAILY_UPDATE_CHECKLIST.md`, пересборка портала + `api/v1/` и обновление кэша `sw.js`.
* `.github/workflows/deploy-pages.yml` — автоматический деплой портала и `api/v1/` на GitHub Pages.

## 💡 Практическая настройка монитора (2026)

* **HDR и ACM в Windows 11:** откалибруйте уровень чёрного (0 нит для OLED) и пик яркости через официальное приложение [Microsoft Windows HDR Calibration](https://support.microsoft.com/en-us/windows/hardware/display-graphics/calibrate-your-hdr-display-using-the-windows-hdr-calibration-app); при включённом Auto Color Management (ACM) не накладывайте сторонний ICC-профиль, чтобы избежать двойной цветокоррекции.
* **Кабели DisplayPort 2.1 (4K 240 Гц+ без DSC):** для полной полосы UHBR20 (80 Гбит/с) используйте сертифицированные кабели DP80 или активные [DP80LL](https://vesa.org/press/vesa-to-update-displayport-2-1-with-new-active-cable-specification-for-up-to-3x-longer-dp80-cables/) из официального реестра [VESA Certified Components](https://vesa.org/displayport-developer/certified-components/).
* **Подбор Overdrive без артефактов:** проверяйте режимы разгона матрицы на [Blur Busters TestUFO Ghosting](https://testufo.com/ghosting), выбирая пресет без светлых ореолов (inverse ghosting).

## 🙏 Благодарности и источники

* **[Таблица «МАНИТОРЫ» (автор Гоша)](https://docs.google.com/spreadsheets/d/1wTcNBG28l6VL7BXuO_vIlj0ncRNvrCEExy-iGrNFARU/edit?gid=830910660#gid=830910660)** — особая благодарность автору за проделанную работу по сбору замеров, кодов матриц и ревизий.
* **[YouTube-канал «Джун»](https://www.youtube.com/@djunn/videos)** — обзоры, практические гайды и разборы рынка мониторов ([Telegram](https://t.me/djun1), [чат](https://t.me/djun_chat)).
* Технические обзоры, спецификации и лабораторные тесты: **[TFTCentral](https://tftcentral.co.uk/category/reviews)**, **[RTINGS](https://www.rtings.com/monitor)**, **[DisplaySpecifications](https://www.displayspecifications.com/)**.
* Инструменты и стандарты: **[Blur Busters TestUFO](https://testufo.com/ghosting)**, **[VESA DisplayPort Certified Components](https://vesa.org/displayport-developer/certified-components/)**, **[Microsoft Windows HDR Calibration](https://support.microsoft.com/en-us/windows/hardware/display-graphics/calibrate-your-hdr-display-using-the-windows-hdr-calibration-app)**.
