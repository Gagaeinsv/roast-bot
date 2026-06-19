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
    await ctx.reply('📥 Отримав фото! Зараз зроблю тебе зіркою росту...');

    // Беремо найбільше фото з масиву
    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];

    // Завантажуємо та конвертуємо в base64
    const photoBase64 = await downloadTelegramFile(ctx, bestPhoto.file_id);

    // Текст-підпис якщо є
    const caption = ctx.message.caption || '';

    await processRoastRequest(ctx, photoBase64, 'image/jpeg', caption);
  } catch (err) {
    console.error('Помилка обробки фото:', err.message);
    await ctx.reply('😵 Не вдалося завантажити фото. Спробуй ще раз!');
  }
}

module.exports = { handlePhoto };
