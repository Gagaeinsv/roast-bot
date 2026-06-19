// src/services/card.js
// Генерація PNG картки для Stories (1080x1920) через satori + resvg

const satori = require('satori').default || require('satori');
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Кольорові теми фону (4 варіанти)
const THEMES = [
  { bg: '#0f0f1a', accent: '#ff3c6e', text: '#ffffff', sub: '#ff7fa8' },
  { bg: '#0d1117', accent: '#f0a500', text: '#ffffff', sub: '#ffd166' },
  { bg: '#1a0a2e', accent: '#9b5de5', text: '#ffffff', sub: '#c77dff' },
  { bg: '#0a1628', accent: '#00b4d8', text: '#ffffff', sub: '#90e0ef' },
];

// Шрифт Inter (завантажуємо з файлу або вбудовуємо)
let fontData = null;

async function getFontData() {
  if (fontData) return fontData;
  // Використовуємо Inter Bold зі стандартного місця або завантажуємо
  const fontPath = path.join(__dirname, '../../assets/Inter-Bold.woff');
  if (fs.existsSync(fontPath)) {
    fontData = fs.readFileSync(fontPath);
  } else {
    // Якщо шрифту немає — повертаємо null (satori використає fallback)
    fontData = null;
  }
  return fontData;
}

/**
 * Генерує PNG картку з ростом
 * @param {string} roastText - текст росту
 * @param {string} username - нікнейм юзера
 * @returns {Buffer} - PNG буфер
 */
async function generateCard(roastText, username) {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const font = await getFontData();

  // Обрізаємо нікнейм
  const displayName = username ? `@${username}` : 'Анонімус';

  // JSX-структура через satori (React-like об'єкти)
  const element = {
    type: 'div',
    props: {
      style: {
        width: '1080px',
        height: '1920px',
        backgroundColor: theme.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px',
        position: 'relative',
        fontFamily: 'Inter, sans-serif',
      },
      children: [
        // Декоративне коло вгорі
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '-200px',
              right: '-200px',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              backgroundColor: `${theme.accent}22`,
              display: 'flex',
            },
            children: [],
          },
        },
        // Декоративне коло внизу
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '-150px',
              left: '-150px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              backgroundColor: `${theme.accent}11`,
              display: 'flex',
            },
            children: [],
          },
        },
        // Значок вогню вгорі
        {
          type: 'div',
          props: {
            style: {
              fontSize: '120px',
              marginBottom: '40px',
              display: 'flex',
            },
            children: '🔥',
          },
        },
        // Заголовок
        {
          type: 'div',
          props: {
            style: {
              fontSize: '52px',
              fontWeight: 'bold',
              color: theme.accent,
              marginBottom: '60px',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              display: 'flex',
            },
            children: 'РОСТ',
          },
        },
        // Блок з текстом росту
        {
          type: 'div',
          props: {
            style: {
              backgroundColor: `${theme.accent}15`,
              border: `2px solid ${theme.accent}40`,
              borderRadius: '24px',
              padding: '60px',
              maxWidth: '900px',
              marginBottom: '60px',
              display: 'flex',
            },
            children: {
              type: 'div',
              props: {
                style: {
                  fontSize: '48px',
                  color: theme.text,
                  lineHeight: '1.5',
                  textAlign: 'center',
                  fontStyle: 'italic',
                  display: 'flex',
                },
                children: `"${roastText}"`,
              },
            },
          },
        },
        // Нікнейм юзера
        {
          type: 'div',
          props: {
            style: {
              fontSize: '38px',
              color: theme.sub,
              marginBottom: '40px',
              display: 'flex',
            },
            children: displayName,
          },
        },
        // Watermark бота
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '60px',
              fontSize: '30px',
              color: `${theme.text}60`,
              letterSpacing: '2px',
              display: 'flex',
            },
            children: '@RoastUaBot · заростити себе',
          },
        },
      ],
    },
  };

  // Рендеримо SVG через satori
  const fonts = font
    ? [{ name: 'Inter', data: font, weight: 700, style: 'normal' }]
    : [];

  const svg = await satori(element, {
    width: 1080,
    height: 1920,
    fonts,
  });

  // Конвертуємо SVG → PNG через resvg
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // Зберігаємо файл
  const cardsDir = path.join(__dirname, '../../cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const filename = `roast_${crypto.randomBytes(8).toString('hex')}.png`;
  const filePath = path.join(cardsDir, filename);
  fs.writeFileSync(filePath, pngBuffer);

  return { buffer: pngBuffer, filePath, filename };
}

module.exports = { generateCard };
