#!/bin/bash
# Roast Bot — повний деплой на сервер одним скриптом
# Запуск: bash <(curl -s https://...) або скопіювати і вставити в термінал

set -e
echo "=== Roast Bot Deploy ==="

# ── 1. Node.js 22 ─────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 22 ]]; then
  echo "[1/6] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
  apt-get install -y nodejs > /dev/null 2>&1
fi
echo "[1/6] Node.js: $(node -v)"

# ── 2. pm2 ────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "[2/6] Installing pm2..."
  npm install -g pm2 > /dev/null 2>&1
fi
echo "[2/6] pm2: $(pm2 -v)"

# ── 3. Структура папок ────────────────────────────────────────
echo "[3/6] Creating directories..."
mkdir -p /opt/roast-bot/{src/{services,handlers,prompts},db,logs,cards}

# ── 4. Файли проєкту ──────────────────────────────────────────
echo "[4/6] Writing project files..."

cat > /opt/roast-bot/package.json << 'ENDOFFILE'
{
  "name": "roast-bot",
  "version": "1.0.0",
  "main": "src/bot.js",
  "scripts": {
    "start": "node --experimental-sqlite src/bot.js"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "groq-sdk": "^0.9.1",
    "satori": "^0.10.13",
    "@resvg/resvg-js": "^2.6.2",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.5"
  }
}
ENDOFFILE

cat > /opt/roast-bot/ecosystem.config.js << 'ENDOFFILE'
module.exports = {
  apps: [{
    name: 'roast-bot',
    script: 'src/bot.js',
    node_args: '--experimental-sqlite',
    restart_delay: 3000,
    max_restarts: 10,
    autorestart: true,
    watch: false,
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
ENDOFFILE

cat > /opt/roast-bot/.env << 'ENDOFFILE'
BOT_TOKEN=8320352009:AAF7RqLaQBbJDLFpiWLLHMce0YDoTzBVH9c
GROQ_API_KEY=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
DATABASE_PATH=/opt/roast-bot/db/roast.db
ENDOFFILE

cat > /opt/roast-bot/src/prompts/system.js << 'ENDOFFILE'
const FREE_SYSTEM_PROMPT = `Ти — саркастичний Ukrainian comedian bot. Твоє завдання — зробити легкий жартівливий "рост" (розбір) людини.

ПРАВИЛА:
- Тон: легкий сарказм та гумор, НЕ образливо
- Довжина: рівно 2-3 речення, не більше
- Мова: українська
- Жарти мають бути про поведінку, звички, стиль — НЕ про фізичні недоліки
- НЕ згадуй вагу, зовнішність у принизливому контексті
- НЕ використовуй расові, етнічні, релігійні, гендерні стереотипи
- НЕ згадуй інвалідність, самогубство, самопошкодження

Відповідай ТІЛЬКИ текстом росту, без пояснень.`;

const PAID_SYSTEM_PROMPT = `Ти — максимально токсичний Ukrainian comedian bot. Твоє завдання — зробити ЖОРСТКИЙ саркастичний "рост".

ПРАВИЛА:
- Тон: максимальний сарказм, дошкульно, але гумор — НЕ реальна образа
- Довжина: рівно 5-6 речень
- Мова: українська (можна молодіжний сленг)
- НЕ расові, етнічні, релігійні, гендерні стереотипи
- НЕ інвалідність, самогубство, самопошкодження
- Можна гіперболу для комічного ефекту

Відповідай ТІЛЬКИ текстом росту, без пояснень.`;

const MODERATION_SYSTEM_PROMPT = `Ти — модератор контенту. Проаналізуй зображення та відповідай ТІЛЬКИ у форматі JSON:
{"safe": true/false, "reason": "причина якщо не safe", "hasMinor": true/false}

Перевір: неповнолітні на фото, NSFW контент, чи є взагалі людина.
Відповідай ТІЛЬКИ валідним JSON.`;

module.exports = { FREE_SYSTEM_PROMPT, PAID_SYSTEM_PROMPT, MODERATION_SYSTEM_PROMPT };
ENDOFFILE

cat > /opt/roast-bot/src/services/ai.js << 'ENDOFFILE'
const Groq = require('groq-sdk');
const { FREE_SYSTEM_PROMPT, PAID_SYSTEM_PROMPT, MODERATION_SYSTEM_PROMPT } = require('../prompts/system');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function generateRoast(tier, userDescription, photoBase64 = null, mimeType = 'image/jpeg') {
  const systemPrompt = tier === 'paid' ? PAID_SYSTEM_PROMPT : FREE_SYSTEM_PROMPT;

  if (photoBase64) {
    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${photoBase64}` } },
          { type: 'text', text: userDescription ? `Фото людини. Додатково: "${userDescription}". Зроби рост!` : 'Ось фото. Зроби рост!' },
        ]},
      ],
      temperature: 0.9,
      max_tokens: 512,
    });
    return response.choices[0].message.content.trim();
  }

  const response = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Людина описує себе: "${userDescription}". Зроби рост!` },
    ],
    temperature: 0.9,
    max_tokens: 512,
  });
  return response.choices[0].message.content.trim();
}

