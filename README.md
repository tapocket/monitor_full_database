# 🖥️ monitor_full_database — Инженерная база мониторов

![Модели](https://img.shields.io/badge/Моделей-2%20753-005fb8?style=for-the-badge)
![Бренды](https://img.shields.io/badge/Брендов-85-0f7b0f?style=for-the-badge)
![Excel](https://img.shields.io/badge/Excel-18%20вкладок%20%7C%200%20ошибок-1d4ed8?style=for-the-badge)
![HTML Portal](https://img.shields.io/badge/HTML%20Портал-Zero--CDN%20WinUI%203%20PWA-334155?style=for-the-badge)
![CI](https://img.shields.io/badge/CI%20%2B%20Smoke%20Test-Passing-16a34a?style=for-the-badge)

Открытая инженерная база мониторов (**2 753 модели**, **85 брендов**) с единым источником истины (`database_master.json`), книгой Excel на **18 вкладок** (0 ошибок формул), плоской выгрузкой CSV (**30 столбцов**), полностью автономным веб-порталом в стиле **WinUI 3 / Fluent Design 2** (`monitor_full_database.html`, Zero-CDN), **Тест-Лабораторией и 14-шаговым тест-прогоном**, **Режимом ПВЗ**, автоматическим CI/CD на GitHub Actions и Telegram-ботом подбора.

🌐 **Живой портал (GitHub Pages):** https://tapocket.github.io/monitor_full_database/

## ✨ Главные возможности

* **Единый сдержанный дизайн WinUI 3 (Dark / Light Mica) без внешних CDN:** все используемые утилитарные классы Tailwind 3.4 компилируются локально прямо в HTML во время сборки, шрифты системные (`Segoe UI Variable` / `system-ui`), страница стартует мгновенно и выглядит идентично онлайн и офлайн.
* **Быстрый каталог и карточка монитора:**
  * Словарно-разреженное сжатие встроенного JSON + прогрессивный виртуализированный рендер длинных таблиц (`IntersectionObserver` + `requestAnimationFrame`).
  * Облегчённый режим (12 ключевых параметров) и Полный режим (4 основных блока + ленивый аккордеон 8 инженерных модулей).
  * Встроенный расчёт **«Итоговая цена «на руки» + пошлина (>200 €) + риски ПВЗ и гарантии»**, **SVG-спарклайн истории цен** и кнопка **«🖨️ Шпаргалка ПВЗ (Печать / PDF)»** на 1 страницу с ожидаемой матрицей, «красными флагами» и сервисным меню бренда.
* **5 магазинов РФ + прямые карточки:** 632+ связанных моделей по DNS (352 прямые карточки `/product/`), Ситилинк, Регард, ОнлайнТрейд, Ozon, Яндекс Маркет и AliExpress (TITAN ARMY Official).
* **Актуальные стандарты 2025–2026:** проверенный гайд OLED vs Mini-LED (QD-OLED Gen 4/5 Penta-Tandem, WOLED Gen 4 Tandem RGB-Stripe, RGB Mini-LED) и официальная спецификация **VESA DisplayHDR CTS 1.2 + True Black 1400**.
* **Тест-Лаборатория и Режим ПВЗ:**
  * **14-шаговый полный тест-прогон** с 3× HiDPI суперсэмплингом, живым осциллографом Frame-Time, Multi-Hz сравнением, тестом FALD/OLED и копируемым отчётом.
  * **📱 Режим ПВЗ (`#test=pvz`):** автономный мобильный экран с 7-пунктовым чек-листом, базой сервисных меню для 47 брендов и запуском 14-шагового теста в 1 клик.
* **Умный URL-роутинг:** делитесь прямыми ссылками на конкретную модель (`#model=84`), сравнение (`#compare=84,501`), вкладку (`#tab=guide`), 14-шаговый тест (`#test=guided`) или Режим ПВЗ (`#test=pvz`).
* **Telegram-бот (`bot/telegram_bot.py`):** поиск, подбор, ценовые алерты, статус VESA CTS 1.2, прямые ссылки `#model=ID`, до 4 прямых кнопок магазинов и запуск 14-шагового теста ПВЗ.

## 🛠️ Сборка и проверка

```bash
# Полная пересборка CSV, XLSX (с пересчётом формул в LibreOffice) и Zero-CDN HTML
python3 build_database.py \
  --master database_master.json \
  --template-xlsx monitor_full_database.xlsx \
  --template-html monitor_full_database.html \
  --outdir . \
  --recalc --verify

# Автоматический Node DOM smoke-тест портала (Zero-CDN, распаковка 2753 моделей, роутинг, карточка, ПВЗ)
node scripts/smoke_test_portal.js monitor_full_database.html
```

## 🤖 Автоматизация (GitHub Actions)

* `.github/workflows/build-and-verify.yml` — проверка JSON Schema, `py_compile`, сборка `--recalc --verify` и прогон `node scripts/smoke_test_portal.js` на каждом push/PR.
* `.github/workflows/daily-rates-and-links.yml` — еженедельное обновление курсов ЦБ РФ (`scripts/update_cbr_rates.py`), запись истории цен (`scripts/record_price_history.py`), проверка ссылок, пересборка портала и автообновление кэша `sw.js`.
* `.github/workflows/deploy-pages.yml` — автоматический деплой на GitHub Pages.
