// src/services/ai.js
// Groq AI сервіс — генерація ростів та модерація

const Groq = require('groq-sdk');
const { FREE_SYSTEM_PROMPT, PAID_SYSTEM_PROMPT, MODERATION_SYSTEM_PROMPT } = require('../prompts/system');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Модель для тексту (швидка та безкоштовна)
const TEXT_MODEL = 'llama-3.3-70b-versatile';
// Модель для vision (аналіз фото)
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/**
 * Генерує рост на основі тексту або фото
 * @param {string} tier - 'free' або 'paid'
 * @param {string} userDescription - текстовий опис від юзера
 * @param {string|null} photoBase64 - фото у base64 (опціонально)
 * @param {string|null} mimeType - MIME тип фото (image/jpeg тощо)
 */
async function generateRoast(tier, userDescription, photoBase64 = null, mimeType = 'image/jpeg') {
  const systemPrompt = tier === 'paid' ? PAID_SYSTEM_PROMPT : FREE_SYSTEM_PROMPT;

  // Якщо є фото — використовуємо vision модель
  if (photoBase64) {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${photoBase64}` },
          },
          {
            type: 'text',
            text: userDescription
              ? `Ось фото людини. Додаткова інформація від неї: "${userDescription}". Зроби рост!`
              : 'Ось фото людини. Зроби рост на основі того, що бачиш!',
          },
        ],
      },
    ];

    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages,
      temperature: 0.9,
      max_tokens: 512,
    });

    return response.choices[0].message.content.trim();
  }

  // Без фото — тільки текст
  const response = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Людина описує себе так: "${userDescription}". Зроби рост!`,
      },
    ],
    temperature: 0.9,
    max_tokens: 512,
  });

  return response.choices[0].message.content.trim();
}

/**
 * Модерація фото перед обробкою
 * Повертає { safe, reason, hasMinor }
 */
async function moderatePhoto(photoBase64, mimeType = 'image/jpeg') {
  try {
    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: MODERATION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${photoBase64}` },
            },
            { type: 'text', text: 'Проаналізуй це зображення.' },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 128,
    });

    const raw = response.choices[0].message.content.trim();
    // Парсимо JSON з відповіді
    const jsonMatch = raw.match(/\{.*\}/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // Якщо не вдалося розпарсити — дозволяємо (fail-open для зручності)
    return { safe: true };
  } catch (err) {
    console.error('Помилка модерації:', err.message);
    return { safe: true };
  }
}

module.exports = { generateRoast, moderatePhoto };