async function moderatePhoto(photoBase64, mimeType = 'image/jpeg') {
  try {
    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: MODERATION_SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${photoBase64}` } },
          { type: 'text', text: 'Проаналізуй.' },
        ]},
      ],
      temperature: 0.1,
      max_tokens: 128,
    });
    const raw = response.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\{.*\}/s);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { safe: true };
  } catch (err) {
    console.error('Moderation error:', err.message);
    return { safe: true };
  }
}

module.exports = { generateRoast, moderatePhoto };
ENDOFFILE

cat > /opt/roast-bot/src/services/db.js << 'ENDOFFILE'
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './db/roast.db';
const dbDir = path.dirname(path.resolve(dbPath));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(path.resolve(dbPath));

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY, username TEXT,
      free_roast_used_at TEXT, referred_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS roasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER,
      tier TEXT CHECK(tier IN ('free','paid')), text TEXT, image_path TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER,
      stars_amount INTEGER, status TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS stats (key TEXT PRIMARY KEY, value INTEGER DEFAULT 0);
    INSERT OR IGNORE INTO stats (key, value) VALUES ('total_roasts', 0);
  `);
  console.log('DB initialized');
}

function getOrCreateUser(telegramId, username, referredBy = null) {
  db.prepare('INSERT OR IGNORE INTO users (telegram_id, username, referred_by) VALUES (?, ?, ?)').run(telegramId, username || null, referredBy || null);
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

function canUseFreeTier(telegramId) {
  const user = db.prepare('SELECT free_roast_used_at FROM users WHERE telegram_id = ?').get(telegramId);
  if (!user || !user.free_roast_used_at) return true;
  return (new Date() - new Date(user.free_roast_used_at)) / 3600000 >= 24;
}

function markFreeRoastUsed(telegramId) {
  db.prepare("UPDATE users SET free_roast_used_at = datetime('now') WHERE telegram_id = ?").run(telegramId);
}

function saveRoast(telegramId, tier, text, imagePath = null) {
  const r = db.prepare('INSERT INTO roasts (telegram_id, tier, text, image_path) VALUES (?, ?, ?, ?)').run(telegramId, tier, text, imagePath);
  db.prepare('UPDATE stats SET value = value + 1 WHERE key = ?').run('total_roasts');
  return r.lastInsertRowid;
}

function getTotalRoasts() {
  const row = db.prepare('SELECT value FROM stats WHERE key = ?').get('total_roasts');
  return row ? Number(row.value) : 0;
}

function getTopRoastsToday() {
  return db.prepare(`SELECT text, created_at FROM roasts WHERE tier = 'paid' AND date(created_at) = date('now') ORDER BY length(text) DESC LIMIT 10`).all();
}

function savePayment(telegramId, starsAmount, status) {
  return db.prepare('INSERT INTO payments (telegram_id, stars_amount, status) VALUES (?, ?, ?)').run(telegramId, starsAmount, status);
}

function processReferral(newUserId, referrerId) {
  if (!referrerId || newUserId === referrerId) return;
  db.prepare('UPDATE users SET free_roast_used_at = NULL WHERE telegram_id = ?').run(referrerId);
}

module.exports = { initDatabase, getOrCreateUser, canUseFreeTier, markFreeRoastUsed, saveRoast, getTotalRoasts, getTopRoastsToday, savePayment, processReferral };
ENDOFFILE

cat > /opt/roast-bot/src/services/moderation.js << 'ENDOFFILE'
const requestLog = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60000;

function checkRateLimit(telegramId) {
  const now = Date.now();
  const recent = (requestLog.get(telegramId) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  requestLog.set(telegramId, recent);
  return recent.length <= RATE_LIMIT;
}

function cleanRateLog() {
  const now = Date.now();
  for (const [id, ts] of requestLog.entries()) {
    const r = ts.filter(t => now - t < RATE_WINDOW_MS);
    if (r.length === 0) requestLog.delete(id); else requestLog.set(id, r);
  }
}

module.exports = { checkRateLimit, cleanRateLog };
ENDOFFILE

cat > /opt/roast-bot/src/services/card.js << 'ENDOFFILE'
const satori = require('satori').default || require('satori');
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const THEMES = [
  { bg: '#0f0f1a', accent: '#ff3c6e', text: '#ffffff', sub: '#ff7fa8' },
  { bg: '#0d1117', accent: '#f0a500', text: '#ffffff', sub: '#ffd166' },
  { bg: '#1a0a2e', accent: '#9b5de5', text: '#ffffff', sub: '#c77dff' },
  { bg: '#0a1628', accent: '#00b4d8', text: '#ffffff', sub: '#90e0ef' },
];

async function generateCard(roastText, username) {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const displayName = username ? `@${username}` : 'Анонімус';

  const element = {
    type: 'div',
    props: {
      style: { width:'1080px', height:'1920px', backgroundColor:theme.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px', position:'relative' },
      children: [
        { type:'div', props:{ style:{ fontSize:'120px', marginBottom:'40px' }, children:'🔥' } },
        { type:'div', props:{ style:{ fontSize:'52px', fontWeight:'bold', color:theme.accent, marginBottom:'60px', letterSpacing:'4px' }, children:'РОСТ' } },
        { type:'div', props:{ style:{ background:`${theme.accent}15`, border:`2px solid ${theme.accent}40`, borderRadius:'24px', padding:'60px', maxWidth:'900px', marginBottom:'60px' },
          children:{ type:'div', props:{ style:{ fontSize:'44px', color:theme.text, lineHeight:'1.5', textAlign:'center', fontStyle:'italic' }, children:`"${roastText}"` } } } },
        { type:'div', props:{ style:{ fontSize:'38px', color:theme.sub, marginBottom:'40px' }, children:displayName } },
        { type:'div', props:{ style:{ position:'absolute', bottom:'60px', fontSize:'28px', color:`${theme.text}60` }, children:'@RoastUaBot · заростити себе' } },
      ],
    },
  };

  const svg = await satori(element, { width:1080, height:1920, fonts:[] });
  const resvg = new Resvg(svg, { fitTo:{ mode:'width', value:1080 } });
  const pngBuffer = resvg.render().asPng();

  const cardsDir = path.join(__dirname, '../../cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });
  const filename = `roast_${crypto.randomBytes(8).toString('hex')}.png`;
  const filePath = path.join(cardsDir, filename);
  fs.writeFileSync(filePath, pngBuffer);
  return { buffer: pngBuffer, filePath, filename };
}

module.exports = { generateCard };
ENDOFFILE

cat > /opt/roast-bot/src/handlers/start.js << 'ENDOFFILE'
const { getTotalRoasts, getOrCreateUser, processReferral } = require('../services/db');

async function handleStart(ctx) {
  const user = ctx.from;
  let referrerId = null;
  const payload = ctx.message?.text?.split(' ')[1];
  if (payload?.startsWith('ref_')) referrerId = parseInt(payload.replace('ref_', ''), 10);

  const dbUser = getOrCreateUser(user.id, user.username, referrerId);
  if (referrerId && !dbUser.referred_by) processReferral(user.id, referrerId);

  const count = getTotalRoasts().toLocaleString('uk-UA');
  const name = user.first_name || 'друже';

  await ctx.reply(
    `🔥 *Привіт, ${name}!*\n\nЯ заросту тебе так, що сам засмієшся 😈\n\n` +
    `📸 *Як це працює:*\n1. Надішли фото або опиши себе\n2. Отримай *безкоштовний рост* (1 раз на добу)\n` +
    `3. Хочеш жорсткіше? *Токсична версія за 50 ⭐ Stars*\n4. Отримай картку для Stories 📲\n\n` +
    `🔢 Уже заросили *${count}* людей\n\n😉 _Це гумор, не сприймай серйозно_`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: '🔥 Заростити мене!', callback_data: 'roast_me' }],
      [{ text: '📊 Топ ростів дня', callback_data: 'top_roasts' }],
    ]}}
  );
}

