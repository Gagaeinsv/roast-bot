// src/handlers/photo.js
// Обробка вхідних фото від юзера

const { processRoastRequest } = require('./roast');
const axios = require('https');
const https = require('https');

/**
 * Завантажує файл з Telegram і конвертує в base64
 */
async function downloadTelegramFile(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  return new Promise((resolve, reject) => {
    https.get(fileUrl, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function handlePhoto(ctx) {
  try {
    await ctx.reply('📥 Отримав фото! Зараз заросту тебе...');
    const photos = ctx.message.photo;
    // Беремо середній розмір (не найбільший) щоб не перевантажити API
    const photo = photos.length >= 3 ? photos[photos.length - 2] : photos[photos.length - 1];
    const photoBase64 = await downloadTelegramFile(ctx, photo.file_id);
    await processRoastRequest(ctx, photoBase64, 'image/jpeg', ctx.message.caption || '');
  } catch (err) {
    console.error('Photo error:', err.message);
    await ctx.reply('😵 Не вдалося завантажити фото. Спробуй ще раз!');
  }
}

module.exports = { handlePhoto };
