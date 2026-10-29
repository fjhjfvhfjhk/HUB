/* ============================================================
   CORE v9.1 — полный аудио-движок с музыкой + утилиты
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

var Sprites = {
  _cache: {},
  glow: function (hexColor) {
    var key = 'glow_' + hexColor;
    if (this._cache[key]) return this._cache[key];
    var size = 48;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var n = parseInt(hexColor.replace('#', ''), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grad.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',0.4)');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this._cache[key] = c;
    return c;
  },
  drawGlow: function (ctx, x, y, radius, hexColor, alpha) {
    var sprite = this.glow(hexColor);
    var prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = prevAlpha;
  }
};

var Audio2 = {
  ctx: null,
  master: null,
  sfxGain: null,
  musicGain: null,
  enabled: true,
  _unlocked: false,
  muted: false,

  init: function () {
    if (this.ctx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.0;
      var sfxFilter = this.ctx.createBiquadFilter();
      sfxFilter.type = 'lowpass';
      sfxFilter.frequency.value = 8000;
      this.sfxGain.connect(sfxFilter);
      sfxFilter.connect(this.master);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
    } catch (e) { this.enabled = false; }
  },

  unlock: function () {
    if (this._unlocked) return;
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { this.ctx.resume(); } catch (e) { }
    }
    this._unlocked = true;
  },

  setMuted: function (m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.value = m ? 0 : 0.7;
    }
  },

  _tone: function (freq, dur, type, vol, slideTo) {
    if (!this.enabled || !this.ctx || this.muted) return;
    try {
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.15, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { }
  },

  _noise: function (dur, vol, freq, type) {
    if (!this.enabled || !this.ctx || this.muted) return;
    try {
      var t = this.ctx.currentTime;
      var len = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var s = this.ctx.createBufferSource(); s.buffer = buf;
      var f = this.ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.value = freq || 1200;
      var g = this.ctx.createGain(); g.gain.value = vol || 0.15;
      s.connect(f); f.connect(g); g.connect(this.sfxGain);
      s.start(t);
    } catch (e) { }
  },

  _arp: function (freqs, spacing, vol, type) {
    if (!this.enabled || !this.ctx || this.muted) return;
    var self = this;
    for (var i = 0; i < freqs.length; i++) {
      (function (freq, delay) {
        setTimeout(function () {
          self._tone(freq, 0.15, type || 'square', vol || 0.1);
        }, delay * 1000);
      })(freqs[i], i * spacing);
    }
  },

  shoot: function () {
    this._tone(700, 0.06, 'square', 0.07, 400);
    this._noise(0.04, 0.04, 3000, 'highpass');
  },

  fireball: function () {
    this._noise(0.2, 0.1, 800, 'lowpass');
    this._tone(250, 0.25, 'sawtooth', 0.12, 100);
  },

  ice: function () {
    this._tone(1200, 0.15, 'sine', 0.1, 1800);
    this._tone(800, 0.2, 'triangle', 0.08, 1400);
    this._noise(0.15, 0.06, 3000, 'highpass');
  },

  lightning: function () {
    this._tone(1800, 0.12, 'sawtooth', 0.14, 400);
    this._noise(0.25, 0.18, 2500, 'highpass');
    this._tone(90, 0.35, 'sine', 0.12, 40);
  },

  meteor: function () {
    this._tone(140, 0.55, 'sawtooth', 0.18, 40);
    this._noise(0.45, 0.22, 500, 'lowpass');
  },

  shield: function () {
    this._tone(440, 0.35, 'sine', 0.14, 880);
    this._tone(660, 0.25, 'triangle', 0.09, 990);
  },

  teleport: function () {
    this._tone(200, 0.18, 'sawtooth', 0.14, 2200);
    this._noise(0.25, 0.12, 6000, 'highpass');
  },

  heal: function () {
    this._arp([523, 659, 784, 1047], 0.08, 0.12, 'sine');
  },

  beam: function () {
    this._tone(1200, 0.4, 'sawtooth', 0.14, 2400);
    this._noise(0.35, 0.16, 6000, 'highpass');
  },

  poison: function () {
    this._noise(0.5, 0.12, 900, 'lowpass');
    this._tone(160, 0.35, 'sawtooth', 0.1, 80);
  },

  enemyHit: function () {
    this._tone(320, 0.04, 'square', 0.05, 200);
    this._noise(0.03, 0.06, 1500);
  },

  enemyDie: function () {
    this._noise(0.12, 0.14, 800);
    this._tone(180, 0.18, 'square', 0.09, 60);
  },

  playerHurt: function () {
    this._tone(240, 0.18, 'sawtooth', 0.16, 80);
    this._noise(0.08, 0.1, 400);
  },

  levelUp: function () {
    this._arp([523, 659, 784], 0.07, 0.12, 'square');
  },

  gameOver: function () {
    this._arp([440, 330, 262], 0.25, 0.14, 'sawtooth');
    this._noise(0.8, 0.12, 300);
  },

  bossAppear: function () {
    this._tone(60, 1.2, 'sawtooth', 0.22, 30);
    this._noise(1.0, 0.16, 400);
  },

  bossDie: function () {
    this._tone(40, 1.2, 'sawtooth', 0.22, 20);
    this._noise(0.9, 0.18, 600);
    this._arp([880, 660, 440], 0.12, 0.12, 'sine');
  },

  cardFlip: function () {
    this._tone(900, 0.04, 'square', 0.07);
    this._noise(0.06, 0.08, 2500, 'highpass');
  },

  uiClick: function () {
    this._tone(1300, 0.02, 'square', 0.05);
  },

  bookOpen: function () {
    this._noise(0.25, 0.08, 900);
    this._tone(600, 0.12, 'sine', 0.08, 800);
  },

  buy: function () {
    this._arp([1047, 1319], 0.05, 0.1, 'square');
  },

  achievement: function () {
    this._arp([784, 1047, 1319, 1568], 0.08, 0.1, 'sine');
  },

  /* LEGACY ALIASES */
  castNova: function () { this.ice(); },
  castFire: function () { this.fireball(); },
  castChain: function () { this.lightning(); },
  lock: function () { this.uiClick(); }
};

