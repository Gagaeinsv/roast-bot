// src/handlers/start.js
// Обробка команди /start

const { getTotalRoasts, getOrCreateUser, processReferral } = require('../services/db');

async function handleStart(ctx) {
  const user = ctx.from;

  // Парсимо реферальний параметр: /start ref_12345
  let referrerId = null;
  const startPayload = ctx.message?.text?.split(' ')[1];
  if (startPayload?.startsWith('ref_')) {
    referrerId = parseInt(startPayload.replace('ref_', ''), 10);
  }

  // Реєструємо/отримуємо юзера
  const dbUser = getOrCreateUser(user.id, user.username, referrerId);

  // Обробляємо реферал якщо новий юзер
  if (referrerId && !dbUser.referred_by) {
    processReferral(user.id, referrerId);
  }

  const totalRoasts = getTotalRoasts();
  const formattedCount = totalRoasts.toLocaleString('uk-UA');

  const name = user.first_name || 'друже';

  await ctx.reply(
    `🔥 *Привіт, ${name}!*\n\n` +
    `Я — бот, який заростить тебе так, що ти сам засмієшся (або заплачеш 😈)\n\n` +
    `📸 *Як це працює:*\n` +
    `1. Надішли своє фото або коротко опиши себе\n` +
    `2. Отримай *безкоштовний легкий рост* (1 раз на добу)\n` +
    `3. Хочеш жорсткіше? *Токсична версія за 50 ⭐ Stars*\n` +
    `4. Отримай картку для Stories і поділися з друзями 📲\n\n` +
    `🔢 Уже заросили *${formattedCount}* людей\n\n` +
    `😉 _Це гумор, не сприймай надто серйозно_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔥 Заростити мене!', callback_data: 'roast_me' }],
          [{ text: '📊 Топ ростів дня', callback_data: 'top_roasts' }],
          [{ text: '📤 Запросити друга (+1 рост)', switch_inline_query: '' }],
        ],
      },
    }
  );
}

// Обробка кнопки "Заростити мене"
async function handleRoastMeButton(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply(
    '📸 Надішли *своє фото* або *коротко опиши себе* — і я тебе заросту!\n\n' +
    '_Наприклад: "Я хіпстер, люблю каву та розповідати всім що читаю Кафку"_',
    { parse_mode: 'Markdown' }
  );
}

module.exports = { handleStart, handleRoastMeButton };
