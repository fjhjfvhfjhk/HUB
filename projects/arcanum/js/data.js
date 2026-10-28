/* ============================================================
   DATA v8 — усложнение баланса, multi/pierce с maxLevel
   ============================================================ */

var RARITIES = {
  common:    { name: 'Обычное',     label: 'ОБЫЧНОЕ',    mult: 1.0, color: '#9d92c4' },
  rare:      { name: 'Редкое',      label: 'РЕДКОЕ',     mult: 1.6, color: '#4d9dff' },
  epic:      { name: 'Эпическое',   label: 'ЭПИЧЕСКОЕ',  mult: 2.4, color: '#b56bff' },
  legendary: { name: 'Легендарное', label: 'ЛЕГЕНДАРНОЕ',mult: 3.6, color: '#ffc857' }
};

function rollRarity() {
  var r = Math.random() * 100;
  if (r < 3) return 'legendary';
  if (r < 15) return 'epic';
  if (r < 40) return 'rare';
  return 'common';
}

var MAGE_CLASSES = [
  { id: 'pyromancer', icon: '🔥', name: 'Пиромант',
    desc: '+15% урона, поджог базовой атаки +4/сек. Специализация на огне.', color: '#ff7a3c' },
  { id: 'cryomancer', icon: '❄', name: 'Криомант',
    desc: 'Нова +50% урона. Замедленные враги получают +50% урона от всех источников.', color: '#7fdcff' },
  { id: 'electromancer', icon: '⚡', name: 'Электромант',
    desc: '+20% крита, цепь бьёт по 6 врагам. Мана реген -20%.', color: '#9ee8ff' }
];

var SPELL_DEFS = [
  { id: 'nova', icon: '❄', name: 'Ледяная нова', cost: 28, cooldown: 5.5, unlockedByDefault: true,
    desc: 'Взрыв холода вокруг мага. Замедляет и наносит урон всем в радиусе 175.' },
  { id: 'fireball', icon: '🔥', name: 'Огненный шар', cost: 18, cooldown: 1.5, unlockedByDefault: true,
    desc: 'Самонаводящийся снаряд. Поджигает цель. Мощный одиночный удар.' },
  { id: 'chain', icon: '⚡', name: 'Цепь молний', cost: 32, cooldown: 6.0, unlockedByDefault: true,
    desc: 'Прыгает по 4 врагам в радиусе 220px. Замедляет. Не требует цели.' },
  { id: 'meteor', icon: '☄', name: 'Метеор', cost: 40, cooldown: 12.0, unlockedByDefault: true,
    desc: 'Падает через 1 секунду в точке взгляда. AoE радиус 200, урон 120. Поджигает.' },
  { id: 'shield', icon: '🛡', name: 'Магический щит', cost: 35, cooldown: 10.0, unlockCost: 120,
    desc: '5 секунд неуязвимости. Блокирует весь урон и снаряды.' },
  { id: 'teleport', icon: '🌀', name: 'Телепорт', cost: 20, cooldown: 4.0, unlockCost: 100,
    desc: 'Рывок на 250px в направлении взгляда. 0.3 секунды неуязвимости после.' },
  { id: 'frostbolt', icon: '🧊', name: 'Ледяная стрела', cost: 22, cooldown: 3.5, unlockCost: 90,
    desc: 'Пробивает 3 врагов и сильно замедляет их. Снаряд летит быстро.' },
  { id: 'poison', icon: '☠', name: 'Ядовитое облако', cost: 30, cooldown: 8.0, unlockCost: 150,
    desc: 'Отравляет всех врагов в радиусе 150 в точке взгляда. Урон со временем.' },
  { id: 'heal', icon: '💚', name: 'Исцеление', cost: 40, cooldown: 15.0, unlockCost: 130,
    desc: 'Мгновенно восстанавливает 40% от максимума HP.' },
  { id: 'beam', icon: '💫', name: 'Лазерный луч', cost: 45, cooldown: 9.0, unlockCost: 200,
    desc: 'Прожигает всех врагов в линии 500px. Мощный мгновенный урон.' }
];

var SPELL_SLOT_MAX = 5;
var SPELL_SLOT_5_COST = 300;

