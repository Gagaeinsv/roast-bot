// src/handlers/top.js
// Команда /top — топ-10 найжорсткіших ростів дня

const { getTopRoastsToday } = require('../services/db');

async function handleTop(ctx) {
  const topRoasts = getTopRoastsToday();

  if (!topRoasts || topRoasts.length === 0) {
    return ctx.reply(
      '📊 *Топ ростів дня*\n\n' +
      '_Сьогодні ще ніхто не купив токсичний рост. Будь першим! 🔥_',
      { parse_mode: 'Markdown' }
    );
  }

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let message = '🔥 *Топ-10 найжорсткіших ростів дня* (анонімно)\n\n';

  topRoasts.forEach((roast, index) => {
    const medal = medals[index] || `${index + 1}.`;
    // Скорочуємо до 120 символів
    const preview = roast.text.length > 120
      ? roast.text.slice(0, 120) + '...'
      : roast.text;
    message += `${medal} _${preview}_\n\n`;
  });

  message += '💬 _Хочеш потрапити в топ? Замов токсичний рост!_';

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🔥 Заростити мене!', callback_data: 'roast_me' },
      ]],
    },
  });
}

module.exports = { handleTop };
