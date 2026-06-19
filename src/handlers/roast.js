// src/handlers/roast.js
// Спільна логіка обробки фото та тексту

const { generateRoast, moderatePhoto } = require('../services/ai');
const { checkRateLimit } = require('../services/moderation');
const { canUseFreeTier, markFreeRoastUsed, saveRoast, getOrCreateUser } = require('../services/db');

const STARS_PRICE = 50;

/**
 * Головна функція обробки запиту на рост
 * @param {object} ctx - Telegraf context
 * @param {string|null} photoBase64 - фото у base64
 * @param {string|null} mimeType
 * @param {string} userText - текст від юзера
 */
async function processRoastRequest(ctx, photoBase64 = null, mimeType = null, userText = '') {
  const userId = ctx.from.id;
  const username = ctx.from.username;

  // Реєструємо юзера якщо ще немає
  getOrCreateUser(userId, username);

  // 1. Rate limiting
  if (!checkRateLimit(userId)) {
    return ctx.reply(
      '⏳ Стоп-стоп-стоп! Ти занадто активний 😅\n' +
      'Максимум 5 запитів на хвилину. Перепочинь трохи!'
    );
  }

  // 2. Модерація фото (якщо є)
  if (photoBase64) {
    const loadingMsg = await ctx.reply('🔍 Аналізую фото...');
    const modResult = await moderatePhoto(photoBase64, mimeType);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    if (!modResult.safe) {
      console.log(`[MODERATION] Відмова для ${userId}: ${modResult.reason}`);
      return ctx.reply(
        '🚫 Не можу обробити це фото.\n' +
        (modResult.hasMinor
          ? 'На зображенні схожа на неповнолітню особа — я не працюю з такими фото.'
          : 'Контент не відповідає правилам. Спробуй інше фото!')
      );
    }
  }

  // 3. Перевіряємо безкоштовний тир
  const canFree = canUseFreeTier(userId);

  // 4. Генеруємо безкоштовний рост
  const thinkingMsg = await ctx.reply('✍️ Пишу твій рост...');

  let roastText;
  try {
    roastText = await generateRoast('free', userText, photoBase64, mimeType);
  } catch (err) {
    console.error('Помилка генерації:', err.message);
    await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => {});
    return ctx.reply('😵 Щось пішло не так. Спробуй ще раз!');
  }

  await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => {});

  if (!canFree) {
    // Показуємо "заблокований" рост з пропозицією платного
    await ctx.reply(
      '🔒 *Твій безкоштовний рост на сьогодні вже використано!*\n\n' +
      'Але я підготував щось гарненьке... хочеш побачити? 😏\n\n' +
      '_Купи токсичну версію і отримаєш ПОВНИЙ рост + картку для Stories_',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: `🔥 Токсична версія за ${STARS_PRICE} ⭐`, callback_data: `pay_roast:${encodeRoastData(userText, !!photoBase64)}` }
          ]],
        },
      }
    );
    return;
  }

  // Зберігаємо рост та відмічаємо використання
  saveRoast(userId, 'free', roastText);
  markFreeRoastUsed(userId);

  // Відправляємо рост з кнопкою токсичної версії
  await ctx.reply(
    `🎯 *Твій рост:*\n\n${roastText}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: `🔥 Токсична версія за ${STARS_PRICE} ⭐ Stars`, callback_data: `pay_roast:${encodeRoastData(userText, !!photoBase64)}` }],
          [{ text: '📤 Поділитися', switch_inline_query: roastText.slice(0, 100) }],
        ],
      },
    }
  );
}

// Кодуємо дані для передачі через callback_data (max 64 bytes)
function encodeRoastData(text, hasPhoto) {
  const truncated = (text || '').slice(0, 40);
  return Buffer.from(JSON.stringify({ t: truncated, p: hasPhoto })).toString('base64').slice(0, 50);
}

module.exports = { processRoastRequest };
