/* ============================================================
   GAME v5.1 — оптимизация под Кровавую Луну
   ============================================================ */

var Game = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
  state: 'menu', lastTime: 0, accumulator: 0,
  player: null, enemies: [], projectiles: [], enemyProjectiles: [],
  particles: [], pickups: [], damageTexts: [], meteors: [],
  camX: 0, camY: 0, shakeAmt: 0, shakeX: 0, shakeY: 0,
  wave: 0, waveActive: false, spawnQueue: [], spawnTimer: 0,
  kills: 0, score: 0, best: 0,
  upgradeChoices: [], boltCooldown: 0,
  bgRunes: [], nebulae: [], stars: [],
  touches: {}, moveTouchId: null, aimTouchId: null,
  moveVec: { x: 0, y: 0 }, aimVec: { x: 1, y: 0 },
  aimActive: false, mouseDown: false, keys: {},
  spellBtns: [], pauseBtn: null,
  lockTarget: null, lockTimer: 0,
  comboCount: 0, comboTimer: 0,
  screenFlash: 0, screenFlashColor: '#ffffff',
  _playerTrailTimer: 0,
  bossActive: null,
  mageClass: null,
  bloodMoonActive: false,
  bloodMoonScoreMul: 1,
  performanceMode: false,
  meta: { souls: 0, totalSouls: 0, stats: {}, spells: {} },
  spatialGrid: null,
  frameTimes: [],
  lowQuality: false,
  _qualityCooldown: 0,
  maxParticles: 320,
  maxProjectiles: 150,
  maxEnemyProjectiles: 60,
  maxDamageTexts: 40,
  maxEnemies: 30,
  vignetteCanvas: null,
  _bloodMoonCanvas: null,
  _hurtFlashCanvas: null,

  init: function () {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.spatialGrid = new SpatialGrid(120);

    this.loadMeta();
    this.resize();
    var self = this;
    window.addEventListener('resize', function () { self.resize(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 200); });
    document.addEventListener('fullscreenchange', function () { self.resize(); });
    document.addEventListener('webkitfullscreenchange', function () { self.resize(); });

    this.best = parseInt(Storage.get('arcanum_best', '0'), 10) || 0;
    var bestEl = document.getElementById('best-score');
    if (bestEl) bestEl.textContent = Utils.formatNum(this.best);
    this.updateSoulsDisplay();

    var savedClass = Storage.get('arcanum_class', 'classic');
    this.mageClass = (savedClass && savedClass !== 'classic') ? savedClass : null;

    this.buildHUD();
    this.bindUI();
    this.bindInput();
    this.generateBgRunes();
    this.generateNebula();
    this.generateStars();
    Book.init();
    this.setState('menu');
    this.lastTime = performance.now();
    requestAnimationFrame(function (t) { self.loop(t); });
  },

  loadMeta: function () {
    try {
      var raw = Storage.get('arcanum_meta', '');
      if (raw) {
        var parsed = JSON.parse(raw);
        this.meta = {
          souls: parsed.souls || 0,
          totalSouls: parsed.totalSouls || 0,
          stats: parsed.stats || {},
          spells: parsed.spells || {}
        };
      }
    } catch (e) {
      this.meta = { souls: 0, totalSouls: 0, stats: {}, spells: {} };
    }
  },

  saveMeta: function () {
    Storage.set('arcanum_meta', JSON.stringify(this.meta));
    this.updateSoulsDisplay();
  },

  updateSoulsDisplay: function () {
    var s = Utils.formatNum(this.meta.souls);
    var a = document.getElementById('menu-souls');
    if (a) a.textContent = s;
    var b = document.getElementById('cover-souls');
    if (b) b.textContent = s;
  },

  resize: function () {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.generateStars();
    this.buildUiCaches();
  },

  buildUiCaches: function () {
    var W = this.W, H = this.H;

    // Vignette
    var vc = document.createElement('canvas');
    vc.width = W; vc.height = H;
    var vctx = vc.getContext('2d');
    var cx0 = W / 2, cy0 = H / 2;
    var innerR = Math.min(W, H) * 0.28;
    var outerR = Math.max(W, H) * 0.78;
    var vg = vctx.createRadialGradient(cx0, cy0, innerR, cx0, cy0, outerR);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.55, 'rgba(10,5,25,0.18)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    vctx.fillStyle = vg;
    vctx.fillRect(0, 0, W, H);
    this.vignetteCanvas = vc;

    // Blood moon overlay + moon sprite — ОДИН canvas, один drawImage
    var bmc = document.createElement('canvas');
    bmc.width = W; bmc.height = H;
    var bctx = bmc.getContext('2d');

    var bg = bctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    bg.addColorStop(0, 'rgba(180,20,20,0)');
    bg.addColorStop(0.6, 'rgba(180,20,20,0.08)');
    bg.addColorStop(1, 'rgba(120,10,10,0.36)');
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, W, H);

    // Moon in top-right
    var mx = W - 70, my = 100;
    bctx.globalAlpha = 0.75;
    var moonG = bctx.createRadialGradient(mx, my, 0, mx, my, 40);
    moonG.addColorStop(0, '#ff3333');
    moonG.addColorStop(0.6, '#8a1010');
    moonG.addColorStop(1, 'rgba(120,10,10,0)');
    bctx.fillStyle = moonG;
    bctx.beginPath();
    bctx.arc(mx, my, 40, 0, 6.2832);
    bctx.fill();
    bctx.globalAlpha = 0.6;
    bctx.fillStyle = '#a01c1c';
    bctx.beginPath();
    bctx.arc(mx, my, 22, 0, 6.2832);
    bctx.fill();
    bctx.globalAlpha = 0.4;
    bctx.fillStyle = '#5a0808';
    bctx.beginPath();
    bctx.arc(mx - 6, my - 4, 4, 0, 6.2832);
    bctx.arc(mx + 7, my + 3, 3, 0, 6.2832);
    bctx.arc(mx - 2, my + 8, 2.5, 0, 6.2832);
    bctx.fill();
    bctx.globalAlpha = 1;

    this._bloodMoonCanvas = bmc;

    // Hurt flash gradient (кеш)
    var hc = document.createElement('canvas');
    hc.width = W; hc.height = H;
    var hctx = hc.getContext('2d');
    var hg = hctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.72);
    hg.addColorStop(0, 'rgba(255,60,80,0)');
    hg.addColorStop(1, 'rgba(255,60,80,0.4)');
    hctx.fillStyle = hg;
    hctx.fillRect(0, 0, W, H);
    this._hurtFlashCanvas = hc;
  },

  generateBgRunes: function () {
    this.bgRunes = [];
    for (var i = 0; i < 16; i++) {
      this.bgRunes.push({
        x: Math.random() * 2400 - 1200,
        y: Math.random() * 2400 - 1200,
        s: 0.4 + Math.random() * 0.8,
        a: 0.05 + Math.random() * 0.11,
        rot: Math.random() * 6.28,
        glyph: Utils.pick(['✦', '✧', '✶', '◆', '◇', '❖'])
      });
    }
  },

  generateNebula: function () {
    this.nebulae = [];
    var palette = ['#3a1d6b', '#5c2a94', '#1d3a6b', '#2a1d4a', '#4a1d5c'];
    for (var i = 0; i < 5; i++) {
      var size = 400;
      var c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      var cx = c.getContext('2d');
      var g = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, palette[i % palette.length]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.fillRect(0, 0, size, size);
      this.nebulae.push({
        canvas: c,
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        r: 220 + Math.random() * 240,
        a: 0.10 + Math.random() * 0.10
      });
    }
  },

  generateStars: function () {
    this.stars = [];
    var count = Math.min(80, Math.floor((this.W * this.H) / 12000));
    for (var i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        s: 0.6 + Math.random() * 1.3,
        phase: Math.random() * 6.28,
        speed: 0.4 + Math.random() * 0.8,
        color: Math.random() < 0.15 ? '#b56bff' : (Math.random() < 0.2 ? '#8ad4ff' : '#ffffff')
      });
    }
  },

  buildHUD: function () {
    this.spellBtns = [
      document.getElementById('btn-spell-0'),
      document.getElementById('btn-spell-1'),
      document.getElementById('btn-spell-2'),
      document.getElementById('btn-spell-3')
    ];
    this.pauseBtn = document.getElementById('btn-pause');
    var self = this;
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', function () { self.togglePause(); });
    }
    for (var i = 0; i < this.spellBtns.length; i++) {
      (function (idx) {
        var btn = self.spellBtns[idx];
        if (!btn) return;
        var press = function (e) {
          e.preventDefault(); e.stopPropagation();
          Audio2.unlock();
          self.castSpell(idx);
        };
        var release = function (e) { if (e) { e.preventDefault(); e.stopPropagation(); } };
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
      })(i);
    }
  },

  bindUI: function () {
    var $ = function (id) { return document.getElementById(id); };
    var self = this;
    var on = function (id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); };
    on('btn-play',   function () { Audio2.unlock(); Audio2.uiClick(); self.showClassSelect(); });
    on('btn-retry',  function () { Audio2.uiClick(); self.startGame(); });
    on('btn-menu',   function () { Audio2.uiClick(); self.setState('menu'); });
    on('btn-quit',   function () { Audio2.uiClick(); self.setState('menu'); });
    on('btn-resume', function () { Audio2.uiClick(); self.resume(); });
    on('btn-book',      function () { Audio2.bookOpen(); self.openBook(); });
    on('btn-book-over', function () { Audio2.bookOpen(); self.openBook(); });
    on('btn-fullscreen',   function () { self.toggleFullscreen(); });
    on('btn-fullscreen-2', function () { self.toggleFullscreen(); });
    on('btn-class-back',   function () { Audio2.uiClick(); self.setState('menu'); });
  },

  toggleFullscreen: function () {
    try {
      var el = document.documentElement;
      var isFs = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
      if (!isFs) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
      }
    } catch (e) { }
  },

  showClassSelect: function () {
    var list = document.getElementById('class-list');
    if (!list) { this.startGame(); return; }
    list.innerHTML = '';
    var self = this;
    var allClasses = MAGE_CLASSES.concat([{
      id: 'classic', icon: '✦', name: 'Классик',
      desc: 'Сбалансированный маг без специализации. Все заклинания доступны.',
      color: '#9d92c4'
    }]);
    for (var i = 0; i < allClasses.length; i++) {
      (function (cls) {
        var card = document.createElement('div');
        card.className = 'class-card ' + cls.id;
        card.innerHTML =
          '<div class="class-card-icon" style="color:' + cls.color + '">' + cls.icon + '</div>' +
          '<div class="class-card-body">' +
            '<div class="class-card-name">' + cls.name + '</div>' +
            '<div class="class-card-desc">' + cls.desc + '</div>' +
          '</div>';
        var handler = function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          Audio2.uiClick();
          Utils.vibrate(20);
          self.mageClass = (cls.id === 'classic') ? null : cls.id;
          Storage.set('arcanum_class', self.mageClass || 'classic');
          self.startGame();
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
        list.appendChild(card);
      })(allClasses[i]);
    }
    this.setState('class');
  },

  openBook: function () {
    this.setState('book');
    Book.show();
  },

  setState: function (s) {
    this.state = s;
    var map = { menu: 'screen-menu', class: 'screen-class', upgrade: 'screen-upgrade', paused: 'screen-pause', over: 'screen-over', book: 'screen-book', playing: null };
    var ids = ['screen-menu', 'screen-class', 'screen-upgrade', 'screen-pause', 'screen-over', 'screen-book'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.classList.remove('active');
    }
    if (map[s]) {
      var target = document.getElementById(map[s]);
      if (target) target.classList.add('active');
    }
    var hud = document.getElementById('hud-buttons');
    if (hud) hud.style.display = (s === 'playing' || s === 'paused') ? 'block' : 'none';
  },

  bindInput: function () {
    var canvas = this.canvas;
    var self = this;
    this.touches = {};

    var onStart = function (e) {
      e.preventDefault(); Audio2.unlock();
      if (self.state !== 'playing') return;
      var touches = e.changedTouches;
      for (var i = 0; i < touches.length; i++) {
        var t = touches[i];
        var x = t.clientX, y = t.clientY;
        var side = x < self.W * 0.5 ? 'left' : 'right';
        if (self._isOverUI(x, y)) continue;
        if (side === 'left' && self.moveTouchId === null) {
          self.moveTouchId = t.identifier;
          self.touches[t.identifier] = { x: x, y: y, startX: x, startY: y };
        } else if (side === 'right' && self.aimTouchId === null) {
          self.aimTouchId = t.identifier;
          self.aimActive = true;
          self.touches[t.identifier] = { x: x, y: y, startX: x, startY: y };
          self.updateAim(x, y);
        }
      }
    };

    var onMove = function (e) {
      e.preventDefault();
      if (self.state !== 'playing') return;
      var touches = e.changedTouches;
      for (var i = 0; i < touches.length; i++) {
        var t = touches[i];
        if (t.identifier === self.moveTouchId) {
          var d = self.touches[t.identifier];
          if (d) { d.x = t.clientX; d.y = t.clientY; }
        } else if (t.identifier === self.aimTouchId) {
          var d2 = self.touches[t.identifier];
          if (d2) { d2.x = t.clientX; d2.y = t.clientY; }
          self.updateAim(t.clientX, t.clientY);
        }
      }
    };

    var onEnd = function (e) {
      e.preventDefault();
      var touches = e.changedTouches;
      for (var i = 0; i < touches.length; i++) {
        var t = touches[i];
        delete self.touches[t.identifier];
        if (t.identifier === self.moveTouchId) {
          self.moveTouchId = null;
          self.moveVec.x = 0; self.moveVec.y = 0;
        }
        if (t.identifier === self.aimTouchId) {
          self.aimTouchId = null;
          self.aimActive = false;
        }
      }
    };

    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onEnd, { passive: false });

    canvas.addEventListener('mousedown', function (e) {
      Audio2.unlock();
      if (self.state !== 'playing') return;
      self.mouseDown = true;
      if (e.clientX >= self.W * 0.5) {
        self.aimActive = true;
        self.updateAim(e.clientX, e.clientY);
      }
    });
    canvas.addEventListener('mousemove', function (e) {
      if (self.state !== 'playing') return;
      if (self.aimActive) self.updateAim(e.clientX, e.clientY);
      if (e.buttons === 1 && e.clientX < self.W * 0.5) {
        var dx = e.clientX - self.W * 0.25;
        var dy = e.clientY - self.H * 0.5;
        var l = Math.sqrt(dx * dx + dy * dy) || 1;
        self.moveVec.x = dx / l; self.moveVec.y = dy / l;
      }
    });
    canvas.addEventListener('mouseup', function () {
      self.mouseDown = false; self.aimActive = false;
      self.moveVec.x = 0; self.moveVec.y = 0;
    });
    canvas.addEventListener('mouseleave', function () {
      self.mouseDown = false; self.aimActive = false;
      self.moveVec.x = 0; self.moveVec.y = 0;
    });

    window.addEventListener('keydown', function (e) {
      self.keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') {
        if (self.state === 'playing') self.pause();
        else if (self.state === 'book') Book.closeBook();
      }
    });
    window.addEventListener('keyup', function (e) { self.keys[e.key.toLowerCase()] = false; });
  },

  _isOverUI: function (x, y) {
    var el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    if (!el) return false;
    while (el) {
      if (el.id === 'btn-pause') return true;
      if (el.className && typeof el.className === 'string' && el.className.indexOf('spell-btn') !== -1) return true;
      el = el.parentNode;
    }
    return false;
  },

  updateAim: function (sx, sy) {
    if (!this.player) return;
    var wx = sx + this.camX, wy = sy + this.camY;
    var dx = wx - this.player.x, dy = wy - this.player.y;
    var l = Math.sqrt(dx * dx + dy * dy) || 1;
    this.aimVec.x = dx / l; this.aimVec.y = dy / l;
  },

  readMovement: function () {
    if (this.moveTouchId !== null) {
      var d = this.touches[this.moveTouchId];
      if (d) {
        var dx = d.x - d.startX, dy = d.y - d.startY;
        var l = Math.sqrt(dx * dx + dy * dy);
        if (l < 6) return { x: 0, y: 0 };
        var mag = Math.min(l / 60, 1);
        return { x: (dx / l) * mag, y: (dy / l) * mag };
      }
    }
    var kx = 0, ky = 0;
    if (this.keys) {
      if (this.keys['a'] || this.keys['arrowleft'])  kx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) kx += 1;
      if (this.keys['w'] || this.keys['arrowup'])    ky -= 1;
      if (this.keys['s'] || this.keys['arrowdown'])  ky += 1;
    }
    return { x: kx, y: ky };
  },

  findAutoAimTarget: function (x, y, maxRange, preferAngle, coneRad) {
    var best = null, bestScore = Infinity;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      var d = Utils.dist(x, y, e.x, e.y);
      if (d > maxRange) continue;
      var score = d;
      if (e.isBoss) score *= 0.5;
      if (preferAngle !== undefined && coneRad !== undefined) {
        var a = Math.atan2(e.y - y, e.x - x);
        var diff = Math.abs(Utils.angleDiff(a, preferAngle));
        if (diff > coneRad) continue;
        score += diff * 120;
      }
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  },

  applyClassModifiers: function (p) {
    var cls = this.mageClass;
    if (!cls) return;
    if (cls === 'pyromancer') {
      p.damageMul *= 1.15;
      p.metaFireBurn += 4;
      p.spellDisabled[0] = true;
      p.spellCostMod[1] = 14 / SPELLS[1].cost;
      p.spellCdMod[1] = 1.2 / SPELLS[1].cooldown;
    } else if (cls === 'cryomancer') {
      p.metaNovaDmg += 0.5;
      p.spellCostMod[0] = 22 / SPELLS[0].cost;
      p.spellCdMod[0] = 4.0 / SPELLS[0].cooldown;
    } else if (cls === 'electromancer') {
      p.critChance += 0.20;
      p.manaRegen *= 0.8;
      p.metaChainRange += 60;
      p.chainMaxJumps = 6;
    }
  },

  startGame: function () {
    this.player = new Player(0, 0);

    for (var i = 0; i < META_STATS.length; i++) {
      var up = META_STATS[i];
      var lvl = this.meta.stats[up.id] || 0;
      if (lvl > 0) up.apply(this.player, lvl);
    }
    for (var j = 0; j < META_SPELLS.length; j++) {
      var up2 = META_SPELLS[j];
      var lvl2 = this.meta.spells[up2.id] || 0;
      if (lvl2 > 0) up2.apply(this.player, lvl2);
    }
    this.applyClassModifiers(this.player);

    this.enemies = []; this.projectiles = []; this.enemyProjectiles = [];
    this.particles = []; this.pickups = []; this.damageTexts = []; this.meteors = [];
    this.camX = -this.W / 2; this.camY = -this.H / 2;
    this.shakeAmt = 0;
    this.wave = 0; this.waveActive = false;
    this.spawnQueue = []; this.spawnTimer = 0;
    this.kills = 0; this.score = 0; this.boltCooldown = 0;
    this.moveVec = { x: 0, y: 0 }; this.aimVec = { x: 1, y: 0 };
    this.aimActive = false; this.moveTouchId = null; this.aimTouchId = null;
    this.touches = {};
    this.lockTarget = null; this.lockTimer = 0;
    this.comboCount = 0; this.comboTimer = 0;
    this.screenFlash = 0;
    this._playerTrailTimer = 0;
    this.bossActive = null;
    this.bloodMoonActive = false;
    this.bloodMoonScoreMul = 1;
    this.performanceMode = false;
    this.lowQuality = false;
    this._qualityCooldown = 0;
    this.frameTimes = [];
    this.setState('playing');
    this.startWave();
  },

  pause: function () { if (this.state === 'playing') this.setState('paused'); },
  resume: function () { if (this.state === 'paused') this.setState('playing'); },
  togglePause: function () {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  },

  gameOver: function () {
    Audio2.gameOver(); Utils.vibrate(200);
    if (this.score > this.best) {
      this.best = this.score;
      Storage.set('arcanum_best', this.best);
    }
    var earned = Math.floor(this.score / 60) + this.wave * 3;
    this.meta.souls += earned;
    this.meta.totalSouls += earned;
    this.saveMeta();

    var ids = {
      'over-wave': this.wave, 'over-kills': this.kills,
      'over-score': Utils.formatNum(this.score),
      'over-best': Utils.formatNum(this.best),
      'best-score': Utils.formatNum(this.best)
    };
    for (var k in ids) {
      var el = document.getElementById(k);
      if (el) el.textContent = ids[k];
    }
    var soulsEl = document.getElementById('over-souls');
    if (soulsEl) soulsEl.textContent = '+' + earned;
    this.setState('over');
  },

  startWave: function () {
    this.wave++;
    this.waveActive = true;

    // Кровавая луна — шанс на обычных волнах с 4-й
    if (this.wave >= 4 && this.wave % 5 !== 0) {
      if (Math.random() < 0.25) {
        this.bloodMoonActive = true;
        this.bloodMoonScoreMul = 4; // +1 за меньшую сложность
        this.screenFlash = 0.4;
        this.screenFlashColor = 'rgba(200,20,20,0.5)';
        Utils.vibrate(200);
        Audio2.bossAppear();
        this.shake(12);
      } else {
        this.bloodMoonActive = false;
        this.bloodMoonScoreMul = 1;
      }
    } else {
      this.bloodMoonActive = false;
      this.bloodMoonScoreMul = 1;
    }

    // Обновляем performanceMode сразу после установки флага
    this.performanceMode = this.lowQuality || this.bloodMoonActive;

    if (this.wave % 5 === 0) {
      this.spawnQueue = ['imp', 'imp'];
      this.spawnBoss();
    } else {
      this.spawnQueue = this.buildWave(this.wave);
    }
    this.spawnTimer = 0.4;
  },

  spawnBoss: function () {
    var p = this.player;
    var minR = Math.max(this.W, this.H) * 0.7;
    var a = Math.random() * 6.2832;
    var x = p.x + Math.cos(a) * minR;
    var y = p.y + Math.sin(a) * minR;
    var bossType = pickBossType(this.wave);
    var boss = new Boss(x, y, this.wave, bossType);
    this.enemies.push(boss);
    this.bossActive = boss;
    this.shake(18);
    this.screenFlash = 0.45;
    this.screenFlashColor = boss.hexToRgba(boss.bossColor, 0.45);
    Audio2.bossAppear();
    Utils.vibrate(150);
    for (var i = 0; i < 3; i++) {
      this.particles.push(new RingParticle(x, y, 100 + i * 60, 0.9, boss.bossColor, 4));
    }
  },

  getMaxEnemiesForCurrentWave: function () {
    return this.bloodMoonActive ? 22 : this.maxEnemies;
  },

  buildWave: function (wave) {
    var list = [];
    var budget = Math.min(4 + wave * 1.5, 24);
    var pool = ['imp'];
    if (wave >= 2) pool.push('wraith');
    if (wave >= 3) pool.push('shade');
    if (wave >= 4) pool.push('brute');
    var spent = 0, guard = 0;
    while (spent < budget && guard++ < 400) {
      var type = Utils.pick(pool);
      var cost = ENEMY_TYPES[type].hp / 22;
      if (spent + cost > budget + 2) break;
      list.push(type); spent += cost;
    }
    var minCount = Math.min(4 + Math.floor(wave * 0.5), 20);
    while (list.length < minCount) list.push('imp');
    var cap = this.getMaxEnemiesForCurrentWave();
    while (list.length > cap) list.pop();
    Utils.shuffle(list);
    return list;
  },

  spawnEnemy: function (type) {
    var p = this.player;
    var minR = Math.max(this.W, this.H) * 0.62;
    var maxR = minR + 160;
    var a = Math.random() * 6.2832;
    var r = minR + Math.random() * (maxR - minR);
    var x = p.x + Math.cos(a) * r;
    var y = p.y + Math.sin(a) * r;
    var eliteChance = Math.min(0.20, 0.08 + this.wave * 0.002);
    var isElite = Math.random() < eliteChance;
    var enemy = new Enemy(x, y, type, this.wave, isElite);
    if (this.bloodMoonActive) {
      // мягче, чем было (1.5 → 1.3 HP, 1.25 → 1.15 урон), зато очки x4
      enemy.maxHp = Math.round(enemy.maxHp * 1.3);
      enemy.hp = enemy.maxHp;
      enemy.damage *= 1.15;
    }
    this.enemies.push(enemy);
    if (!this.performanceMode) {
      this.particles.push(new RingParticle(x, y, isElite ? 60 : 40, 0.4, isElite ? '#ffc857' : ENEMY_TYPES[type].color, isElite ? 3 : 2));
      var spCount = isElite ? 10 : 6;
      for (var i = 0; i < spCount; i++) {
        if (this.particles.length >= this.maxParticles) break;
        var pa = Math.random() * 6.2832;
        var ps = 40 + Math.random() * 80;
        this.particles.push(new Particle(x, y, Math.cos(pa) * ps, Math.sin(pa) * ps,
          0.3 + Math.random() * 0.25, isElite ? '#ffc857' : ENEMY_TYPES[type].color, 2 + Math.random() * 2));
      }
    }
  },

  updateWaves: function (dt) {
    if (!this.waveActive) return;
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        var count = Math.min(this.spawnQueue.length, 2);
        var cap = this.getMaxEnemiesForCurrentWave() + 5;
        for (var i = 0; i < count; i++) {
          if (this.enemies.length >= cap) break;
          this.spawnEnemy(this.spawnQueue.shift());
        }
        this.spawnTimer = Math.max(0.35, 0.85 - this.wave * 0.01);
      }
    } else if (this.enemies.length === 0) {
      this.waveActive = false;
      this.score += 25 * this.wave * this.bloodMoonScoreMul;
      Audio2.levelUp(); Utils.vibrate(40);
      this.showUpgrades();
    }
  },

  showUpgrades: function () {
    var waveEl = document.getElementById('up-wave');
    if (waveEl) waveEl.textContent = this.wave;

    var pool = Utils.shuffle(UPGRADES.slice());
    this.upgradeChoices = [];
    for (var i = 0; i < 3; i++) {
      this.upgradeChoices.push({ def: pool[i], rarity: rollRarity() });
    }

    var list = document.getElementById('upgrade-list');
    if (!list) { this.setState('playing'); return; }
    list.innerHTML = '';
    var self = this;
    var cards = [];

    for (var j = 0; j < this.upgradeChoices.length; j++) {
      (function (idx) {
        var choice = self.upgradeChoices[idx];
        var rarity = RARITIES[choice.rarity];
        var actualValue = choice.def.base * rarity.mult;
        var actualDesc = choice.def.desc(actualValue);

        var container = document.createElement('div');
        container.className = 'card-flip-container';
        container.innerHTML =
          '<div class="card-flip-inner">' +
            '<div class="card-face card-back"></div>' +
            '<div class="card-face card-front rarity-' + choice.rarity + '">' +
              '<span class="rarity-badge ' + choice.rarity + '">' + rarity.label + '</span>' +
              '<div class="card-icon">' + choice.def.icon + '</div>' +
              '<div class="card-body">' +
                '<div class="card-name">' + choice.def.name + '</div>' +
                '<div class="card-desc">' + actualDesc + '</div>' +
              '</div>' +
            '</div>' +
          '</div>';

        var handler = function (e) {
          e.preventDefault(); e.stopPropagation();
          if (!container.classList.contains('clickable')) return;
          Audio2.uiClick(); Utils.vibrate(30);
          self.applyUpgrade(idx);
        };
        container.addEventListener('click', handler);
        container.addEventListener('touchstart', handler, { passive: false });

        list.appendChild(container);
        cards.push(container);
      })(j);
    }

    this.setState('upgrade');

    for (var k = 0; k < cards.length; k++) {
      (function (idx, card) {
        setTimeout(function () { card.classList.add('revealed'); }, 100 + idx * 120);
        setTimeout(function () { card.classList.add('flipped'); Audio2.cardFlip(); }, 650 + idx * 350);
        setTimeout(function () { card.classList.add('clickable'); }, 1150 + idx * 350);
      })(k, cards[k]);
    }
  },

  applyUpgrade: function (idx) {
    var choice = this.upgradeChoices[idx];
    if (!choice || !this.player) return;
    var rarity = RARITIES[choice.rarity];
    var actualValue = choice.def.base * rarity.mult;
    choice.def.apply(this.player, actualValue);

    var p = this.player;
    var particleCount = this.performanceMode ? 8 : 20;
    for (var i = 0; i < particleCount; i++) {
      var a = Math.random() * 6.2832;
      var s = 80 + Math.random() * 140;
      var pt = new Particle(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s,
        0.5 + Math.random() * 0.5, i % 3 === 0 ? '#ffffff' : rarity.color, 2 + Math.random() * 3);
      pt.drag = 0.9;
      this.particles.push(pt);
    }
    this.particles.push(new RingParticle(p.x, p.y, 130, 0.6, rarity.color, 4));
    this.particles.push(new RingParticle(p.x, p.y, 90, 0.45, '#ffffff', 2));

    if (choice.rarity === 'legendary') {
      this.screenFlash = 0.15;
      this.screenFlashColor = 'rgba(255,200,87,0.4)';
      Utils.vibrate(60);
    } else if (choice.rarity === 'epic') {
      this.screenFlash = 0.08;
      this.screenFlashColor = 'rgba(181,107,255,0.3)';
    }

    this.startWave();
    this.setState('playing');
  },

  castSpell: function (index) {
    if (this.state !== 'playing') return;
    var p = this.player;
    if (!p || p.dead) return;
    if (p.spellDisabled && p.spellDisabled[index]) return;
    var spell = SPELLS[index];
    if (p.cd[index] > 0) return;
    var cost = Math.round(spell.cost * (p.spellCostMod ? p.spellCostMod[index] : 1));
    if (p.mana < cost) { Utils.vibrate(15); return; }
    p.mana -= cost;
    var cdMul = p.spellCdMod ? p.spellCdMod[index] : 1;
    p.cd[index] = spell.cooldown * p.cooldownMul * cdMul;
    p.castFlash = 0.15;
    Utils.vibrate(20);
    if (spell.id === 'nova') this.castNova(p);
    else if (spell.id === 'fireball') this.castFireball(p);
    else if (spell.id === 'chain') this.castChain(p);
    else if (spell.id === 'meteor') this.castMeteor(p);
  },

  castNova: function (p) {
    Audio2.castNova();
    var radius = 175;
    var dmg = 34 * p.damageMul * (1 + (p.metaNovaDmg || 0));
    if (!this.performanceMode) {
      this.particles.push(new RingParticle(p.x, p.y, radius, 0.7, '#7fdcff', 5));
      this.particles.push(new RingParticle(p.x, p.y, radius * 0.75, 0.5, '#b7ecff', 3));
    }
    var count = this.performanceMode ? 10 : 30;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * 6.2832;
      var s = 160 + Math.random() * 140;
      if (this.particles.length >= this.maxParticles) break;
      var pt = new Particle(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s,
        0.4 + Math.random() * 0.35, i % 3 === 0 ? '#ffffff' : '#7fdcff', 2 + Math.random() * 3);
      pt.drag = 0.9;
      this.particles.push(pt);
    }
    this.shake(7);
    this.screenFlash = 0.12;
    this.screenFlashColor = 'rgba(127,220,255,0.35)';
    for (var j = 0; j < this.enemies.length; j++) {
      var e = this.enemies[j];
      if (e.dead) continue;
      var d = Utils.dist(p.x, p.y, e.x, e.y);
      if (d < radius + e.radius) {
        var isCrit = Math.random() < p.critChance;
        var final = isCrit ? dmg * p.critMul : dmg;
        e.hurt(final);
        e.applySlow(0.45, 2.6);
        var ang = Math.atan2(e.y - p.y, e.x - p.x);
        e.knockback(ang, 190);
        this.spawnDamageText(e.x, e.y - e.radius, final, isCrit, '#7fdcff');
        this.applyLifesteal(final);
        if (e.dead) this.onEnemyDeath(e);
      }
    }
  },

  castFireball: function (p) {
    Audio2.castFire();
    var dmg = 46 * p.damageMul;
    var aimAngle = Math.atan2(this.aimVec.y, this.aimVec.x);
    var target = this.findAutoAimTarget(p.x, p.y, 560, aimAngle, Math.PI * 0.5);
    var fireAngle = aimAngle;
    if (target) {
      fireAngle = Math.atan2(target.y - p.y, target.x - p.x);
      this.lockTarget = target;
      this.lockTimer = 0.55;
      Audio2.lock();
      if (!this.performanceMode) {
        this.particles.push(new RingParticle(target.x, target.y, target.radius + 22, 0.35, '#ff9a3c', 2));
      }
    }
    if (this.projectiles.length >= this.maxProjectiles) return;
    var burnAmount = 6 + (p.metaFireBurn || 0);
    var pr = new Projectile(p.x, p.y, fireAngle, 520, dmg,
      { radius: 9, color: '#ff7a3c', life: 1.8, burn: burnAmount, knockback: 90 });
    pr.isFireball = true;
    pr.target = target;
    pr.homing = target ? (7 + (p.metaFireHoming || 0)) : 0;
    this.projectiles.push(pr);
    if (!this.performanceMode) {
      for (var k = 0; k < 8; k++) {
        var a2 = fireAngle + (Math.random() - 0.5);
        var s2 = 60 + Math.random() * 120;
        if (this.particles.length >= this.maxParticles) break;
        this.particles.push(new Particle(p.x, p.y,
          Math.cos(a2) * s2, Math.sin(a2) * s2,
          0.35, Math.random() < 0.5 ? '#ffb066' : '#ffd166', 2 + Math.random() * 3));
      }
    }
    this.screenFlash = 0.06;
    this.screenFlashColor = 'rgba(255,140,50,0.25)';
  },

  castChain: function (p) {
    Audio2.castChain();
    var maxJumps = p.chainMaxJumps || 4;
    var range = 220 + (p.metaChainRange || 0);
    var dmgBase = 26 * p.damageMul;
    var current = { x: p.x, y: p.y };
    var hit = [];
    var points = [{ x: p.x, y: p.y }];

    for (var j = 0; j < maxJumps; j++) {
      var best = null, bestD = Infinity;
      for (var k = 0; k < this.enemies.length; k++) {
        var e = this.enemies[k];
        if (e.dead) continue;
        var already = false;
        for (var h = 0; h < hit.length; h++) if (hit[h] === e) { already = true; break; }
        if (already) continue;
        var d = Utils.dist(current.x, current.y, e.x, e.y);
        if (d < range && d < bestD) { bestD = d; best = e; }
      }
      if (!best) break;
      hit.push(best);
      points.push({ x: best.x, y: best.y });
      var isCrit = Math.random() < p.critChance;
      var dmg = isCrit ? dmgBase * p.critMul : dmgBase;
      best.hurt(dmg);
      best.applySlow(0.75, 0.8);
      this.spawnDamageText(best.x, best.y - best.radius, dmg, isCrit, '#9ee8ff');
      this.applyLifesteal(dmg);
      if (best.dead) this.onEnemyDeath(best);
      current = { x: best.x, y: best.y };
    }

    if (!this.performanceMode) {
      for (var ii = 0; ii < points.length - 1; ii++) {
        var a = points[ii], b = points[ii + 1];
        for (var seg = 0; seg < 8; seg++) {
          var t = seg / 8;
          if (this.particles.length >= this.maxParticles) break;
          this.particles.push(new Particle(
            Utils.lerp(a.x, b.x, t) + (Math.random() - 0.5) * 20,
            Utils.lerp(a.y, b.y, t) + (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80,
            0.28, seg % 2 ? '#9ee8ff' : '#ffffff', 2 + Math.random() * 2
          ));
        }
      }
    }
    if (points.length > 1) { this.shake(5); this.screenFlash = 0.08; this.screenFlashColor = 'rgba(158,232,255,0.25)'; }
  },

  castMeteor: function (p) {
    Audio2.castFire();
    var aimAngle = Math.atan2(this.aimVec.y, this.aimVec.x);
    var target = this.findAutoAimTarget(p.x, p.y, 600, aimAngle, Math.PI * 0.7);
    var tx, ty;
    if (target) {
      tx = target.x;
      ty = target.y;
      this.lockTarget = target;
      this.lockTimer = 1.0;
    } else {
      tx = p.x + this.aimVec.x * 250;
      ty = p.y + this.aimVec.y * 250;
    }
    var meteor = {
      x: tx, y: ty,
      delay: 1.0, maxDelay: 1.0,
      radius: 200,
      damage: 120 * p.damageMul,
      impacted: false,
      dead: false
    };
    this.meteors.push(meteor);
    if (!this.performanceMode) {
      this.particles.push(new RingParticle(tx, ty, 30, 0.5, '#ff9a3c', 2));
    }
    Utils.vibrate(30);
    Audio2.lock();
  },

  updateMeteors: function (dt) {
    var p = this.player;
    for (var mi = this.meteors.length - 1; mi >= 0; mi--) {
      var mt = this.meteors[mi];
      mt.delay -= dt;
      if (!mt.impacted && mt.delay <= 0) {
        mt.impacted = true;
        for (var i = 0; i < this.enemies.length; i++) {
          var e = this.enemies[i];
          if (e.dead) continue;
          var d = Utils.dist(mt.x, mt.y, e.x, e.y);
          if (d < mt.radius + e.radius) {
            var isCrit = Math.random() < p.critChance;
            var dmg = isCrit ? mt.damage * p.critMul : mt.damage;
            e.hurt(dmg);
            e.knockback(Math.atan2(e.y - mt.y, e.x - mt.x), 320);
            e.applyBurn(8, 3);
            this.spawnDamageText(e.x, e.y - e.radius, dmg, isCrit, '#ff9a3c');
            this.applyLifesteal(dmg);
            if (e.dead) this.onEnemyDeath(e);
          }
        }
        this.shake(20);
        this.screenFlash = 0.4;
        this.screenFlashColor = 'rgba(255,140,50,0.55)';
        Utils.vibrate(120);
        if (!this.performanceMode) {
          this.particles.push(new RingParticle(mt.x, mt.y, mt.radius, 0.7, '#ff9a3c', 6));
          this.particles.push(new RingParticle(mt.x, mt.y, mt.radius * 1.3, 1.0, 'rgba(255,180,80,0.4)', 4));
          this.particles.push(new RingParticle(mt.x, mt.y, mt.radius * 0.7, 0.45, '#ffffff', 3));
          for (var k = 0; k < 40; k++) {
            if (this.particles.length >= this.maxParticles) break;
            var a = Math.random() * 6.2832;
            var s = 150 + Math.random() * 300;
            this.particles.push(new Particle(mt.x, mt.y,
              Math.cos(a) * s, Math.sin(a) * s,
              0.5 + Math.random() * 0.6,
              Math.random() < 0.5 ? '#ffb066' : '#ffd166', 3 + Math.random() * 3));
          }
        }
      }
      if (mt.impacted) mt.delay -= dt;
      if (mt.impacted && mt.delay < -0.6) mt.dead = true;
      if (mt.dead) this.meteors.splice(mi, 1);
    }
  },

  applyLifesteal: function (dmg) {
    var p = this.player;
    if (p.lifesteal > 0) p.heal(dmg * p.lifesteal);
  },

  updateBasicAttack: function (dt) {
    var p = this.player;
    this.boltCooldown -= dt;
    var holding = this.aimActive || this.mouseDown;
    if (!holding || this.boltCooldown > 0) return;
    var interval = 0.26 * p.cooldownMul;
    this.boltCooldown = interval;
    Audio2.shoot();
    var baseAngle = Math.atan2(this.aimVec.y, this.aimVec.x);
    var count = p.projectiles;
    var spread = count > 1 ? 0.13 : 0;
    for (var i = 0; i < count; i++) {
      if (this.projectiles.length >= this.maxProjectiles) break;
      var offset = (i - (count - 1) / 2) * spread;
      var a = baseAngle + offset;
      var dmg = 13 * p.damageMul;
      this.projectiles.push(new Projectile(p.x, p.y, a, 640, dmg, {
        radius: 5, color: '#8ad4ff', life: 1.1,
        pierce: p.boltPierce, burn: p.boltBurn
      }));
    }
    p.castFlash = 0.08;
    if (!this.performanceMode) {
      for (var j = 0; j < 3; j++) {
        var aa = baseAngle + (Math.random() - 0.5) * 0.8;
        var ss = 60 + Math.random() * 70;
        if (this.particles.length >= this.maxParticles) break;
        this.particles.push(new Particle(p.x, p.y, Math.cos(aa) * ss, Math.sin(aa) * ss, 0.18, '#8ad4ff', 2.5));
      }
    }
  },

  update: function (dt) {
    if (this.state !== 'playing') return;
    var p = this.player;
    if (!p) return;

    // Обновляем performanceMode КАЖДЫЙ кадр — это критично для Blood Moon
    this.performanceMode = this.lowQuality || this.bloodMoonActive;

    // Лимиты под режим производительности
    var effMaxParticles = this.performanceMode ? 140 : 320;
    var effMaxDamageTexts = this.performanceMode ? 20 : 40;

    var mv = this.readMovement();
    p.update(dt, mv.x, mv.y);
    this.updateBasicAttack(dt);

    if (!this.performanceMode && (Math.abs(p.vx) > 20 || Math.abs(p.vy) > 20)) {
      this._playerTrailTimer -= dt;
      if (this._playerTrailTimer <= 0) {
        this._playerTrailTimer = 0.06;
        if (this.particles.length < effMaxParticles) {
          this.particles.push(new Particle(
            p.x + (Math.random() - 0.5) * 16,
            p.y + 4 + Math.random() * 8,
            (Math.random() - 0.5) * 40, -20 - Math.random() * 10,
            0.55, Math.random() < 0.5 ? '#b56bff' : '#8ad4ff', 2 + Math.random() * 2));
        }
      }
    }

    if (this.screenFlash > 0) this.screenFlash -= dt;
    if (this.lockTimer > 0) this.lockTimer -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    this.updateMeteors(dt);

    // Враги
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        if (e === this.bossActive) {
          this.bossActive = null;
          Audio2.bossDie();
          this.shake(20);
          this.screenFlash = 0.5;
          this.screenFlashColor = e.hexToRgba(e.bossColor, 0.5);
          var drops = this.getBossDrops(e);
          for (var di = 0; di < drops.length; di++) this.pickups.push(drops[di]);
        }
        continue;
      }
      e.update(dt, p, this.enemies);

      var d = Utils.dist(e.x, e.y, p.x, p.y);
      if (d < e.radius + p.radius) {
        if (e._touchCd <= 0) {
          var dealt = p.hurt(e.damage);
          e._touchCd = 0.7;
          Audio2.playerHurt(); Utils.vibrate(60);
          this.shake(8);
          this.spawnDamageText(p.x, p.y - p.radius - 6, dealt, false, '#ff5b6e');
          var ang = Math.atan2(e.y - p.y, e.x - p.x);
          e.knockback(ang, 120);
          if (p.dead) { this.gameOver(); return; }
        }
      }
      if (e._touchCd > 0) e._touchCd -= dt;

      var far = Utils.dist(e.x, e.y, p.x, p.y);
      if (far > 1400) {
        var a = Math.atan2(p.y - e.y, p.x - e.x);
        e.x += Math.cos(a) * 3; e.y += Math.sin(a) * 3;
      }
    }

    this.spatialGrid.rebuild(this.enemies);

    // Снаряды игрока
    for (var j = this.projectiles.length - 1; j >= 0; j--) {
      var pr = this.projectiles[j];
      pr.update(dt);
      if (pr.dead) { this.projectiles.splice(j, 1); continue; }

      if (!this.performanceMode && this.particles.length < effMaxParticles) {
        pr._trailTimer -= dt;
        if (pr._trailTimer <= 0) {
          pr._trailTimer = 0.04;
          var trailColor = pr.isFireball ? (Math.random() < 0.5 ? '#ffb066' : '#ff7a3c') : pr.color;
          var trailPt = new Particle(pr.x, pr.y,
            (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50,
            0.3, trailColor, pr.radius * 0.55);
          trailPt.drag = 0.9;
          this.particles.push(trailPt);
        }
      }

      var nearby = this.spatialGrid.query(pr.x, pr.y, pr.radius + 55);
      for (var k = 0; k < nearby.length; k++) {
        var en = nearby[k];
        if (en.dead || pr.hasHit(en)) continue;
        var dd = Utils.dist(pr.x, pr.y, en.x, en.y);
        if (dd < pr.radius + en.radius) {
          var isCrit = Math.random() < p.critChance;
          var dmgMult = 1;
          if (this.mageClass === 'cryomancer' && en.slowTimer > 0) dmgMult = 1.5;
          var dmg = isCrit ? pr.damage * p.critMul * dmgMult : pr.damage * dmgMult;
          en.hurt(dmg);
          pr.hitSet.push(en);
          var pa = Math.atan2(pr.vy, pr.vx);
          en.knockback(pa, pr.knockback || 55);
          if (pr.burn > 0) en.applyBurn(pr.burn, 2.5);
          this.spawnDamageText(en.x, en.y - en.radius, dmg, isCrit, pr.color);
          this.applyLifesteal(dmg);
          Audio2.enemyHit();
          if (!this.performanceMode) {
            this.particles.push(new RingParticle(pr.x, pr.y, 28, 0.22, pr.color, 2));
            if (isCrit) {
              this.particles.push(new RingParticle(pr.x, pr.y, 50, 0.3, '#ffc857', 3));
              this.screenFlash = 0.05;
              this.screenFlashColor = 'rgba(255,200,80,0.3)';
              Utils.vibrate(30);
            }
            for (var q2 = 0; q2 < 4; q2++) {
              if (this.particles.length >= effMaxParticles) break;
              var spa = Math.random() * 6.2832;
              var sps = 50 + Math.random() * 100;
              this.particles.push(new Particle(pr.x, pr.y,
                Math.cos(spa) * sps, Math.sin(spa) * sps,
                0.35, pr.color, 2 + Math.random() * 2));
            }
          }
          if (en.dead) this.onEnemyDeath(en);
          if (pr.pierce > 0) { pr.pierce--; pr.damage *= 0.85; }
          else { pr.dead = true; break; }
        }
      }
    }

    // Вражеские снаряды
    for (var ep = this.enemyProjectiles.length - 1; ep >= 0; ep--) {
      var epr = this.enemyProjectiles[ep];
      epr.update(dt);
      if (epr.dead) { this.enemyProjectiles.splice(ep, 1); continue; }
      var dp = Utils.dist(epr.x, epr.y, p.x, p.y);
      if (dp < epr.radius + p.radius) {
        var dmgTaken = p.hurt(epr.damage);
        Audio2.playerHurt();
        Utils.vibrate(40);
        this.shake(5);
        this.spawnDamageText(p.x, p.y - p.radius - 6, dmgTaken, false, '#ff3355');
        if (!this.performanceMode) this.particles.push(new RingParticle(epr.x, epr.y, 28, 0.25, '#ff3355', 2));
        epr.dead = true;
        if (p.dead) { this.gameOver(); return; }
      }
    }

    // Пикапы
    for (var m = this.pickups.length - 1; m >= 0; m--) {
      var pk = this.pickups[m];
      var collected = pk.update(dt, p);
      if (pk.dead) this.pickups.splice(m, 1);
      if (collected) {
        if (pk.type === 'hp') p.heal(pk.value);
        else if (pk.type === 'mana') p.mana = Math.min(p.maxMana, p.mana + pk.value);
        else if (pk.type === 'xp') {
          var lv = p.addXp(pk.value);
          if (lv > 0) {
            p.maxHp += 6; p.heal(12);
            if (!this.performanceMode) {
              this.particles.push(new RingParticle(p.x, p.y, 110, 0.5, '#ffc857', 3));
            }
            this.screenFlash = 0.06;
            this.screenFlashColor = 'rgba(255,200,80,0.25)';
          }
        }
      }
    }

    // Частицы
    for (var n2 = this.particles.length - 1; n2 >= 0; n2--) {
      var pt = this.particles[n2];
      pt.update(dt);
      if (pt.dead) this.particles.splice(n2, 1);
    }
    if (this.particles.length > effMaxParticles) {
      this.particles.splice(0, this.particles.length - effMaxParticles);
    }

    // Текст урона
    for (var o = this.damageTexts.length - 1; o >= 0; o--) {
      var txt = this.damageTexts[o];
      txt.life -= dt;
      txt.x += txt.vx * dt;
      txt.y += txt.vy * dt;
      txt.vy += txt.gravity * dt;
      txt.vx *= Math.pow(0.92, dt * 60);
      if (txt.life <= 0) this.damageTexts.splice(o, 1);
    }
    if (this.damageTexts.length > effMaxDamageTexts) {
      this.damageTexts.splice(0, this.damageTexts.length - effMaxDamageTexts);
    }

    this.updateWaves(dt);

    this.camX = Utils.damp(this.camX, p.x - this.W / 2, 9, dt);
    this.camY = Utils.damp(this.camY, p.y - this.H / 2, 9, dt);

    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30);
      this.shakeX = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmt;
    } else { this.shakeX = 0; this.shakeY = 0; }

    this.updateSpellButtons();
  },

  getBossDrops: function (boss) {
    var drops = [];
    var lvl = boss.bossLevel;
    var mul = this.bloodMoonActive ? 2 : 1;
    drops.push(new Pickup(boss.x, boss.y, 'hp', 40 + lvl * 10));
    drops.push(new Pickup(boss.x + 20, boss.y, 'mana', 40 + lvl * 10));
    if (boss.bossType === 'titan') {
      drops.push(new Pickup(boss.x - 20, boss.y, 'hp', 40));
      drops.push(new Pickup(boss.x + 40, boss.y, 'hp', 40));
      for (var i = 0; i < 2; i++) drops.push(new Pickup(boss.x + i * 14 - 7, boss.y + 20, 'xp', 25));
    } else if (boss.bossType === 'summoner') {
      for (var j = 0; j < 5; j++) drops.push(new Pickup(boss.x + j * 12 - 24, boss.y + 10, 'xp', 25));
    } else if (boss.bossType === 'mage') {
      drops.push(new Pickup(boss.x - 20, boss.y, 'mana', 50));
      drops.push(new Pickup(boss.x + 30, boss.y, 'mana', 50));
      for (var k = 0; k < 3; k++) drops.push(new Pickup(boss.x + k * 12 - 12, boss.y + 20, 'xp', 25));
    } else {
      for (var d = 0; d < 3; d++) drops.push(new Pickup(boss.x + d * 14 - 14, boss.y + 10, 'xp', 30));
    }
    if (mul > 1) {
      var extra = [];
      for (var e = 0; e < drops.length; e++) {
        var orig = drops[e];
        extra.push(new Pickup(orig.x + (Math.random() - 0.5) * 40, orig.y + (Math.random() - 0.5) * 40, orig.type, Math.round(orig.value * 0.6)));
      }
      drops = drops.concat(extra);
    }
    return drops;
  },

  onEnemyDeath: function (e) {
    Audio2.enemyDie();
    this.kills++;
    var baseScore = Math.round(e.xp * 10 * (1 + this.wave * 0.06));
    if (e.isElite) baseScore = Math.round(baseScore * 1.8);
    this.score += baseScore * this.bloodMoonScoreMul;
    this.comboCount++;
    this.comboTimer = 2.5;
    if (this.comboCount > 0 && this.comboCount % 5 === 0) {
      this.score += 15;
      if (!this.performanceMode) this.particles.push(new RingParticle(e.x, e.y, 70, 0.4, '#ffc857', 3));
    }

    if (!this.performanceMode) {
      var n = Math.min(e.isElite ? 24 : 18, 8 + Math.floor(e.radius * 0.5));
      for (var i = 0; i < n; i++) {
        if (this.particles.length >= 140) break;
        var a = Math.random() * 6.2832;
        var s = 70 + Math.random() * 180;
        var col = e.isElite ? (i % 2 === 0 ? '#ffc857' : '#fff') : (i % 3 === 0 ? '#ffffff' : e.base.color);
        var pt = new Particle(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s,
          0.4 + Math.random() * 0.45, col, 2 + Math.random() * 3);
        pt.drag = 0.91;
        this.particles.push(pt);
      }
      this.particles.push(new RingParticle(e.x, e.y, e.radius * 3, 0.4, e.isElite ? '#ffc857' : e.base.color, e.isElite ? 4 : 3));
    }
    this.shake(Math.min(7, e.radius * 0.3));

    if (e.isBoss) return;

    var roll = Math.random();
    if (e.isElite) {
      this.pickups.push(new Pickup(e.x, e.y, 'hp', 25));
      this.pickups.push(new Pickup(e.x + 12, e.y, 'mana', 25));
      this.pickups.push(new Pickup(e.x - 12, e.y, 'xp', e.xp));
    } else {
      if (roll < 0.14) this.pickups.push(new Pickup(e.x, e.y, 'hp', 18));
      else if (roll < 0.34) this.pickups.push(new Pickup(e.x, e.y, 'mana', 22));
      else if (roll < 0.80) this.pickups.push(new Pickup(e.x, e.y, 'xp', e.xp));
    }
    if (e.type === 'brute' && !e.isElite) this.pickups.push(new Pickup(e.x + 14, e.y, 'xp', e.xp));
    if (this.bloodMoonActive && Math.random() < 0.5) {
      this.pickups.push(new Pickup(e.x + (Math.random() - 0.5) * 30, e.y + (Math.random() - 0.5) * 30, 'xp', Math.round(e.xp * 0.7)));
    }
  },

  spawnDamageText: function (x, y, val, crit, color) {
    var maxDT = this.performanceMode ? 20 : 40;
    if (this.damageTexts.length >= maxDT) return;
    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y,
      vx: (Math.random() - 0.5) * 80,
      vy: crit ? -120 : -95,
      gravity: 240,
      life: crit ? 1.0 : 0.75,
      maxLife: crit ? 1.0 : 0.75,
      text: String(Math.round(val)),
      color: color || '#fff',
      crit: !!crit,
      rot: (Math.random() - 0.5) * 0.3
    });
  },

  shake: function (a) {
    var maxShake = this.performanceMode ? 5 : 20;
    this.shakeAmt = Math.max(this.shakeAmt, Math.min(a, maxShake));
  },

  updateSpellButtons: function () {
    var p = this.player;
    if (!p) return;
    for (var i = 0; i < 4; i++) {
      var btn = this.spellBtns[i];
      if (!btn) continue;
      var spell = SPELLS[i];
      var total = spell.cooldown * p.cooldownMul * (p.spellCdMod ? p.spellCdMod[i] : 1);
      var frac = total > 0 ? Utils.clamp(p.cd[i] / total, 0, 1) : 0;
      var mask = btn.querySelector('.cd-mask');
      if (mask) mask.style.transform = 'scaleY(' + frac + ')';
      var cost = Math.round(spell.cost * (p.spellCostMod ? p.spellCostMod[i] : 1));
      var locked = p.mana < cost || (p.spellDisabled && p.spellDisabled[i]);
      if (locked) btn.classList.add('locked');
      else btn.classList.remove('locked');
      var costEl = btn.querySelector('.cost');
      if (costEl) costEl.textContent = cost;
    }
  },

  /* ==================== DRAW ==================== */
  draw: function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    // Обновляем здесь тоже — draw не всегда идёт после update
    this.performanceMode = this.lowQuality || this.bloodMoonActive;

    ctx.fillStyle = '#0a0714';
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'menu' || this.state === 'book' || this.state === 'class' || !this.player) {
      this.drawNebula(ctx, 0.4);
      this.drawStars(ctx, 0.4);
      this.drawMenuBg(ctx);
      this.drawVignette(ctx);
      return;
    }

    // Во время blood moon красный оверлей закрывает небулу, не рисуем
    if (!this.bloodMoonActive) {
      this.drawNebula(ctx, 0.35);
    }
    this.drawStars(ctx, 0.5);

    ctx.save();
    ctx.translate(-this.camX + this.shakeX, -this.camY + this.shakeY);

    this.drawBackground(ctx);

    var viewL = this.camX - 50;
    var viewR = this.camX + W + 50;
    var viewT = this.camY - 50;
    var viewB = this.camY + H + 50;

    // Pickups с culling
    for (var i = 0; i < this.pickups.length; i++) {
      var pk = this.pickups[i];
      if (pk.x < viewL - 20 || pk.x > viewR + 20 || pk.y < viewT - 20 || pk.y > viewB + 20) continue;
      pk.draw(ctx);
    }

    this.drawMeteors(ctx);

    for (var j = 0; j < this.projectiles.length; j++) {
      var pr = this.projectiles[j];
      if (pr.x < viewL - 60 || pr.x > viewR + 60 || pr.y < viewT - 60 || pr.y > viewB + 60) continue;
      if (pr.isFireball) {
        var a = Math.atan2(pr.vy, pr.vx);
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(a);
        var g = ctx.createLinearGradient(-30, 0, 8, 0);
        g.addColorStop(0, 'rgba(255,80,20,0)');
        g.addColorStop(0.4, 'rgba(255,140,50,0.5)');
        g.addColorStop(1, 'rgba(255,210,120,0.9)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-32, -4);
        ctx.quadraticCurveTo(-10, -10, 8, -8);
        ctx.lineTo(8, 8);
        ctx.quadraticCurveTo(-10, 10, -32, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      pr.draw(ctx);
    }

    for (var epi = 0; epi < this.enemyProjectiles.length; epi++) {
      var epr = this.enemyProjectiles[epi];
      if (epr.x < viewL - 40 || epr.x > viewR + 40 || epr.y < viewT - 40 || epr.y > viewB + 40) continue;
      epr.draw(ctx);
    }

    for (var k = 0; k < this.enemies.length; k++) {
      var en = this.enemies[k];
      if (en.x + en.radius < viewL || en.x - en.radius > viewR) continue;
      if (en.y + en.radius < viewT || en.y - en.radius > viewB) continue;
      en.draw(ctx);
    }

    this.player.draw(ctx);
    this.drawAutoAimReticle(ctx);

    for (var pidx = 0; pidx < this.particles.length; pidx++) {
      var pt = this.particles[pidx];
      if (pt.x < viewL - 20 || pt.x > viewR + 20 || pt.y < viewT - 20 || pt.y > viewB + 20) continue;
      pt.draw(ctx);
    }

    this.drawDamageTexts(ctx);
    ctx.restore();

    this.drawVignette(ctx);
    this.drawBloodMoonOverlay(ctx);

    if (this.screenFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(this.screenFlash * 4, 0, 0.5);
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    this.drawHUD(ctx);
    this.drawCombo(ctx);
  },

  drawMeteors: function (ctx) {
    for (var i = 0; i < this.meteors.length; i++) {
      var mt = this.meteors[i];
      if (mt.impacted) continue;
      var progress = 1 - mt.delay / mt.maxDelay;

      ctx.save();
      ctx.globalAlpha = 0.3 + progress * 0.6;
      ctx.strokeStyle = '#ff7a3c';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = -performance.now() * 0.03;
      ctx.beginPath();
      ctx.arc(mt.x, mt.y, mt.radius, 0, 6.2832);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.3 + progress * 0.5;
      ctx.fillStyle = 'rgba(255,100,40,0.25)';
      ctx.beginPath();
      ctx.arc(mt.x, mt.y, mt.radius * Math.max(0.2, progress), 0, 6.2832);
      ctx.fill();
      ctx.restore();

      if (!this.performanceMode) {
        var fallY = mt.y - (1 - progress) * 900;
        var tg = ctx.createRadialGradient(mt.x, fallY, 0, mt.x, fallY, 50);
        tg.addColorStop(0, '#fff');
        tg.addColorStop(0.3, '#ffd166');
        tg.addColorStop(0.7, '#ff7a3c');
        tg.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.arc(mt.x, fallY, 50, 0, 6.2832);
        ctx.fill();
        var tailGrad = ctx.createLinearGradient(mt.x, fallY - 180, mt.x, fallY);
        tailGrad.addColorStop(0, 'rgba(255,150,60,0)');
        tailGrad.addColorStop(1, 'rgba(255,180,80,0.85)');
        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mt.x, fallY - 180);
        ctx.lineTo(mt.x, fallY);
        ctx.stroke();
      }
    }
  },

  drawVignette: function (ctx) {
    if (this.vignetteCanvas) {
      ctx.drawImage(this.vignetteCanvas, 0, 0);
    }
  },

  drawBloodMoonOverlay: function (ctx) {
    if (!this.bloodMoonActive || !this._bloodMoonCanvas) return;
    ctx.drawImage(this._bloodMoonCanvas, 0, 0);
  },

  drawNebula: function (ctx, parallax) {
    ctx.save();
    var px = -this.camX * parallax;
    var py = -this.camY * parallax;
    for (var i = 0; i < this.nebulae.length; i++) {
      var n = this.nebulae[i];
      var sx = n.x + px, sy = n.y + py;
      if (sx < -n.r * 1.5 || sx > this.W + n.r * 1.5) continue;
      if (sy < -n.r * 1.5 || sy > this.H + n.r * 1.5) continue;
      ctx.globalAlpha = n.a;
      ctx.drawImage(n.canvas, sx - n.r, sy - n.r, n.r * 2, n.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  drawStars: function (ctx, parallax) {
    var t = performance.now() * 0.001;
    var animate = !this.performanceMode;
    ctx.save();
    var px = -this.camX * parallax * 0.15;
    var py = -this.camY * parallax * 0.15;
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      var sx = ((s.x + px) % this.W + this.W) % this.W;
      var sy = ((s.y + py) % this.H + this.H) % this.H;
      // В perf mode — фиксированная яркость, без sin
      var alpha = animate ? (0.6 + Math.abs(Math.sin(t * s.speed + s.phase)) * 0.4) * 0.75 : 0.75;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(sx, sy, s.s, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  drawMenuBg: function (ctx) {
    var t = performance.now() * 0.0004;
    ctx.save();
    for (var i = 0; i < this.bgRunes.length; i++) {
      var r = this.bgRunes[i];
      var x = r.x * 0.3 + Math.sin(t + r.rot) * 40 + this.W / 2;
      var y = r.y * 0.3 + Math.cos(t + r.rot) * 40 + this.H / 2;
      ctx.globalAlpha = r.a;
      ctx.fillStyle = '#b56bff';
      ctx.font = (20 * r.s) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var mx = ((x % this.W) + this.W) % this.W;
      var my = ((y % this.H) + this.H) % this.H;
      ctx.fillText(r.glyph, mx, my);
    }
    ctx.restore();
  },

  drawBackground: function (ctx) {
    var left = this.camX - 60, top = this.camY - 60;
    var right = this.camX + this.W + 60, bottom = this.camY + this.H + 60;
    var step = 90;
    ctx.strokeStyle = 'rgba(90,60,160,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var sx = Math.floor(left / step) * step;
    var sy = Math.floor(top / step) * step;
    for (var x = sx; x < right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (var y = sy; y < bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();

    if (!this.performanceMode) {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var t = performance.now() * 0.0006;
      for (var i = 0; i < this.bgRunes.length; i++) {
        var r = this.bgRunes[i];
        var rx = r.x * 2, ry = r.y * 2;
        if (rx < left || rx > right || ry < top || ry > bottom) continue;
        ctx.globalAlpha = r.a * (0.7 + Math.sin(t + r.rot) * 0.3);
        ctx.fillStyle = '#b56bff';
        ctx.font = (26 * r.s) + 'px sans-serif';
        ctx.fillText(r.glyph, rx, ry);
      }
      ctx.restore();
    }
  },

  drawAutoAimReticle: function (ctx) {
    if (this.lockTimer <= 0 || !this.lockTarget || this.lockTarget.dead) return;
    var t = this.lockTarget;
    var pulse = Utils.clamp(this.lockTimer / 0.55, 0, 1);
    var r = t.radius + 14 + (1 - pulse) * 10;
    var rot = performance.now() * 0.005;

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(255,150,60,' + (0.4 + pulse * 0.5) + ')';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * 6.2832;
      ctx.beginPath();
      ctx.arc(0, 0, r, a - 0.4, a + 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,180,90,' + (pulse * 0.9) + ')';
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 6.2832); ctx.fill();
    ctx.restore();

    if (this.player) {
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -performance.now() * 0.02;
      ctx.strokeStyle = 'rgba(255,150,60,' + (pulse * 0.45) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawDamageTexts: function (ctx) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < this.damageTexts.length; i++) {
      var t = this.damageTexts[i];
      var progress = 1 - t.life / t.maxLife;
      var pop = progress < 0.2 ? (progress / 0.2) : 1;
      var fade = Utils.clamp(t.life / (t.maxLife * 0.5), 0, 1);
      var scale = (t.crit ? 1.5 : 1) * (0.4 + pop * 0.6);
      ctx.globalAlpha = fade;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      ctx.scale(scale, scale);
      var size = t.crit ? 20 : 16;
      ctx.font = (t.crit ? '900 ' : 'bold ') + size + 'px -apple-system, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.crit ? '#ffc857' : t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  drawCombo: function (ctx) {
    if (this.comboCount < 3 || this.comboTimer <= 0) return;
    var pulse = Utils.clamp(this.comboTimer / 0.4, 0, 1);
    var t = performance.now() * 0.008;
    var wobble = Math.sin(t) * 0.05;
    ctx.save();
    ctx.translate(this.W / 2, 110);
    ctx.rotate(wobble);
    ctx.scale(1 + pulse * 0.2, 1 + pulse * 0.2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var text = 'x' + this.comboCount + ' COMBO';
    ctx.font = '900 26px -apple-system, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, 0, 0);
    // Упростим градиент при perfMode
    if (this.performanceMode) {
      ctx.fillStyle = '#ffc857';
    } else {
      var g = ctx.createLinearGradient(-80, 0, 80, 0);
      g.addColorStop(0, '#ffc857');
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, '#ffc857');
      ctx.fillStyle = g;
    }
    ctx.fillText(text, 0, 0);
    ctx.restore();
  },

  drawBossBar: function (ctx) {
    var boss = this.bossActive;
    if (!boss || boss.dead) return;
    var bw = Math.min(this.W * 0.7, 400);
    var bx = (this.W - bw) / 2;
    var by = 52;
    var bh = 22;
    ctx.fillStyle = 'rgba(10,7,20,0.85)';
    this.roundRect(ctx, bx, by, bw, bh, 11);
    ctx.fill();
    var frac = Utils.clamp(boss.hp / boss.maxHp, 0, 1);
    var grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, boss.bossColor);
    grad.addColorStop(0.5, boss.bossColor);
    grad.addColorStop(1, boss.bossColorDark);
    ctx.fillStyle = grad;
    if (frac > 0) {
      this.roundRect(ctx, bx, by, bw * frac, bh, 11);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,200,87,0.6)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, bx, by, bw, bh, 11);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(boss.bossName + ' · Фаза ' + boss.phase, this.W / 2, by + bh / 2 + 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    var marks = [0.5, 0.25];
    for (var i = 0; i < marks.length; i++) {
      var mx = bx + bw * marks[i];
      ctx.beginPath();
      ctx.moveTo(mx, by);
      ctx.lineTo(mx, by + bh);
      ctx.stroke();
    }
  },

  drawHUD: function (ctx) {
    var p = this.player;
    if (!p) return;
    var topPad = 14, leftPad = 14;
    var barW = Math.min(190, this.W * 0.48);
    var barH = 13;

    var hpX = leftPad, hpY = topPad;
    ctx.fillStyle = 'rgba(10,7,20,0.78)';
    this.roundRect(ctx, hpX, hpY, barW, barH, 7); ctx.fill();
    var hpFrac = Utils.clamp(p.hp / p.maxHp, 0, 1);
    var hpGrad = ctx.createLinearGradient(hpX, 0, hpX + barW, 0);
    if (hpFrac > 0.5) { hpGrad.addColorStop(0, '#4ce39a'); hpGrad.addColorStop(1, '#2bb87a'); }
    else if (hpFrac > 0.25) { hpGrad.addColorStop(0, '#ffc857'); hpGrad.addColorStop(1, '#e09b20'); }
    else { hpGrad.addColorStop(0, '#ff5b6e'); hpGrad.addColorStop(1, '#c0273a'); }
    ctx.fillStyle = hpGrad;
    if (hpFrac > 0.001) { this.roundRect(ctx, hpX, hpY, barW * hpFrac, barH, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    this.roundRect(ctx, hpX, hpY, barW, barH, 7); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('♥ ' + Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp), hpX + 8, hpY + barH / 2 + 0.5);

    var mpY = hpY + barH + 6;
    ctx.fillStyle = 'rgba(10,7,20,0.78)';
    this.roundRect(ctx, hpX, mpY, barW, barH - 2, 6); ctx.fill();
    var mpFrac = Utils.clamp(p.mana / p.maxMana, 0, 1);
    var mpGrad = ctx.createLinearGradient(hpX, 0, hpX + barW, 0);
    mpGrad.addColorStop(0, '#4d9dff');
    mpGrad.addColorStop(1, '#7d5bff');
    ctx.fillStyle = mpGrad;
    if (mpFrac > 0.001) { this.roundRect(ctx, hpX, mpY, barW * mpFrac, barH - 2, 6); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    this.roundRect(ctx, hpX, mpY, barW, barH - 2, 6); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px -apple-system, sans-serif';
    ctx.fillText('✦ ' + Math.ceil(p.mana) + ' / ' + Math.round(p.maxMana), hpX + 8, mpY + (barH - 2) / 2 + 0.5);

    var xpFrac = Utils.clamp(p.xp / p.xpNext, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, this.W, 3);
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(0, 0, this.W * xpFrac, 3);

    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(10,7,20,0.78)';
    this.roundRect(ctx, this.W - leftPad - 108, topPad, 108, 22, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,80,0.35)';
    this.roundRect(ctx, this.W - leftPad - 108, topPad, 108, 22, 11); ctx.stroke();
    ctx.fillStyle = '#ffc857';
    ctx.fillText('УР ' + p.level, this.W - leftPad - 60, topPad + 6);

    ctx.fillStyle = 'rgba(181,107,255,0.20)';
    this.roundRect(ctx, this.W - leftPad - 108, topPad + 28, 108, 22, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(181,107,255,0.5)';
    this.roundRect(ctx, this.W - leftPad - 108, topPad + 28, 108, 22, 11); ctx.stroke();
    ctx.fillStyle = '#b56bff';
    ctx.fillText('ВОЛНА ' + this.wave, this.W - leftPad - 10, topPad + 34);

    this.drawBossBar(ctx);

    if (this.mageClass) {
      var cls = null;
      for (var ci = 0; ci < MAGE_CLASSES.length; ci++) {
        if (MAGE_CLASSES[ci].id === this.mageClass) { cls = MAGE_CLASSES[ci]; break; }
      }
      if (cls) {
        ctx.fillStyle = 'rgba(10,7,20,0.78)';
        this.roundRect(ctx, this.W - leftPad - 108, topPad + 56, 108, 22, 11); ctx.fill();
        ctx.strokeStyle = cls.color + 'aa';
        this.roundRect(ctx, this.W - leftPad - 108, topPad + 56, 108, 22, 11); ctx.stroke();
        ctx.fillStyle = cls.color;
        ctx.textAlign = 'center';
        ctx.fillText(cls.icon + ' ' + cls.name, this.W - leftPad - 54, topPad + 62);
      }
    }

    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('✦ ' + Utils.formatNum(this.score), leftPad, this.H - 12);

    if (this.bloodMoonActive) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 13px -apple-system, sans-serif';
      ctx.fillStyle = '#ff6666';
      ctx.fillText('🌑 КРОВАВАЯ ЛУНА · очки x4', this.W / 2, this.H - 30);
    } else if (this.waveActive && !this.bossActive) {
      var remaining = this.enemies.length + this.spawnQueue.length;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('врагов: ' + remaining, this.W / 2, this.H - 12);
    }

    // Вспышка урона — из кешированного canvas
    if (p.hurtFlash > 0 && this._hurtFlashCanvas) {
      var a = Utils.clamp(p.hurtFlash / 0.25, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.drawImage(this._hurtFlashCanvas, 0, 0);
      ctx.restore();
    }
  },

  roundRect: function (ctx, x, y, w, h, r) {
    if (w <= 0 || h <= 0) return;
    var rr = Math.min(r, h / 2, w / 2);
    if (rr < 0) rr = 0;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  },

  loop: function (now) {
    var self = this;
    requestAnimationFrame(function (t) { self.loop(t); });

    var dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.25) dt = 0.25;
    if (dt < 0) dt = 0;

    if (this.state === 'playing') {
      this.frameTimes.push(dt * 1000);
      if (this.frameTimes.length > 30) this.frameTimes.shift();
      if (this.frameTimes.length === 30) {
        var sum = 0;
        for (var i = 0; i < this.frameTimes.length; i++) sum += this.frameTimes[i];
        var avg = sum / this.frameTimes.length;

        // Кровавая луна — форсим lowQuality (но не трогаем состояние, только флаг)
        if (this.bloodMoonActive && !this.lowQuality) {
          this.lowQuality = true;
        } else if (!this.bloodMoonActive) {
          if (!this.lowQuality && avg > 26) {
            this.lowQuality = true;
            this._qualityCooldown = 90;
          } else if (this.lowQuality && avg < 16 && this._qualityCooldown <= 0) {
            this.lowQuality = false;
            this._qualityCooldown = 90;
          }
        }
      }
      if (this._qualityCooldown > 0) this._qualityCooldown--;
    }

    this.accumulator += dt;
    var STEP = 1 / 60;
    var steps = 0;
    while (this.accumulator >= STEP && steps < 5) {
      this.update(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;

    this.draw();
  }
};
