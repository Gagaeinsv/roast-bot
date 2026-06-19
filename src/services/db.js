// src/services/db.js
// Сервіс для роботи з SQLite базою даних
// Використовує вбудований node:sqlite (Node.js 22+, без компіляції)

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './db/roast.db';

// Створюємо директорію якщо не існує
const dbDir = path.dirname(path.resolve(dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(path.resolve(dbPath));

// Ініціалізація схеми БД
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      free_roast_used_at TEXT,
      referred_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER,
      tier TEXT CHECK(tier IN ('free','paid')),
      text TEXT,
      image_path TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER,
      stars_amount INTEGER,
      status TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO stats (key, value) VALUES ('total_roasts', 0);
  `);
  console.log('✅ База даних ініціалізована');
}

// ─── Користувачі ──────────────────────────────────────────────

function getOrCreateUser(telegramId, username, referredBy = null) {
  db.prepare(
    'INSERT OR IGNORE INTO users (telegram_id, username, referred_by) VALUES (?, ?, ?)'
  ).run(telegramId, username || null, referredBy || null);

  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

function canUseFreeTier(telegramId) {
  // Власник бота завжди має безкоштовний доступ
  const ownerId = process.env.OWNER_ID ? parseInt(process.env.OWNER_ID) : null;
  if (ownerId && telegramId === ownerId) return true;

  const user = db.prepare('SELECT free_roast_used_at FROM users WHERE telegram_id = ?').get(telegramId);
  if (!user || !user.free_roast_used_at) return true;

  const lastUsed = new Date(user.free_roast_used_at);
  const now = new Date();
  const diffHours = (now - lastUsed) / (1000 * 60 * 60);
  return diffHours >= 24;
}

function markFreeRoastUsed(telegramId) {
  db.prepare(
    "UPDATE users SET free_roast_used_at = datetime('now') WHERE telegram_id = ?"
  ).run(telegramId);
}

// ─── Рости ────────────────────────────────────────────────────

function saveRoast(telegramId, tier, text, imagePath = null) {
  const result = db.prepare(
    'INSERT INTO roasts (telegram_id, tier, text, image_path) VALUES (?, ?, ?, ?)'
  ).run(telegramId, tier, text, imagePath);

  db.prepare('UPDATE stats SET value = value + 1 WHERE key = ?').run('total_roasts');

  return result.lastInsertRowid;
}

function getTotalRoasts() {
  const row = db.prepare('SELECT value FROM stats WHERE key = ?').get('total_roasts');
  return row ? Number(row.value) : 0;
}

function getTopRoastsToday() {
  return db.prepare(`
    SELECT text, created_at
    FROM roasts
    WHERE tier = 'paid'
      AND date(created_at) = date('now')
    ORDER BY length(text) DESC, created_at DESC
    LIMIT 10
  `).all();
}

// ─── Платежі ──────────────────────────────────────────────────

function savePayment(telegramId, starsAmount, status) {
  return db.prepare(
    'INSERT INTO payments (telegram_id, stars_amount, status) VALUES (?, ?, ?)'
  ).run(telegramId, starsAmount, status);
}

// ─── Рефералка ────────────────────────────────────────────────

function processReferral(newUserId, referrerId) {
  if (!referrerId || newUserId === referrerId) return;
  db.prepare(
    'UPDATE users SET free_roast_used_at = NULL WHERE telegram_id = ?'
  ).run(referrerId);
}

module.exports = {
  initDatabase,
  getOrCreateUser,
  canUseFreeTier,
  markFreeRoastUsed,
  saveRoast,
  getTotalRoasts,
  getTopRoastsToday,
  savePayment,
  processReferral,
};