async function handleRoastMeButton(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply('📸 Надішли *своє фото* або *опиши себе* — і я тебе заросту!', { parse_mode: 'Markdown' });
}

module.exports = { handleStart, handleRoastMeButton };
ENDOFFILE

cat > /opt/roast-bot/src/handlers/roast.js << 'ENDOFFILE'
const { generateRoast, moderatePhoto } = require('../services/ai');
const { checkRateLimit } = require('../services/moderation');
const { canUseFreeTier, markFreeRoastUsed, saveRoast, getOrCreateUser } = require('../services/db');

const STARS_PRICE = 50;

async function processRoastRequest(ctx, photoBase64 = null, mimeType = null, userText = '') {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  getOrCreateUser(userId, username);

  if (!checkRateLimit(userId)) {
    return ctx.reply('⏳ Максимум 5 запитів на хвилину. Перепочинь трохи!');
  }

  if (photoBase64) {
    const loading = await ctx.reply('🔍 Аналізую фото...');
    const mod = await moderatePhoto(photoBase64, mimeType);
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    if (!mod.safe) {
      return ctx.reply(mod.hasMinor
        ? '🚫 На фото схожа на неповнолітню особа — не можу обробити.'
        : '🚫 Контент не відповідає правилам. Спробуй інше фото!');
    }
  }

  const canFree = canUseFreeTier(userId);
  if (!canFree) {
    return ctx.reply(
      '🔒 *Безкоштовний рост на сьогодні вже використано!*\n\nКупи токсичну версію 😏',
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
        { text: `🔥 Токсична версія за ${STARS_PRICE} ⭐`, callback_data: 'start_payment' }
      ]]}}
    );
  }

  const thinking = await ctx.reply('✍️ Пишу твій рост...');
  let roastText;
  try {
    roastText = await generateRoast('free', userText, photoBase64, mimeType);
  } catch (err) {
    console.error('AI error:', err.message);
    await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
    return ctx.reply('😵 Щось пішло не так. Спробуй ще раз!');
  }
  await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});

  saveRoast(userId, 'free', roastText);
  markFreeRoastUsed(userId);

  await ctx.reply(
    `🎯 *Твій рост:*\n\n${roastText}`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: `🔥 Токсична версія за ${STARS_PRICE} ⭐ Stars`, callback_data: 'start_payment' }],
      [{ text: '📤 Поділитися', switch_inline_query: roastText.slice(0, 100) }],
    ]}}
  );
}

