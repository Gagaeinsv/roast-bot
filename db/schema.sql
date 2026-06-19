-- Схема бази даних для AI Рост-бота

CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  free_roast_used_at DATETIME,
  referred_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER,
  tier TEXT CHECK(tier IN ('free','paid')),
  text TEXT,
  image_path TEXT,
  score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER,
  stars_amount INTEGER,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stats (
  key TEXT PRIMARY KEY,
  value INTEGER DEFAULT 0
);

-- Початкові налаштування лічильника
INSERT OR IGNORE INTO stats (key, value) VALUES ('total_roasts', 0);
