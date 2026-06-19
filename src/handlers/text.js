// src/handlers/text.js
// Обробка текстових повідомлень від юзера

const { processRoastRequest } = require('./roast');

// Команди які НЕ треба обробляти як текст для росту
const IGNORED_COMMANDS = ['/start', '/top', '/help'];

// Мінімальна довжина тексту для росту
const MIN_TEXT_LENGTH = 5;

async function handleText(ctx) {
  const text = ctx.message.text?.trim() || '';

  // Ігноруємо команди
  if (IGNORED_COMMANDS.some(cmd => text.startsWith(cmd))) return;

  // Текст занадто короткий
  if (text.length < MIN_TEXT_LENGTH) {
    return ctx.reply(
      '🤔 Напиши трохи більше про себе!\n\n' +
      '_Наприклад: "Я фрілансер, який завжди дедлайнить в останній момент і п\'є третю каву о 2 ночі"_',
      { parse_mode: 'Markdown' }
    );
  }

  await processRoastRequest(ctx, null, null, text);
}

module.exports = { handleText };
