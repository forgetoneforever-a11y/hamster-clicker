import { useState, useEffect, useRef } from 'react';
import './App.css';

// ⚠️ ЗАМЕНИТЕ на URL вашего бэкенда на Render
const API_URL = 'https://ваш-бэкенд.onrender.com';

export default function App() {
  const [tab, setTab] = useState('farm');
  const [game, setGame] = useState(null);
  const [user, setUser] = useState(null);
  const [floatingCoins, setFloatingCoins] = useState([]);
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  const tapRef = useRef(0);

  // Инициализация Telegram WebApp
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#1a1a1a');
    }
    loadUser();
  }, []);

  // Отправка накопленных тапов раз в секунду
  useEffect(() => {
    const interval = setInterval(() => {
      if (tapRef.current > 0) {
        const taps = tapRef.current;
        tapRef.current = 0;
        sendTaps(taps);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [initData]);

  async function loadUser() {
    try {
      const res = await fetch(`${API_URL}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const data = await res.json();
      setUser(data.user);
      setGame(data.game);
    } catch (e) {
      console.error('Load error:', e);
    }
  }

  async function sendTaps(taps) {
    try {
      const res = await fetch(`${API_URL}/api/tap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, taps }),
      });
      const data = await res.json();
      if (data.game) setGame(data.game);
    } catch (e) {
      console.error('Tap error:', e);
    }
  }

  async function buyUpgrade(upgrade) {
    try {
      const res = await fetch(`${API_URL}/api/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, upgrade }),
      });
      const data = await res.json();
      if (data.game) setGame(data.game);
    } catch (e) {
      console.error('Upgrade error:', e);
    }
  }

  function handleTap(e) {
    if (!game || game.energy <= 0) return;
    tapRef.current += 1;

    tg?.HapticFeedback?.impactOccurred('light');

    // Оптимистичный UI
    setGame((g) => ({
      ...g,
      balance: g.balance + g.tapPower * g.combo,
      energy: Math.max(0, g.energy - 1),
    }));

    // Анимация монетки
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setFloatingCoins((c) => [
      ...c,
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
    setTimeout(() => {
      setFloatingCoins((c) => c.filter((coin) => coin.id !== id));
    }, 800);
  }

  function shareResult() {
    if (!game) return;
    const text = `🐹 Я заработал ${game.balance} монет в Hamster Farm! Уровень ${game.level}`;
    if (tg) {
      tg.sendData(JSON.stringify({ balance: game.balance, level: game.level }));
    } else {
      alert(text);
    }
  }

  if (!game) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Верхняя панель */}
      <header className="header">
        <div className="avatar">🐹</div>
        <h1>Hamster Farm</h1>
        <button className="settings">⚙️</button>
      </header>

      {/* Контент вкладок */}
      {tab === 'farm' && (
        <FarmTab
          game={game}
          onTap={handleTap}
          floatingCoins={floatingCoins}
          onShare={shareResult}
        />
      )}
      {tab === 'upgrades' && <UpgradesTab game={game} onBuy={buyUpgrade} />}
      {tab === 'tasks' && <TasksTab />}
      {tab === 'profile' && <ProfileTab user={user} game={game} />}

      {/* Нижняя навигация */}
      <nav className="nav">
        <NavBtn active={tab === 'farm'} onClick={() => setTab('farm')} icon="🌾" label="Ферма" />
        <NavBtn active={tab === 'upgrades'} onClick={() => setTab('upgrades')} icon="⚡" label="Улучшения" />
        <NavBtn active={tab === 'tasks'} onClick={() => setTab('tasks')} icon="📋" label="Задания" />
        <NavBtn active={tab === 'profile'} onClick={() => setTab('profile')} icon="👤" label="Профиль" />
      </nav>
    </div>
  );
}

// ============ Компоненты вкладок ============

function FarmTab({ game, onTap, floatingCoins, onShare }) {
  return (
    <div className="farm">
      <div className="balance">
        <span className="coin">🪙</span>
        <span className="amount">{game.balance.toLocaleString()}</span>
      </div>
      <p className="label">МОНЕТ</p>

      <div className="level-bar">
        <div className="level-info">
          <span>Уровень {game.level}</span>
          <span>{game.xp} / 50 XP</span>
        </div>
        <div className="progress">
          <div className="progress-fill" style={{ width: `${(game.xp / 50) * 100}%` }} />
        </div>
      </div>

      <div className="tap-zone" onClick={onTap}>
        <div className="hamster">🐹</div>
        {floatingCoins.map((coin) => (
          <div
            key={coin.id}
            className="floating-coin"
            style={{ left: coin.x, top: coin.y }}
          >
            +{game.tapPower * game.combo}
          </div>
        ))}
      </div>

      <div className="stats">
        <StatBox label="КОМБО" value={`x${game.combo}`} />
        <StatBox label="ЭНЕРГИЯ" value={game.energy} highlight />
        <StatBox label="ЗА ТАП" value={`+${game.tapPower}`} />
      </div>

      <button className="share-btn" onClick={onShare}>
        📤 Поделиться результатом
      </button>
    </div>
  );
}

function StatBox({ label, value, highlight }) {
  return (
    <div className={`stat-box ${highlight ? 'highlight' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function UpgradesTab({ game, onBuy }) {
  const upgrades = [
    { key: 'clickPower', name: 'Сила клика', desc: '+1 к урону', cost: 500, icon: '👆' },
    { key: 'autoClicker', name: 'Автокликер', desc: 'Пассивный доход', cost: 1000, icon: '🤖' },
    { key: 'critChance', name: 'Критический шанс', desc: '+5% крита', cost: 2000, icon: '🎯' },
    { key: 'multiplier', name: 'Множитель', desc: '+1 к комбо', cost: 5000, icon: '✖️' },
  ];

  return (
    <div className="upgrades">
      <h2>Улучшения</h2>
      {upgrades.map((u) => (
        <div key={u.key} className="upgrade-card">
          <div className="upgrade-icon">{u.icon}</div>
          <div className="upgrade-info">
            <div className="upgrade-name">{u.name}</div>
            <div className="upgrade-desc">{u.desc}</div>
            <div className="upgrade-level">Уровень {game.upgrades[u.key]}</div>
          </div>
          <button
            className="buy-btn"
            disabled={game.balance < u.cost}
            onClick={() => onBuy(u.key)}
          >
            🪙 {u.cost}
          </button>
        </div>
      ))}
    </div>
  );
}

function TasksTab() {
  return (
    <div className="tasks">
      <h2>Задания</h2>
      <div className="task-card">
        <span>🎁</span>
        <div>
          <div>Ежедневный бонус</div>
          <small>Скоро...</small>
        </div>
      </div>
      <div className="task-card">
        <span>👥</span>
        <div>
          <div>Пригласить друга</div>
          <small>Скоро...</small>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user, game }) {
  return (
    <div className="profile">
      <h2>Профиль</h2>
      <div className="profile-card">
        <div className="profile-avatar">🐹</div>
        <div className="profile-name">{user?.firstName || 'Игрок'}</div>
        <div className="profile-username">@{user?.username || 'unknown'}</div>
      </div>
      <div className="profile-stats">
        <div>Уровень: {game.level}</div>
        <div>Баланс: {game.balance.toLocaleString()} 🪙</div>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button className={`nav-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}