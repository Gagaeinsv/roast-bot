// src/services/ai.js
// Groq AI — прямі HTTP запити через axios (без groq-sdk, уникає fetch-баг Node.js 22)

const axios = require('axios');
const { FREE_SYSTEM_PROMPT, PAID_SYSTEM_PROMPT, MODERATION_SYSTEM_PROMPT } = require('../prompts/system');

const TEXT_MODEL   = 'llama-3.1-8b-instant';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Загальний виклик Groq API
 */
async function callGroq(model, messages, temperature = 0.9, maxTokens = 512) {
  const res = await axios.post(GROQ_URL, {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  }, { headers: headers(), timeout: 30000 });

  return res.data.choices[0].message.content.trim();
}

/**
 * Генерує рост (текст або vision)
 */
async function generateRoast(tier, userDescription, photoBase64 = null, mimeType = 'image/jpeg') {
  const systemPrompt = tier === 'paid' ? PAID_SYSTEM_PROMPT : FREE_SYSTEM_PROMPT;

  if (photoBase64) {
    const userContent = [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${photoBase64}` } },
      { type: 'text', text: userDescription
          ? `Фото людини. Додатково: "${userDescription}". Зроби рост!`
          : 'Ось фото. Зроби рост на основі того що бачиш!' },
    ];
    return callGroq(VISION_MODEL, [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userContent },
    ]);
  }

  return callGroq(TEXT_MODEL, [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: `Людина описує себе: "${userDescription}". Зроби рост!` },
  ]);
}

/**
 * Модерація фото
 */
async function moderatePhoto(photoBase64, mimeType = 'image/jpeg') {
  try {
    const result = await callGroq(VISION_MODEL, [
      { role: 'system', content: MODERATION_SYSTEM_PROMPT },
      { role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${photoBase64}` } },
        { type: 'text', text: 'Проаналізуй.' },
      ]},
    ], 0.1, 128);

    const match = result.match(/\{.*\}/s);
    if (match) return JSON.parse(match[0]);
    return { safe: true };
  } catch (err) {
    console.error('Moderation error:', err.message);
    return { safe: true };
  }
}

module.exports = { generateRoast, moderatePhoto };
