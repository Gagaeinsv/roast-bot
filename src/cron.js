// src/cron.js
// Фонові задачі (node-cron)

const cron = require('node-cron');
const { cleanRateLog } = require('./services/moderation');

function startCronJobs() {
  // Очищення rate limit логу кожні 5 хвилин
  cron.schedule('*/5 * * * *', () => {
    cleanRateLog();
    console.log('[CRON] Rate limit лог очищено');
  });

  // Щоденне повідомлення в лог о 00:00
  cron.schedule('0 0 * * *', () => {
    console.log('[CRON] Новий день — лічильники скинуто');
  });

  console.log('⏱️  Cron задачі запущено');
}

module.exports = { startCronJobs };
