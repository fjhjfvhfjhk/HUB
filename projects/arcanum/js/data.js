/* ============================================================
   DATA — редкости, улучшения, мета-прокачка, заклинания, враги
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

var SPELLS = [
  { id: 'nova',     name: 'Ледяная нова', icon: '❄', cost: 28, cooldown: 5.5 },
  { id: 'fireball', name: 'Огненный шар', icon: '🔥', cost: 18, cooldown: 1.5 },
  { id: 'chain',    name: 'Цепь молний',  icon: '⚡', cost: 32, cooldown: 6.0 }
];

var ENEMY_TYPES = {
  imp:    { hp: 22, speed: 62, damage: 8,  radius: 12, xp: 3,  color: '#ff5b6e', colorDark: '#a02134', glyph: 'imp' },
  wraith: { hp: 34, speed: 84, damage: 11, radius: 13, xp: 5,  color: '#b56bff', colorDark: '#5c2a94', glyph: 'wraith' },
  brute:  { hp: 95, speed: 42, damage: 20, radius: 20, xp: 12, color: '#ff9a3c', colorDark: '#8f4d00', glyph: 'brute' },
  shade:  { hp: 55, speed: 70, damage: 14, radius: 15, xp: 8,  color: '#4de0ff', colorDark: '#136b85', glyph: 'shade' }
};

var UPGRADES = [
  { id: 'dmg',     icon: '🗡', name: 'Острый фокус',     base: 0.20,
    desc: function (v) { return '+' + Math.round(v * 100) + '% урона'; },
    apply: function (p, v) { p.damageMul += v; } },
  { id: 'hp',      icon: '❤', name: 'Живучесть',        base: 25,
    desc: function (v) { return '+' + Math.round(v) + ' HP'; },
    apply: function (p, v) { p.maxHp += v; p.hp = p.maxHp; } },
  { id: 'regen',   icon: '✚', name: 'Регенерация',      base: 1.2,
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
  { id: 'multi',   icon: '✧', name: 'Расщепление',      base: 1,
    desc: function (v) { return '+' + Math.min(2, Math.round(v)) + ' снаряд'; },
    apply: function (p, v) { var a = Math.min(2, Math.round(v)); p.projectiles += Math.max(1, a); } },
  { id: 'leech',   icon: '🩸', name: 'Вампиризм',      base: 0.04,
    desc: function (v) { return '+' + Math.round(v * 100) + '% вампиризма'; },
    apply: function (p, v) { p.lifesteal += v; } },
  { id: 'armor',   icon: '🛡', name: 'Каменная кожа',   base: 0.08,
    desc: function (v) { return '+' + Math.round(v * 100) + '% брони'; },
    apply: function (p, v) { p.armor = Math.min(0.6, p.armor + v); } },
  { id: 'burn',    icon: '🔥', name: 'Тлеющий посох',   base: 3,
    desc: function (v) { return 'Поджог ' + Math.round(v) + '/с'; },
    apply: function (p, v) { p.boltBurn += v; } },
  { id: 'pierce',  icon: '➤', name: 'Пробивание',      base: 1,
    desc: function (v) { return 'Пробитие +' + Math.min(2, Math.round(v)); },
    apply: function (p, v) { var a = Math.min(2, Math.round(v)); p.boltPierce += Math.max(1, a); } }
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
