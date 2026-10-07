import express from 'express';
import cors from 'cors';
import { Telegraf, Markup } from 'telegraf';
import crypto from 'crypto';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ============ Валидация initData от Telegram ============
function validateInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  } catch (e) {
    return false;
  }
}

// ============ Игровая логика (в памяти, для продакшена — БД) ============
const users = new Map();

function getUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      balance: 0,
      level: 1,
      xp: 0,
      energy: 1000,
      tapPower: 2,
      combo: 1,
      upgrades: {
        clickPower: 1,
        autoClicker: 0,
        critChance: 0,
        multiplier: 1,
      },
    });
  }
  return users.get(userId);
}

// ============ API ============
app.get('/health', (req, res) => res.send('OK'));

app.post('/api/user', (req, res) => {
  const { initData } = req.body;
  if (!validateInitData(initData)) {
    return res.status(401).json({ error: 'Invalid initData' });
  }

  const params = new URLSearchParams(initData);
  const userData = JSON.parse(params.get('user'));
  const user = getUser(userData.id);

  res.json({
    user: {
      id: userData.id,
      firstName: userData.first_name,
      username: userData.username,
    },
    game: user,
  });
});

app.post('/api/tap', (req, res) => {
  const { initData, taps = 1 } = req.body;
  if (!validateInitData(initData)) {
    return res.status(401).json({ error: 'Invalid initData' });
  }

  const params = new URLSearchParams(initData);
  const userData = JSON.parse(params.get('user'));
  const user = getUser(userData.id);

  if (user.energy <= 0) {
    return res.json({ error: 'No energy', game: user });
  }

  const earned = user.tapPower * user.combo * taps;
  user.balance += earned;
  user.energy = Math.max(0, user.energy - taps);
  user.xp += taps;

  // Повышение уровня каждые 50 XP
  if (user.xp >= 50) {
    user.level += 1;
    user.xp -= 50;
    user.energy = 1000;
  }

  res.json({ earned, game: user });
});

app.post('/api/upgrade', (req, res) => {
  const { initData, upgrade } = req.body;
  if (!validateInitData(initData)) {
    return res.status(401).json({ error: 'Invalid initData' });
  }

  const params = new URLSearchParams(initData);
  const userData = JSON.parse(params.get('user'));
  const user = getUser(userData.id);

  const costs = { clickPower: 500, autoClicker: 1000, critChance: 2000, multiplier: 5000 };
  const cost = costs[upgrade];

  if (!cost || user.balance < cost) {
    return res.json({ error: 'Not enough coins', game: user });
  }

  user.balance -= cost;
  user.upgrades[upgrade] += 1;

  if (upgrade === 'clickPower') user.tapPower += 1;
  if (upgrade === 'multiplier') user.combo += 1;

  res.json({ success: true, game: user });
});

// ============ Запуск сервера ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// ============ Telegram Bot ============
bot.start((ctx) => {
  ctx.reply(
    '🐹 Добро пожаловать в Hamster Farm!\nНажми кнопку ниже, чтобы играть:',
    Markup.inlineKeyboard([
      Markup.button.webApp('🎮 Играть', process.env.WEBAPP_URL),
    ])
  );
});

bot.command('play', (ctx) => {
  ctx.reply(
    '🎮 Открыть игру:',
    Markup.inlineKeyboard([
      Markup.button.webApp('Hamster Farm', process.env.WEBAPP_URL),
    ])
  );
});

bot.launch();
console.log('🤖 Bot started');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
