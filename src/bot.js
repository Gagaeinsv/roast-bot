// src/bot.js
// Головний файл бота — ініціалізація та запуск

require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const { initDatabase } = require('./services/db');
const { startCronJobs } = require('./cron');

// Хендлери
const { handleStart, handleRoastMeButton } = require('./handlers/start');
const { handlePhoto } = require('./handlers/photo');
const { handleText } = require('./handlers/text');
const { handleTop } = require('./handlers/top');
const {
  handlePayRoastCallback,
  handlePreCheckout,
  handleSuccessfulPayment,
} = require('./handlers/payment');

// ─── Перевірка конфігурації ─────────────────────────────────
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не знайдено в .env файлі!');
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY не знайдено в .env файлі!');
  process.exit(1);
}

// ─── Ініціалізація ──────────────────────────────────────────
const bot = new Telegraf(process.env.BOT_TOKEN);

// Сесія для зберігання контексту між повідомленнями
bot.use(session({
  defaultSession: () => ({
    lastText: null,
    lastPhotoBase64: null,
    lastMimeType: null,
  }),
}));

// ─── Middleware для логування ────────────────────────────────
bot.use(async (ctx, next) => {
  const user = ctx.from;
  const msgType = ctx.updateType;
  console.log(`[${new Date().toISOString()}] ${msgType} від @${user?.username || user?.id}`);
  await next();
});

// ─── Команди ────────────────────────────────────────────────
bot.command('start', handleStart);
bot.command('top', handleTop);
bot.command('help', (ctx) => ctx.reply(
  '🤖 *Команди бота:*\n\n' +
  '/start — Головне меню\n' +
  '/top — Топ ростів дня\n\n' +
  '📸 Надішли фото або опис — отримаєш рост!',
  { parse_mode: 'Markdown' }
));

// ─── Медіа ──────────────────────────────────────────────────
bot.on('photo', async (ctx) => {
  // Зберігаємо caption в сесію для використання при платному рості
  if (ctx.session) ctx.session.lastText = ctx.message.caption || '';
  await handlePhoto(ctx);
});

// ─── Текст ──────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  // Зберігаємо текст в сесію
  if (ctx.session) ctx.session.lastText = ctx.message.text;
  await handleText(ctx);
});

// ─── Callback кнопки ────────────────────────────────────────
bot.action('roast_me', handleRoastMeButton);
bot.action('top_roasts', async (ctx) => {
  await ctx.answerCbQuery();
  await handleTop(ctx);
});
bot.action(/^pay_roast:/, handlePayRoastCallback);

// ─── Платежі ────────────────────────────────────────────────
bot.on('pre_checkout_query', handlePreCheckout);
bot.on('message', async (ctx, next) => {
  if (ctx.message?.successful_payment) {
    return handleSuccessfulPayment(ctx);
  }
  return next();
});

// ─── Глобальна обробка помилок ──────────────────────────────
bot.catch((err, ctx) => {
  console.error(`[ERROR] Помилка для ${ctx.updateType}:`, err.message);
  ctx.reply('😵 Щось пішло не так. Спробуй ще раз!').catch(() => {});
});

// ─── Запуск ─────────────────────────────────────────────────
async function main() {
  // Ініціалізуємо БД
  initDatabase();

  // Запускаємо cron задачі
  startCronJobs();

  // Запускаємо бота
  await bot.launch();
  console.log('🚀 Бот запущено!');
  console.log(`📊 Режим: polling`);

  // Graceful shutdown
  process.once('SIGINT', () => {
    console.log('\n⛔ Зупиняємо бота...');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    console.log('\n⛔ Зупиняємо бота...');
    bot.stop('SIGTERM');
  });
}

main().catch((err) => {
  console.error('❌ Критична помилка запуску:', err.message);
  process.exit(1);
});
