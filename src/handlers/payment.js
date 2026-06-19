// src/handlers/payment.js
// Обробка платежів через Telegram Stars

const { generateRoast } = require('../services/ai');
const { generateCard } = require('../services/card');
const { saveRoast, savePayment, getOrCreateUser } = require('../services/db');
const { checkRateLimit } = require('../services/moderation');
const { InputFile } = require('telegraf');
const fs = require('fs');

const STARS_PRICE = 50;

/**
 * Відправляє invoice для оплати токсичного росту
 */
async function sendRoastInvoice(ctx) {
  const userId = ctx.from.id;
  getOrCreateUser(userId, ctx.from.username);

  await ctx.telegram.sendInvoice(ctx.chat.id, {
    title: '🔥 Токсичний рост',
    description: 'Отримай максимально токсичний саркастичний розбір + картку для Stories (1080x1920)',
    payload: `toxic_roast_${userId}_${Date.now()}`,
    currency: 'XTR',           // Telegram Stars
    provider_token: '',        // Порожній для Stars
    prices: [{ label: 'Токсичний рост + Stories картка', amount: STARS_PRICE }],
  });
}

/**
 * Обробка callback кнопки "Токсична версія за X Stars"
 */
async function handlePayRoastCallback(ctx) {
  await ctx.answerCbQuery('Зараз відкрию оплату! 💫');
  await sendRoastInvoice(ctx);
}

/**
 * Обов'язкове підтвердження перед списанням Stars
 */
async function handlePreCheckout(ctx) {
  // Завжди підтверджуємо — Telegram вимагає відповіді протягом 10 сек
  await ctx.answerPreCheckoutQuery(true);
}

/**
 * Успішна оплата → генеруємо токсичний рост + картку
 */
async function handleSuccessfulPayment(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const starsAmount = ctx.message.successful_payment.total_amount;

  // Зберігаємо платіж
  savePayment(userId, starsAmount, 'completed');

  await ctx.reply('💸 *Оплата отримана! Починаю генерувати твій токсичний рост...*', {
    parse_mode: 'Markdown',
  });

  // Генеруємо токсичний рост
  // Беремо останній текст від юзера із сесії (зберігаємо в ctx.session або просто без тексту)
  const userText = ctx.session?.lastText || 'Людина без опису';

  let roastText;
  try {
    const photoBase64 = ctx.session?.lastPhotoBase64 || null;
    const mimeType = ctx.session?.lastMimeType || 'image/jpeg';
    roastText = await generateRoast('paid', userText, photoBase64, mimeType);
  } catch (err) {
    console.error('Помилка генерації платного росту:', err.message);
    return ctx.reply('😵 Помилка генерації. Зверніться в підтримку — ми повернемо Stars!');
  }

  // Генеруємо картку
  let card;
  try {
    card = await generateCard(roastText, username);
  } catch (err) {
    console.error('Помилка генерації картки:', err.message);
    // Відправляємо рост без картки
    await ctx.reply(
      `🔥 *Твій токсичний рост:*\n\n${roastText}\n\n_Картку не вдалося згенерувати, але рост — ось!_`,
      { parse_mode: 'Markdown' }
    );
    saveRoast(userId, 'paid', roastText, null);
    return;
  }

  // Зберігаємо рост
  saveRoast(userId, 'paid', roastText, card.filePath);

  // Відправляємо картку як фото
  await ctx.replyWithPhoto(
    { source: card.buffer, filename: card.filename },
    {
      caption:
        `🔥 *Твій токсичний рост:*\n\n${roastText}\n\n` +
        `_@RoastUaBot · заростити себе_`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📤 Поділитися в Stories',
              url: `https://t.me/share/url?url=${encodeURIComponent('https://t.me/RoastUaBot')}&text=${encodeURIComponent('Мене заростили 🔥 Спробуй сам!')}`,
            },
          ],
          [
            {
              text: '🔁 Заростити ще раз',
              callback_data: 'roast_me',
            },
          ],
        ],
      },
    }
  );

  // Очищаємо сесію
  if (ctx.session) {
    ctx.session.lastText = null;
    ctx.session.lastPhotoBase64 = null;
  }
}

module.exports = {
  sendRoastInvoice,
  handlePayRoastCallback,
  handlePreCheckout,
  handleSuccessfulPayment,
};
