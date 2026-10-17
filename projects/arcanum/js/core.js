/* ============================================================
   CORE — базовые утилиты, хранилище, звук, spatial grid
   ============================================================ */

window.onerror = function (msg, src, line, col, err) {
  var box = document.getElementById('err-box');
  if (box) {
    box.style.display = 'block';
    box.textContent = 'ОШИБКА:\n' + msg + '\n' + (src || '') + ':' + line + ':' + col +
      '\n\n' + (err && err.stack ? err.stack : '(нет стека)');
  }
  return false;
};

var Storage = {
  get: function (k, d) {
    try { var v = window.localStorage.getItem(k); return v === null ? d : v; }
    catch (e) { return d; }
  },
  set: function (k, v) {
    try { window.localStorage.setItem(k, String(v)); } catch (e) { }
  }
};

var Utils = {
  clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  shuffle: function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  },
  dist: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
  dist2: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  angle: function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  damp: function (a, b, l, dt) { return Utils.lerp(a, b, 1 - Math.exp(-l * dt)); },
  angleDiff: function (a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); },
  formatNum: function (n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.floor(n));
  },
  vibrate: function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
};

var Audio2 = {
  ctx: null, master: null, enabled: true, _unlocked: false,
  init: function () {
    if (this.ctx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  },
  unlock: function () {
    if (this._unlocked) return;
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) { } }
    this._unlocked = true;
  },
  _tone: function (f, dur, type, vol, slide) {
    if (!this.enabled || !this.ctx) return;
    try {
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { }
  },
  _noise: function (dur, vol, freq) {
    if (!this.enabled || !this.ctx) return;
    try {
      var t = this.ctx.currentTime;
      var len = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var s = this.ctx.createBufferSource(); s.buffer = buf;
      var f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      var g = this.ctx.createGain(); g.gain.value = vol || 0.2;
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t);
    } catch (e) { }
  },
  shoot:      function () { this._tone(620, 0.09, 'triangle', 0.10, 320); },
  enemyHit:   function () { this._tone(240, 0.06, 'square', 0.06, 160); },
  enemyDie:   function () { this._noise(0.2, 0.16, 900); this._tone(120, 0.22, 'sawtooth', 0.10, 50); },
  castNova:   function () { this._tone(180, 0.45, 'sine', 0.18, 720); this._noise(0.35, 0.14, 2600); },
  castFire:   function () { this._tone(140, 0.3, 'sawtooth', 0.14, 420); },
  castChain:  function () { this._tone(900, 0.22, 'square', 0.10, 180); },
  lock:       function () { this._tone(880, 0.08, 'square', 0.06, 1200); },
  cardFlip:   function () { this._tone(340, 0.10, 'triangle', 0.08, 500); },
  levelUp:    function () { this._tone(520, 0.14, 'sine', 0.16, 780); var s = this; setTimeout(function () { s._tone(780, 0.22, 'sine', 0.16, 1040); }, 110); },
  playerHurt: function () { this._tone(180, 0.22, 'sawtooth', 0.16, 70); },
  gameOver:   function () { this._tone(420, 0.5, 'sine', 0.20, 90); var s = this; setTimeout(function () { s._tone(280, 0.7, 'sine', 0.20, 60); }, 250); },
  bossAppear: function () { this._tone(80, 1.0, 'sawtooth', 0.25, 40); this._noise(0.8, 0.20, 400); },
  bossDie:    function () { this._tone(60, 1.2, 'sawtooth', 0.25, 30); this._noise(1.0, 0.22, 600); },
  uiClick:    function () { this._tone(680, 0.05, 'square', 0.08); },
  bookOpen:   function () { this._tone(440, 0.15, 'sine', 0.10, 660); },
  buy:        function () { this._tone(700, 0.10, 'sine', 0.12, 1050); }
};

/* ============================================================
   SpatialGrid — пространственный хеш для быстрой коллизии
   ============================================================ */
function SpatialGrid(cellSize) {
  this.cellSize = cellSize || 120;
  this.cells = {};
  this._keyBuf = '';
}
SpatialGrid.prototype.clear = function () {
  this.cells = {};
};
SpatialGrid.prototype.rebuild = function (entities) {
  this.cells = {};
  var cs = this.cellSize;
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (e.dead) continue;
    var k = (Math.floor(e.x / cs)) + ',' + (Math.floor(e.y / cs));
    var arr = this.cells[k];
    if (!arr) { arr = []; this.cells[k] = arr; }
    arr.push(e);
  }
};
SpatialGrid.prototype.query = function (x, y, r) {
  var results = [];
  var cs = this.cellSize;
  var minCX = Math.floor((x - r) / cs);
  var maxCX = Math.floor((x + r) / cs);
  var minCY = Math.floor((y - r) / cs);
  var maxCY = Math.floor((y + r) / cs);
  for (var cx = minCX; cx <= maxCX; cx++) {
    for (var cy = minCY; cy <= maxCY; cy++) {
      var arr = this.cells[cx + ',' + cy];
      if (arr) {
        for (var i = 0; i < arr.length; i++) results.push(arr[i]);
      }
    }
  }
  return results;
};

try { document.getElementById('js-status').textContent = 'JS: core OK'; } catch (e) { }