var Music = {
  enabled: true,
  _currentTrack: null,
  _timer: null,
  _barCount: 0,
  _started: false,

  tracks: {
    menu: {
      bpm: 55,
      bass: [110, 110, 146.83, 110],
      scale: [220, 261.63, 293.66, 329.63, 392],
      noteProb: 0.28,
      noteVol: 0.06
    },
    combat: {
      bpm: 95,
      bass: [110, 110, 110, 146.83],
      scale: [440, 523.25, 587.33, 659.25, 783.99],
      noteProb: 0.45,
      noteVol: 0.07
    },
    boss: {
      bpm: 135,
      bass: [82.41, 82.41, 110, 82.41],
      scale: [329.63, 392, 440, 523.25, 587.33, 659.25],
      noteProb: 0.62,
      noteVol: 0.08
    },
    bloodmoon: {
      bpm: 125,
      bass: [103.83, 146.83],
      scale: [207.65, 293.66, 311.13, 415.3],
      noteProb: 0.55,
      noteVol: 0.08
    }
  },

  play: function (trackName) {
    if (!Audio2.ctx || Audio2.muted || !this.enabled) return;
    if (this._currentTrack === trackName) return;
    if (!this.tracks[trackName]) return;

    this._currentTrack = trackName;
    this._barCount = 0;

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._scheduleBar();
  },

  stop: function () {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._currentTrack = null;
  },

  _scheduleBar: function () {
    if (!this._currentTrack || !Audio2.ctx || Audio2.muted) return;
    var track = this.tracks[this._currentTrack];
    if (!track) return;

    var barDur = (60 / track.bpm) * 4;
    var ctx = Audio2.ctx;
    var t = ctx.currentTime;

    try {
      var bassFreq = track.bass[this._barCount % track.bass.length];
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = bassFreq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.15);
      gain.gain.setValueAtTime(0.10, t + barDur - 0.2);
      gain.gain.linearRampToValueAtTime(0, t + barDur);
      osc.connect(gain);
      gain.connect(Audio2.musicGain);
      osc.start(t);
      osc.stop(t + barDur + 0.1);
    } catch (e) { }

    var beats = 8;
    for (var i = 0; i < beats; i++) {
      if (Math.random() < track.noteProb) {
        var note = track.scale[Math.floor(Math.random() * track.scale.length)];
        var noteDur = (barDur / beats) * 0.85;
        var noteT = t + (i * barDur / beats);
        this._playNote(note, noteDur, track.noteVol, noteT);
      }
    }

    this._barCount++;

    var self = this;
    this._timer = setTimeout(function () {
      self._scheduleBar();
    }, (barDur - 0.15) * 1000);
  },

  _playNote: function (freq, dur, vol, time) {
    try {
      var ctx = Audio2.ctx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain);
      gain.connect(Audio2.musicGain);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    } catch (e) { }
  }
};

function SpatialGrid(cellSize) {
  this.cellSize = cellSize || 120;
  this.cells = {};
}
SpatialGrid.prototype.clear = function () { this.cells = {}; };
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
