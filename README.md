# 🔥 AI Рост-бот

Telegram-бот, що генерує саркастичний "рост" за фото або описом.

## Стек
- **Node.js** + **Telegraf** — Telegram бот
- **Groq** (llama-3.3-70b + llama-3.2-vision) — AI генерація (безкоштовно)
- **SQLite** (better-sqlite3) — база даних
- **satori + resvg** — генерація PNG картки для Stories
- **Telegram Stars** — нативна оплата

---

## Швидкий старт

### 1. Встановити залежності
```bash
npm install
```

### 2. Налаштувати .env
```bash
cp .env.example .env
```
Заповни в `.env`:
- `BOT_TOKEN` — токен від [@BotFather](https://t.me/BotFather)
- `GROQ_API_KEY` — ключ з [console.groq.com](https://console.groq.com) (безкоштовно)

### 3. Запустити
```bash
npm start
# або для розробки (автоперезапуск):
npm run dev
```

---

## Структура проєкту
```
src/
├── bot.js              — головний файл
├── cron.js             — фонові задачі
├── handlers/
│   ├── start.js        — /start команда
│   ├── photo.js        — обробка фото
│   ├── text.js         — обробка тексту
│   ├── roast.js        — спільна логіка росту
│   ├── payment.js      — Telegram Stars
│   └── top.js          — /top команда
├── services/
│   ├── ai.js           — Groq API
│   ├── card.js         — генерація PNG
│   ├── moderation.js   — rate limiting
│   └── db.js           — SQLite
└── prompts/
    └── system.js       — AI промпти
```

---

## Деплой на Railway

1. Створи акаунт на [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Додай змінні середовища у Settings → Variables:
   - `BOT_TOKEN`
   - `GROQ_API_KEY`
   - `DATABASE_PATH=/app/db/roast.db`
4. Railway автоматично запустить `npm start`

---

## Команди бота
| Команда | Опис |
|---|---|
| `/start` | Головне меню + лічильник ростів |
| `/top` | Топ-10 ростів дня (анонімно) |
| Фото | Рост за фото |
| Текст | Рост за описом |

## Ліміти Groq (безкоштовний tier)
| Модель | RPM | TPM |
|---|---|---|
| llama-3.3-70b-versatile | 30 | 6,000 |
| llama-3.2-11b-vision | 15 | 7,000 |

> При > 1000 юзерів/день розглянь платний план Groq або кешування запитів.