var ACHIEVEMENTS = [
  { id: 'first_blood', icon: '🩸', name: 'Первая кровь', desc: 'Убить первого врага', souls: 10,
    check: function (s) { return s.totalKillsAllTime >= 1; } },
  { id: 'novice', icon: '🌟', name: 'Начинающий маг', desc: 'Убить 50 врагов всего', souls: 30,
    check: function (s) { return s.totalKillsAllTime >= 50; } },
  { id: 'serial_killer', icon: '💀', name: 'Серийный убийца', desc: '100 убийств за один забег', souls: 50,
    check: function (s) { return s.runKills >= 100; } },
  { id: 'flawless_5', icon: '✨', name: 'Без единой царапины', desc: '5 волн подряд без урона', souls: 80,
    check: function (s) { return s.flawlessWaves >= 5; } },
  { id: 'crit_streak', icon: '🎯', name: 'Критик', desc: '20 критов подряд', souls: 60,
    check: function (s) { return s.maxCritStreak >= 20; } },
  { id: 'boss_slayer', icon: '👹', name: 'Убийца богов', desc: 'Убить босса', souls: 40,
    check: function (s) { return s.bossesKilled >= 1; } },
  { id: 'blood_moon', icon: '🌑', name: 'Дитя луны', desc: 'Пережить кровавую луну', souls: 70,
    check: function (s) { return s.bloodMoonsSurvived >= 1; } },
  { id: 'collector', icon: '📖', name: 'Коллекционер', desc: 'Открыть 5 заклинаний', souls: 100,
    check: function (s) { return s.spellsUnlocked >= 5; } },
  { id: 'wave_10', icon: '🌊', name: 'Десятая волна', desc: 'Дойти до 10-й волны', souls: 50,
    check: function (s) { return s.maxWave >= 10; } },
  { id: 'wave_25', icon: '🏆', name: 'Четверть сотни', desc: 'Дойти до 25-й волны', souls: 200,
    check: function (s) { return s.maxWave >= 25; } }
];

/* ============================================================
   УЛУЧШЕНИЯ — multi/pierce теперь maxLevel 2, с фильтром
   ============================================================ */
var UPGRADES = [
  { id: 'dmg',     icon: '🗡', name: 'Острый фокус',     base: 0.20,
    desc: function (v) { return '+' + Math.round(v * 100) + '% урона'; },
    apply: function (p, v) { p.damageMul += v; } },
  { id: 'hp',      icon: '❤', name: 'Живучесть',        base: 25,
    desc: function (v) { return '+' + Math.round(v) + ' HP'; },
    apply: function (p, v) { p.maxHp += v; p.hp = p.maxHp; } },
  { id: 'regen',   icon: '✚', name: 'Регенерация',      base: 1.0,
    desc: function (v) { return '+' + v.toFixed(1) + ' HP/с'; },
    apply: function (p, v) { p.hpRegen += v; } },
  { id: 'mana',    icon: '✦', name: 'Поток маны',       base: 3,
    desc: function (v) { return '+' + Math.round(v) + ' маны/с'; },
    apply: function (p, v) { p.manaRegen += v; } },
  { id: 'maxmana', icon: '◇', name: 'Резервуар',        base: 30,
    desc: function (v) { return '+' + Math.round(v) + ' маны'; },
    apply: function (p, v) { p.maxMana += v; p.mana += v; } },
  { id: 'speed',   icon: '💨', name: 'Лёгкий шаг',      base: 0.12,
    desc: function (v) { return '+' + Math.round(v * 100) + '% скорости'; },
    apply: function (p, v) { p.speed *= 1 + v; } },
  { id: 'crit',    icon: '🎯', name: 'Точный глаз',     base: 0.08,
    desc: function (v) { return '+' + Math.round(v * 100) + '% крита'; },
    apply: function (p, v) { p.critChance += v; } },
  { id: 'critdmg', icon: '💥', name: 'Смертельный удар',base: 0.5,
    desc: function (v) { return '+' + v.toFixed(1) + '× крит'; },
    apply: function (p, v) { p.critMul += v; } },
  { id: 'cd',      icon: '⏱', name: 'Быстрые руки',    base: 0.15,
    desc: function (v) { return '-' + Math.round(v * 100) + '% кд'; },
    apply: function (p, v) { p.cooldownMul *= Math.max(0.5, 1 - v); } },

  /* multi — ограничен 2 уровнями, штраф через perShotMul в game.js */
  { id: 'multi',   icon: '✧', name: 'Расщепление',      base: 1, maxLevel: 2,
    desc: function (v) {
      var n = Math.max(1, Math.min(2, Math.round(v)));
      return '+' + n + ' снаряд · каждый -8% урона';
    },
    apply: function (p, v) {
      var n = Math.max(1, Math.min(2, Math.round(v)));
      p.projectiles += n;
    } },

  { id: 'leech',   icon: '🩸', name: 'Вампиризм',      base: 0.04,
    desc: function (v) { return '+' + Math.round(v * 100) + '% вампиризма'; },
    apply: function (p, v) { p.lifesteal += v; } },
  { id: 'armor',   icon: '🛡', name: 'Каменная кожа',   base: 0.06, maxLevel: 8,
    desc: function (v) { return '+' + Math.round(v * 100) + '% брони'; },
    apply: function (p, v) { p.armor = Math.min(0.5, p.armor + v); } },
  { id: 'burn',    icon: '🔥', name: 'Тлеющий посох',   base: 3,
    desc: function (v) { return 'Поджог ' + Math.round(v) + '/с'; },
    apply: function (p, v) { p.boltBurn += v; } },

  /* pierce — ограничен 2 уровнями */
  { id: 'pierce',  icon: '➤', name: 'Пробивание',      base: 1, maxLevel: 2,
    desc: function (v) {
      var n = Math.max(1, Math.min(2, Math.round(v)));
      return 'Пробитие +' + n;
    },
    apply: function (p, v) {
      var n = Math.max(1, Math.min(2, Math.round(v)));
      p.boltPierce += n;
    } }
];