module.exports = { processRoastRequest };
ENDOFFILE

cat > /opt/roast-bot/src/handlers/photo.js << 'ENDOFFILE'
const { processRoastRequest } = require('./roast');
const https = require('https');

async function downloadTelegramFile(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function handlePhoto(ctx) {
  try {
    await ctx.reply('📥 Отримав фото! Зараз заросту тебе...');
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const photoBase64 = await downloadTelegramFile(ctx, best.file_id);
    await processRoastRequest(ctx, photoBase64, 'image/jpeg', ctx.message.caption || '');
  } catch (err) {
    console.error('Photo error:', err.message);
    await ctx.reply('😵 Не вдалося завантажити фото. Спробуй ще раз!');
  }
}

module.exports = { handlePhoto };
ENDOFFILE

cat > /opt/roast-bot/src/handlers/text.js << 'ENDOFFILE'
const { processRoastRequest } = require('./roast');
const IGNORED = ['/start', '/top', '/help'];

async function handleText(ctx) {
  const text = ctx.message.text?.trim() || '';
  if (IGNORED.some(c => text.startsWith(c))) return;
  if (text.length < 5) {
    return ctx.reply('🤔 Напиши трохи більше про себе!\n\n_Наприклад: "Я фрілансер, який завжди дедлайнить в останній момент"_', { parse_mode: 'Markdown' });
  }
  if (ctx.session) ctx.session.lastText = text;
  await processRoastRequest(ctx, null, null, text);
}

module.exports = { handleText };
ENDOFFILE

cat > /opt/roast-bot/src/handlers/payment.js << 'ENDOFFILE'
const { generateRoast } = require('../services/ai');
const { generateCard } = require('../services/card');
const { saveRoast, savePayment, getOrCreateUser } = require('../services/db');

const STARS_PRICE = 50;

async function sendRoastInvoice(ctx) {
  getOrCreateUser(ctx.from.id, ctx.from.username);
  await ctx.telegram.sendInvoice(ctx.chat.id, {
    title: '🔥 Токсичний рост',
    description: 'Максимально токсичний саркастичний розбір + картка для Stories (1080x1920)',
    payload: `toxic_roast_${ctx.from.id}_${Date.now()}`,
    currency: 'XTR',
    provider_token: '',
    prices: [{ label: 'Токсичний рост + Stories картка', amount: STARS_PRICE }],
  });
}

async function handlePayRoastCallback(ctx) {
  await ctx.answerCbQuery('Відкриваю оплату! 💫');
  await sendRoastInvoice(ctx);
}

async function handlePreCheckout(ctx) {
  await ctx.answerPreCheckoutQuery(true);
}

async function handleSuccessfulPayment(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  savePayment(userId, ctx.message.successful_payment.total_amount, 'completed');

  await ctx.reply('💸 *Оплата отримана! Генерую токсичний рост...*', { parse_mode: 'Markdown' });

  const userText = ctx.session?.lastText || 'Людина без опису';
  let roastText;
  try {
    roastText = await generateRoast('paid', userText, ctx.session?.lastPhotoBase64 || null);
  } catch (err) {
    return ctx.reply('😵 Помилка генерації. Зверніться в підтримку!');
  }

  let card;
  try { card = await generateCard(roastText, username); } catch (err) {
    saveRoast(userId, 'paid', roastText);
    return ctx.reply(`🔥 *Твій токсичний рост:*\n\n${roastText}`, { parse_mode: 'Markdown' });
  }

  saveRoast(userId, 'paid', roastText, card.filePath);
  await ctx.replyWithPhoto(
    { source: card.buffer, filename: card.filename },
    { caption: `🔥 *Твій токсичний рост:*\n\n${roastText}\n\n_@RoastUaBot · заростити себе_`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '📤 Поділитися в Stories', url: `https://t.me/share/url?url=${encodeURIComponent('https://t.me/RoastUaBot')}&text=${encodeURIComponent('Мене заростили 🔥')}` }],
        [{ text: '🔁 Ще раз', callback_data: 'roast_me' }],
      ]}
    }
  );
}

