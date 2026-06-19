// src/services/moderation.js
// Rate limiting та контентна модерація

// Зберігаємо в пам'яті: Map<telegramId, timestamp[]>
const requestLog = new Map();

const RATE_LIMIT = 5;        // макс запитів
const RATE_WINDOW_MS = 60000; // за 1 хвилину

/**
 * Перевіряє чи не перевищено rate limit
 * @returns {boolean} true = можна продовжувати, false = заблоковано
 */
function checkRateLimit(telegramId) {
  const now = Date.now();
  const timestamps = requestLog.get(telegramId) || [];

  // Фільтруємо запити за останню хвилину
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  requestLog.set(telegramId, recent);

  return recent.length <= RATE_LIMIT;
}

/**
 * Очищення старих записів (викликається при запуску cron)
 */
function cleanRateLog() {
  const now = Date.now();
  for (const [id, timestamps] of requestLog.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) {
      requestLog.delete(id);
    } else {
      requestLog.set(id, recent);
    }
  }
}

module.exports = { checkRateLimit, cleanRateLog };