var META_STATS = [
  { id: 'hp',       icon: '❤', name: 'Здоровье',    baseCost: 50, costScale: 1.6, maxLevel: 5,
    desc: function (lvl) { return '+' + (lvl * 10) + ' HP'; },
    apply: function (p, lvl) { p.maxHp += 10 * lvl; p.hp = p.maxHp; } },
  { id: 'manaRegen',icon: '✦', name: 'Поток маны',  baseCost: 40, costScale: 1.6, maxLevel: 5,
    desc: function (lvl) { return '+' + lvl + ' маны/с'; },
    apply: function (p, lvl) { p.manaRegen += lvl; } },
  { id: 'damage',   icon: '🗡', name: 'Сила магии', baseCost: 30, costScale: 1.7, maxLevel: 10,
    desc: function (lvl) { return '+' + (lvl * 5) + '% урона'; },
    apply: function (p, lvl) { p.damageMul += 0.05 * lvl; } },
  { id: 'speed',    icon: '💨', name: 'Проворство', baseCost: 45, costScale: 1.7, maxLevel: 5,
    desc: function (lvl) { return '+' + (lvl * 3) + '% скорости'; },
    apply: function (p, lvl) { p.speed *= 1 + 0.03 * lvl; } },
  { id: 'crit',     icon: '🎯', name: 'Меткость',   baseCost: 60, costScale: 1.8, maxLevel: 5,
    desc: function (lvl) { return '+' + (lvl * 2) + '% крита'; },
    apply: function (p, lvl) { p.critChance += 0.02 * lvl; } }
];

var META_SPELLS = [
  { id: 'novaDmg',    icon: '❄', name: 'Мощь новы',        baseCost: 80,  costScale: 1.8, maxLevel: 3,
    desc: function (lvl) { return '+' + (lvl * 15) + '% урона'; },
    apply: function (p, lvl) { p.metaNovaDmg = lvl * 0.15; } },
  { id: 'fireBurn',   icon: '🔥', name: 'Пламя фаербола',   baseCost: 70,  costScale: 1.7, maxLevel: 3,
    desc: function (lvl) { return '+' + (lvl * 2) + '/с поджога'; },
    apply: function (p, lvl) { p.metaFireBurn = lvl * 2; } },
  { id: 'chainRange', icon: '⚡', name: 'Дальность цепи',   baseCost: 70,  costScale: 1.7, maxLevel: 3,
    desc: function (lvl) { return '+' + (lvl * 30) + 'px'; },
    apply: function (p, lvl) { p.metaChainRange = lvl * 30; } },
  { id: 'fireHoming', icon: '🎯', name: 'Точность фаербола',baseCost: 120, costScale: 2.0, maxLevel: 2,
    desc: function (lvl) { return '+' + lvl + ' наведения'; },
    apply: function (p, lvl) { p.metaFireHoming = lvl; } }
];

function costFor(upg, level) {
  return Math.floor(upg.baseCost * Math.pow(upg.costScale, level));
}

/* ============================================================
   ВРАГИ И БОССЫ — усилены для сложности
   ============================================================ */
var ENEMY_TYPES = {
  imp:    { hp: 22, speed: 62, damage: 8,  radius: 12, xp: 3,  color: '#ff5b6e', colorDark: '#a02134', glyph: 'imp' },
  wraith: { hp: 34, speed: 84, damage: 11, radius: 13, xp: 5,  color: '#b56bff', colorDark: '#5c2a94', glyph: 'wraith' },
  brute:  { hp: 95, speed: 42, damage: 20, radius: 20, xp: 12, color: '#ff9a3c', colorDark: '#8f4d00', glyph: 'brute' },
  shade:  { hp: 55, speed: 70, damage: 14, radius: 15, xp: 8,  color: '#4de0ff', colorDark: '#136b85', glyph: 'shade' }
};

var BOSS_TYPES = [
  { id: 'devourer', name: 'Пожиратель Бездны', color: '#ff3355', colorDark: '#5a1020', shape: 'octagon' },
  { id: 'summoner', name: 'Архилич',           color: '#b56bff', colorDark: '#3a0e5e', shape: 'spikes' },
  { id: 'mage',     name: 'Безумный Маг',      color: '#4d9dff', colorDark: '#0e2a52', shape: 'star' },
  { id: 'titan',    name: 'Вечный Страж',      color: '#ff9a3c', colorDark: '#5a3010', shape: 'hex' }
];

function pickBossType(wave) {
  var idx = Math.floor(wave / 5 - 1);
  return BOSS_TYPES[((idx % BOSS_TYPES.length) + BOSS_TYPES.length) % BOSS_TYPES.length];
}

function findSpellDef(id) {
  for (var i = 0; i < SPELL_DEFS.length; i++) {
    if (SPELL_DEFS[i].id === id) return SPELL_DEFS[i];
  }
  return null;
}