module.exports = { sendRoastInvoice, handlePayRoastCallback, handlePreCheckout, handleSuccessfulPayment };
ENDOFFILE

cat > /opt/roast-bot/src/handlers/top.js << 'ENDOFFILE'
const { getTopRoastsToday } = require('../services/db');

async function handleTop(ctx) {
  const top = getTopRoastsToday();
  if (!top || top.length === 0) {
    return ctx.reply('📊 *Топ ростів дня*\n\n_Сьогодні ще ніхто не купив токсичний рост. Будь першим! 🔥_', { parse_mode: 'Markdown' });
  }
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
  let msg = '🔥 *Топ-10 найжорсткіших ростів дня* (анонімно)\n\n';
  top.forEach((r, i) => {
    const preview = r.text.length > 120 ? r.text.slice(0, 120) + '...' : r.text;
    msg += `${medals[i] || i+1} _${preview}_\n\n`;
  });
  msg += '💬 _Хочеш потрапити в топ? Замов токсичний рост!_';
  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔥 Заростити мене!', callback_data: 'roast_me' }]] }});
}

module.exports = { handleTop };
ENDOFFILE

cat > /opt/roast-bot/src/cron.js << 'ENDOFFILE'
const cron = require('node-cron');
const { cleanRateLog } = require('./services/moderation');

