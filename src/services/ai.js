// src/services/ai.js
// Groq AI — прямі HTTP запити через axios (без groq-sdk, уникає fetch-баг Node.js 22)

const axios = require('axios');
const { FREE_SYSTEM_PROMPT, PAID_SYSTEM_PROMPT } = require('../prompts/system');

const TEXT_MODEL   = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
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
 * Генерує рост (текст або vision з fallback на текст)
 */
async function generateRoast(tier, userDescription, photoBase64 = null, mimeType = 'image/jpeg') {
  const systemPrompt = tier === 'paid' ? PAID_SYSTEM_PROMPT : FREE_SYSTEM_PROMPT;

  if (photoBase64) {
    try {
      const userContent = [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${photoBase64}` } },
        { type: 'text', text: userDescription
            ? `Фото людини. Додатково: "${userDescription}". Зроби рост!`
            : 'Ось фото. Зроби рост на основі того що бачиш!' },
      ];
      return await callGroq(VISION_MODEL, [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent },
      ]);
    } catch (err) {
      console.error('Vision failed, fallback to text:', err.message);
      // Fallback — генеруємо рост без фото
      const desc = userDescription || 'людина яка надіслала фото але не пояснила хто вона';
      return await callGroq(TEXT_MODEL, [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Людина надіслала фото. Опис: "${desc}". Зроби рост!` },
      ]);
    }
  }

  return callGroq(TEXT_MODEL, [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: `Людина описує себе: "${userDescription}". Зроби рост!` },
  ]);
}

/**
 * Модерація фото — вимкнена для MVP (завжди safe)
 */
async function moderatePhoto() {
  return { safe: true };
}

module.exports = { generateRoast, moderatePhoto };