function startCronJobs() {
  cron.schedule('*/5 * * * *', () => { cleanRateLog(); });
  console.log('Cron jobs started');
}

module.exports = { startCronJobs };
ENDOFFILE

cat > /opt/roast-bot/src/bot.js << 'ENDOFFILE'
require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { initDatabase } = require('./services/db');
const { startCronJobs } = require('./cron');
const { handleStart, handleRoastMeButton } = require('./handlers/start');
const { handlePhoto } = require('./handlers/photo');
const { handleText } = require('./handlers/text');
const { handleTop } = require('./handlers/top');
const { handlePayRoastCallback, handlePreCheckout, handleSuccessfulPayment, sendRoastInvoice } = require('./handlers/payment');

if (!process.env.BOT_TOKEN) { console.error('BOT_TOKEN missing!'); process.exit(1); }
if (!process.env.GROQ_API_KEY) { console.error('GROQ_API_KEY missing!'); process.exit(1); }

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session({ defaultSession: () => ({ lastText: null, lastPhotoBase64: null }) }));

bot.use(async (ctx, next) => {
  console.log(`[${new Date().toISOString()}] ${ctx.updateType} from @${ctx.from?.username || ctx.from?.id}`);
  await next();
});

bot.command('start', handleStart);
bot.command('top', handleTop);
bot.command('help', ctx => ctx.reply('📸 Надішли фото або опиши себе — отримаєш рост!\n/top — топ ростів дня'));

bot.on('photo', async ctx => {
  if (ctx.session) ctx.session.lastText = ctx.message.caption || '';
  await handlePhoto(ctx);
});

bot.on('text', async ctx => {
  if (ctx.session) ctx.session.lastText = ctx.message.text;
  await handleText(ctx);
});

bot.action('roast_me', handleRoastMeButton);
bot.action('top_roasts', async ctx => { await ctx.answerCbQuery(); await handleTop(ctx); });
bot.action('start_payment', handlePayRoastCallback);

bot.on('pre_checkout_query', handlePreCheckout);
bot.on('message', async (ctx, next) => {
  if (ctx.message?.successful_payment) return handleSuccessfulPayment(ctx);
  return next();
});

bot.catch((err, ctx) => {
  console.error('Bot error:', err.message);
  ctx.reply('😵 Щось пішло не так. Спробуй ще раз!').catch(() => {});
});

initDatabase();
startCronJobs();

bot.launch().then(() => {
  console.log('Bot started!');
}).catch(err => {
  console.error('Launch error:', err.message);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
ENDOFFILE

# ── 5. npm install ─────────────────────────────────────────────
echo "[5/6] Running npm install..."
cd /opt/roast-bot && npm install --omit=dev 2>&1 | tail -3

# ── 6. Запуск через pm2 ────────────────────────────────────────
echo "[6/6] Starting bot via pm2..."
pm2 delete roast-bot 2>/dev/null || true
cd /opt/roast-bot && pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | grep "sudo\|systemctl" | bash 2>/dev/null || true

echo ""
echo "=== DONE ==="
pm2 status
echo ""
echo "Logs: pm2 logs roast-bot --lines 30"
