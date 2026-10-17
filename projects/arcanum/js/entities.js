/* ============================================================
   ENTITIES v7 — кеш спрайтов, additive blend
   ============================================================ */

function Particle(x, y, vx, vy, life, color, size) {
  this.x = x; this.y = y; this.vx = vx; this.vy = vy;
  this.life = life; this.maxLife = life;
  this.color = color; this.size = size || 3; this.dead = false;
  this.drag = 0.94;
  this.additive = false;
}
Particle.prototype.update = function (dt) {
  this.x += this.vx * dt; this.y += this.vy * dt;
  var d = Math.pow(this.drag, dt * 60);
  this.vx *= d; this.vy *= d;
  this.life -= dt;
  if (this.life <= 0) this.dead = true;
};
Particle.prototype.draw = function (c) {
  var a = this.life / this.maxLife;
  if (a > 1) a = 1;
  c.globalAlpha = a;
  if (this.additive) c.globalCompositeOperation = 'lighter';
  c.fillStyle = this.color;
  var s = this.size * (0.4 + a * 0.6);
  c.beginPath(); c.arc(this.x, this.y, s, 0, 6.2832); c.fill();
  if (this.additive) c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
};

function RingParticle(x, y, maxR, life, color, width) {
  this.x = x; this.y = y; this.r = 4; this.maxR = maxR;
  this.life = life; this.maxLife = life;
  this.color = color; this.width = width || 3; this.dead = false;
  this.additive = false;
}
RingParticle.prototype.update = function (dt) {
  this.life -= dt;
  var t = 1 - this.life / this.maxLife;
  this.r = this.maxR * (1 - Math.pow(1 - t, 3));
  if (this.life <= 0) this.dead = true;
};
RingParticle.prototype.draw = function (c) {
  var a = this.life / this.maxLife;
  if (a > 1) a = 1;
  c.globalAlpha = a * 0.85;
  if (this.additive) c.globalCompositeOperation = 'lighter';
  c.strokeStyle = this.color;
  c.lineWidth = this.width * a + 0.5;
  c.beginPath(); c.arc(this.x, this.y, this.r, 0, 6.2832); c.stroke();
  if (this.additive) c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
};

function Projectile(x, y, angle, speed, damage, opts) {
  opts = opts || {};
  this.x = x; this.y = y;
  this.vx = Math.cos(angle) * speed;
  this.vy = Math.sin(angle) * speed;
  this.speed = speed;
  this.damage = damage;
  this.life = opts.life || 1.5;
  this.radius = opts.radius || 5;
  this.color = opts.color || '#8ad4ff';
  this.pierce = opts.pierce || 0;
  this.hitSet = [];
  this.knockback = opts.knockback || 0;
  this.burn = opts.burn || 0;
  this.slowFactor = opts.slowFactor || 0;
  this.slowDuration = opts.slowDuration || 0;
  this.dead = false;
  this._trailTimer = 0;
  this.isFireball = false;
  this.target = null;
  this.homing = 0;
  this.pulse = 0;
  this.isFrost = false;
}
Projectile.prototype.update = function (dt) {
  if (this.homing > 0 && this.target && !this.target.dead) {
    var desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    var current = Math.atan2(this.vy, this.vx);
    var diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
    var maxTurn = this.homing * dt;
    var turn = diff < -maxTurn ? -maxTurn : (diff > maxTurn ? maxTurn : diff);
    var newAngle = current + turn;
    this.vx = Math.cos(newAngle) * this.speed;
    this.vy = Math.sin(newAngle) * this.speed;
  }
  this.x += this.vx * dt; this.y += this.vy * dt;
  this.life -= dt;
  this.pulse += dt * 12;
  if (this.life <= 0) this.dead = true;
};
Projectile.prototype.hasHit = function (e) {
  for (var i = 0; i < this.hitSet.length; i++) if (this.hitSet[i] === e) return true;
  return false;
};
Projectile.prototype.draw = function (c) {
  if (this.isFireball) {
    var s = 1 + Math.sin(this.pulse) * 0.12;
    c.save();
    c.translate(this.x, this.y);

    // Внешнее свечение из кеша — БЕЗ создания градиента
    c.globalCompositeOperation = 'lighter';
    Sprites.drawGlow(c, 0, 0, this.radius * 3.2 * s, '#ff7a3c', 0.85);
    c.globalCompositeOperation = 'source-over';

    // Ядро
    c.fillStyle = '#fff7e0';
    c.beginPath(); c.arc(0, 0, this.radius * 0.6 * s, 0, 6.2832); c.fill();
    c.fillStyle = '#ffd166';
    c.beginPath(); c.arc(0, 0, this.radius * 0.95, 0, 6.2832); c.fill();

    // Вращающиеся искры
    c.rotate(this.pulse * 0.5);
    c.fillStyle = '#fff';
    for (var i = 0; i < 3; i++) {
      c.rotate(2.094);
      c.beginPath(); c.arc(this.radius * 1.5, 0, 1.6, 0, 6.2832); c.fill();
    }
    c.restore();
    return;
  }
  if (this.isFrost) {
    var sf = 1 + Math.sin(this.pulse) * 0.1;
    c.save();
    c.translate(this.x, this.y);
    c.globalCompositeOperation = 'lighter';
    Sprites.drawGlow(c, 0, 0, this.radius * 2.8 * sf, '#a0e0ff', 0.85);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#e0f4ff';
    c.beginPath(); c.arc(0, 0, this.radius * 0.7, 0, 6.2832); c.fill();
    c.rotate(this.pulse * 0.8);
    c.strokeStyle = '#a0e0ff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-this.radius * 1.4, 0); c.lineTo(this.radius * 1.4, 0);
    c.moveTo(0, -this.radius * 1.4); c.lineTo(0, this.radius * 1.4);
    c.stroke();
    c.restore();
    return;
  }

  // Обычная "искра"
  c.save();
  c.translate(this.x, this.y);
  c.globalCompositeOperation = 'lighter';
  Sprites.drawGlow(c, 0, 0, this.radius * 2, this.color, 0.7);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = this.color;
  c.beginPath(); c.arc(0, 0, this.radius, 0, 6.2832); c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(0, 0, this.radius * 0.42, 0, 6.2832); c.fill();
  c.restore();
};

function EnemyProjectile(x, y, vx, vy, damage, opts) {
  opts = opts || {};
  this.x = x; this.y = y;
  this.vx = vx; this.vy = vy;
  this.damage = damage;
  this.life = opts.life || 3;
  this.radius = opts.radius || 7;
  this.color = opts.color || '#ff3355';
  this.dead = false;
  this.pulse = 0;
}
EnemyProjectile.prototype.update = function (dt) {
  this.x += this.vx * dt; this.y += this.vy * dt;
  this.life -= dt; this.pulse += dt * 10;
  if (this.life <= 0) this.dead = true;
};
EnemyProjectile.prototype.draw = function (c) {
  var s = 1 + Math.sin(this.pulse) * 0.15;
  c.save();
  c.translate(this.x, this.y);
  c.globalCompositeOperation = 'lighter';
  Sprites.drawGlow(c, 0, 0, this.radius * 2.4 * s, this.color, 0.9);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = this.color;
  c.beginPath(); c.arc(0, 0, this.radius, 0, 6.2832); c.fill();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(0, 0, this.radius * 0.35, 0, 6.2832); c.fill();
  c.restore();
};

function Pickup(x, y, type, value) {
  this.x = x; this.y = y; this.type = type; this.value = value || 1;
  this.r = 7; this.dead = false;
  this.t = Math.random() * 6.28; this.life = 14;
}
Pickup.prototype.update = function (dt, p) {
  this.t += dt * 3; this.life -= dt;
  if (this.life <= 0) this.dead = true;
  var d = Math.sqrt((this.x - p.x) * (this.x - p.x) + (this.y - p.y) * (this.y - p.y));
  if (d < 110) {
    var a = Math.atan2(p.y - this.y, p.x - this.x);
    var pull = 420 * dt * (1 - d / 110);
    this.x += Math.cos(a) * pull;
    this.y += Math.sin(a) * pull;
  }
  if (d < p.radius + this.r) { this.dead = true; return true; }
  return false;
};
Pickup.prototype.draw = function (c) {
  var bob = Math.sin(this.t) * 2;
  var col, sym;
  if (this.type === 'hp') { col = '#4ce39a'; sym = '♥'; }
  else if (this.type === 'mana') { col = '#4d9dff'; sym = '✦'; }
  else { col = '#ffc857'; sym = '◆'; }
  c.save();
  c.globalAlpha = this.life < 2 ? (0.3 + 0.7 * Math.abs(Math.sin(this.life * 10))) : 1;
  // Свечение из кеша
  c.globalCompositeOperation = 'lighter';
  Sprites.drawGlow(c, this.x, this.y + bob, this.r * 2.4, col, 0.4);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = col;
  c.beginPath(); c.arc(this.x, this.y + bob, this.r, 0, 6.2832); c.fill();
  c.fillStyle = '#0a0714';
  c.font = 'bold 10px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(sym, this.x, this.y + bob + 0.5);
  c.restore();
};

function Enemy(x, y, typeKey, wave, isElite) {
  var base = ENEMY_TYPES[typeKey];
  this.type = typeKey; this.base = base;
  var hpScale = 1 + (wave - 1) * 0.20;
  var spScale = 1 + (wave - 1) * 0.035;
  this.maxHp = Math.round(base.hp * hpScale);
  this.speed = base.speed * Math.min(spScale, 1.75);
  this.damage = base.damage * (1 + (wave - 1) * 0.10);
  this.radius = base.radius;
  this.xp = base.xp;
  this.isElite = !!isElite;
  if (this.isElite) {
    this.maxHp = Math.round(this.maxHp * 2.6);
    this.damage *= 1.6;
    this.xp = Math.round(this.xp * 4);
    this.radius *= 1.18;
  }
  this.hp = this.maxHp;
  this.x = x; this.y = y;
  this.dead = false;
  this.isBoss = false;
  this.slowTimer = 0; this.slowFactor = 1;
  this.burnTimer = 0; this.burnDps = 0;
  this.poisonTimer = 0; this.poisonDps = 0;
  this.hitFlash = 0;
  this.knockVx = 0; this.knockVy = 0;
  this.wobble = Math.random() * 6.28; this.t = 0;
  this._touchCd = 0;
  this._emitTimer = 0;
}
Enemy.prototype.applySlow = function (f, d) {
  if (f < this.slowFactor || this.slowTimer <= 0) this.slowFactor = f;
  this.slowTimer = Math.max(this.slowTimer, d);
};
Enemy.prototype.applyBurn = function (dps, d) {
  this.burnDps = Math.max(this.burnDps, dps);
  this.burnTimer = Math.max(this.burnTimer, d);
};
Enemy.prototype.applyPoison = function (dps, d) {
  this.poisonDps = Math.max(this.poisonDps, dps);
  this.poisonTimer = Math.max(this.poisonTimer, d);
};
Enemy.prototype.knockback = function (angle, force) {
  if (this.isBoss) force *= 0.3;
  else if (this.isElite) force *= 0.6;
  this.knockVx += Math.cos(angle) * force;
  this.knockVy += Math.sin(angle) * force;
};
Enemy.prototype.hurt = function (dmg) {
  this.hp -= dmg;
  this.hitFlash = 0.12;
  if (this.hp <= 0) this.dead = true;
};
Enemy.prototype.update = function (dt, p, enemies) {
  this.t += dt; this.wobble += dt * 6;
  if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1; }
  if (this.burnTimer > 0) {
    this.burnTimer -= dt;
    this.hp -= this.burnDps * dt;
    if (this.burnTimer <= 0) this.burnDps = 0;
    if (this.hp <= 0) { this.dead = true; return; }
  }
  if (this.poisonTimer > 0) {
    this.poisonTimer -= dt;
    this.hp -= this.poisonDps * dt;
    if (this.poisonTimer <= 0) this.poisonDps = 0;
    if (this.hp <= 0) { this.dead = true; return; }
  }
  if (this.hitFlash > 0) this.hitFlash -= dt;

  var ang = Math.atan2(p.y - this.y, p.x - this.x);
  var spd = this.speed * this.slowFactor;
  var mvx = Math.cos(ang) * spd;
  var mvy = Math.sin(ang) * spd;

  var perfMode = (typeof Game !== 'undefined' && Game.performanceMode);
  if (!perfMode) {
    var sx = 0, sy = 0;
    for (var i = 0; i < enemies.length; i++) {
      var o = enemies[i];
      if (o === this || o.dead || o.isBoss) continue;
      var dx = this.x - o.x, dy = this.y - o.y;
      var d2 = dx * dx + dy * dy;
      var minD = this.radius + o.radius;
      if (d2 < minD * minD && d2 > 0.01) {
        var d = Math.sqrt(d2);
        var push = (minD - d) / minD;
        sx += (dx / d) * push * 90;
        sy += (dy / d) * push * 90;
      }
    }
    this.x += sx * dt;
    this.y += sy * dt;
  }

  this.knockVx *= Math.pow(0.86, dt * 60);
  this.knockVy *= Math.pow(0.86, dt * 60);

  this.x += (mvx + this.knockVx) * dt;
  this.y += (mvy + this.knockVy) * dt;

  if ((this.slowTimer > 0 || this.burnTimer > 0 || this.poisonTimer > 0) && !perfMode) {
    this._emitTimer -= dt;
    if (this._emitTimer <= 0) {
      this._emitTimer = 0.18;
      var parr = Game.particles;
      if (parr.length < 140) {
        if (this.slowTimer > 0) {
          parr.push(new Particle(
            this.x + (Math.random() - 0.5) * this.radius * 1.6,
            this.y + (Math.random() - 0.5) * this.radius * 1.6,
            (Math.random() - 0.5) * 20, -10 - Math.random() * 20,
            0.5, '#7fdcff', 2));
        }
        if (this.burnTimer > 0) {
          parr.push(new Particle(
            this.x + (Math.random() - 0.5) * this.radius * 1.4,
            this.y + (Math.random() - 0.5) * this.radius * 1.4,
            (Math.random() - 0.5) * 30, -20 - Math.random() * 20,
            0.45, Math.random() < 0.5 ? '#ffb066' : '#ff7a3c', 2.5));
        }
        if (this.poisonTimer > 0) {
          parr.push(new Particle(
            this.x + (Math.random() - 0.5) * this.radius * 1.4,
            this.y + (Math.random() - 0.5) * this.radius * 1.4,
            (Math.random() - 0.5) * 25, -15 - Math.random() * 15,
            0.5, Math.random() < 0.5 ? '#8aff4d' : '#4dcc30', 2.5));
        }
      }
    }
  }
};
Enemy.prototype.draw = function (c) {
  var r = this.radius, b = this.base;
  var perfMode = (typeof Game !== 'undefined' && Game.performanceMode);

  if (this.isElite && !perfMode) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    var pulse = 0.85 + Math.sin(this.t * 4) * 0.15;
    Sprites.drawGlow(c, this.x, this.y, r * 2.1 * pulse, '#ffc857', 0.35);
    c.globalCompositeOperation = 'source-over';
    c.restore();
  }

  c.save();
  c.translate(this.x, this.y);

  if (this.slowTimer > 0) {
    c.globalAlpha = 0.5;
    c.strokeStyle = '#7fdcff'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, r + 4, 0, 6.2832); c.stroke();
    c.globalAlpha = 1;
  }

  if ((this.burnTimer > 0 || this.poisonTimer > 0) && !perfMode) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    var auraCol = this.poisonTimer > 0 ? '#4dcc30' : '#ff7a3c';
    Sprites.drawGlow(c, 0, 0, r * 2, auraCol, 0.4);
    c.globalCompositeOperation = 'source-over';
    c.restore();
  }

  var flash = this.hitFlash > 0;
  c.fillStyle = flash ? '#ffffff' : b.colorDark;
  c.beginPath();

  if (b.glyph === 'wraith') {
    c.moveTo(0, -r);
    c.quadraticCurveTo(r, -r * 0.2, r * 0.7, r * 0.7);
    c.quadraticCurveTo(0, r * 1.25, -r * 0.7, r * 0.7);
    c.quadraticCurveTo(-r, -r * 0.2, 0, -r);
  } else if (b.glyph === 'brute') {
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * 6.2832 - Math.PI / 2;
      var px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  } else if (b.glyph === 'shade') {
    c.moveTo(0, -r * 1.1);
    c.lineTo(r * 0.85, 0);
    c.lineTo(0, r * 1.1);
    c.lineTo(-r * 0.85, 0);
    c.closePath();
  } else {
    c.arc(0, 0, r, 0, 6.2832);
  }
  c.fill();

  c.fillStyle = flash ? '#ffffff' : (this.isElite ? '#ffc857' : b.color);
  c.globalAlpha = 0.85;
  c.beginPath(); c.arc(0, 0, r * 0.45, 0, 6.2832); c.fill();
  c.globalAlpha = 1;

  c.fillStyle = '#0a0714';
  var wob = Math.sin(this.wobble) * 1.4;
  var er = Math.max(1.4, r * 0.13);
  c.beginPath();
  c.arc(-r * 0.28, -r * 0.12 + wob, er, 0, 6.2832);
  c.arc(r * 0.28, -r * 0.12 + wob, er, 0, 6.2832);
  c.fill();

  if (b.glyph === 'imp') {
    c.strokeStyle = flash ? '#fff' : (this.isElite ? '#ffc857' : b.color);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-r * 0.55, -r * 0.75); c.lineTo(-r * 0.85, -r * 1.35);
    c.moveTo(r * 0.55, -r * 0.75); c.lineTo(r * 0.85, -r * 1.35);
    c.stroke();
  }

  if (this.isElite) {
    c.strokeStyle = 'rgba(255,200,87,0.75)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, r + 3, 0, 6.2832); c.stroke();
  }

  c.restore();

  if (this.hp < this.maxHp && !this.isBoss) {
    var w = r * 2.1;
    var hx = this.x - w / 2, hy = this.y - r - 10;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(hx, hy, w, 3.5);
    var f = this.hp / this.maxHp;
    if (f > 1) f = 1;
    c.fillStyle = f > 0.5 ? '#4ce39a' : (f > 0.22 ? '#ffc857' : '#ff5b6e');
    c.fillRect(hx, hy, w * f, 3.5);
    if (this.isElite) {
      c.fillStyle = '#ffc857';
      c.beginPath(); c.arc(hx + w + 5, hy + 1.75, 2.2, 0, 6.2832); c.fill();
    }
  }
};

/* ================= БОССЫ ================= */
function Boss(x, y, wave, bossType) {
  Enemy.call(this, x, y, 'brute', wave);
  this.isBoss = true;
  this.bossType = bossType.id;
  this.bossName = bossType.name;
  this.bossColor = bossType.color;
  this.bossColorDark = bossType.colorDark;
  this.bossShape = bossType.shape;
  this.bossLevel = Math.floor(wave / 5);

  this.maxHp = Math.round(420 + this.bossLevel * 320);
  this.speed = 34;
  this.radius = 38;
  this.damage = 24 + this.bossLevel * 6;
  this.xp = 40 + this.bossLevel * 15;

  if (this.bossType === 'titan') {
    this.maxHp = Math.round(this.maxHp * 1.7);
    this.speed = 22;
    this.radius = 52;
    this.damage = 38 + this.bossLevel * 10;
    this.xp = Math.round(this.xp * 1.4);
  } else if (this.bossType === 'summoner') {
    this.maxHp = Math.round(this.maxHp * 0.85);
    this.speed = 24;
    this.radius = 34;
    this.xp = Math.round(this.xp * 1.1);
  } else if (this.bossType === 'mage') {
    this.maxHp = Math.round(this.maxHp * 0.78);
    this.speed = 42;
    this.radius = 32;
  }

  this.hp = this.maxHp;
  this.phase = 1;
  this.attackTimer = 2.5;
  this.chargeTimer = 6;
  this.chargeTime = 0;
  this.spawnTimer = 5;
  this.teleportTimer = 3;
  this.chargeDir = { x: 0, y: 0 };
  this._rgbaCache = {};
}
Boss.prototype = Object.create(Enemy.prototype);
Boss.prototype.constructor = Boss;

Boss.prototype.hexToRgba = function (hex, a) {
  var key = hex + '_' + a;
  if (this._rgbaCache[key]) return this._rgbaCache[key];
  var n = parseInt(hex.replace('#', ''), 16);
  var res = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  this._rgbaCache[key] = res;
  return res;
};

Boss.prototype.update = function (dt, p, enemies) {
  this.t += dt;
  this.wobble += dt * 3;
  var hpFrac = this.hp / this.maxHp;
  if (hpFrac < 0.25 && this.phase < 3) this.phase = 3;
  else if (hpFrac < 0.5 && this.phase < 2) this.phase = 2;
  if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1; }
  if (this.burnTimer > 0) {
    this.burnTimer -= dt;
    this.hp -= this.burnDps * dt;
    if (this.burnTimer <= 0) this.burnDps = 0;
    if (this.hp <= 0) { this.dead = true; return; }
  }
  if (this.poisonTimer > 0) {
    this.poisonTimer -= dt;
    this.hp -= this.poisonDps * dt;
    if (this.poisonTimer <= 0) this.poisonDps = 0;
    if (this.hp <= 0) { this.dead = true; return; }
  }
  if (this.hitFlash > 0) this.hitFlash -= dt;

  if (this.bossType === 'devourer') this.updateDevourer(dt, p);
  else if (this.bossType === 'summoner') this.updateSummoner(dt, p);
  else if (this.bossType === 'mage') this.updateMage(dt, p);
  else if (this.bossType === 'titan') this.updateTitan(dt, p);

  this.knockVx *= Math.pow(0.86, dt * 60);
  this.knockVy *= Math.pow(0.86, dt * 60);
  this.x += this.knockVx * dt;
  this.y += this.knockVy * dt;
};

Boss.prototype.updateDevourer = function (dt, p) {
  if (this.chargeTime > 0) {
    this.chargeTime -= dt;
    this.x += this.chargeDir.x * 650 * dt;
    this.y += this.chargeDir.y * 650 * dt;
  } else {
    var ang = Math.atan2(p.y - this.y, p.x - this.x);
    var spd = this.speed * this.slowFactor * (this.phase >= 3 ? 1.6 : 1);
    this.x += Math.cos(ang) * spd * dt;
    this.y += Math.sin(ang) * spd * dt;
  }
  this.attackTimer -= dt;
  if (this.attackTimer <= 0) {
    var interval = this.phase >= 3 ? 1.1 : (this.phase >= 2 ? 1.7 : 2.4);
    this.attackTimer = interval;
    var baseAngle = Math.atan2(p.y - this.y, p.x - this.x);
    var count = this.phase >= 3 ? 5 : (this.phase >= 2 ? 4 : 3);
    var speed = 240 + this.bossLevel * 20;
    for (var i = 0; i < count; i++) {
      var offset = (i - (count - 1) / 2) * 0.22;
      var a = baseAngle + offset;
      Game.enemyProjectiles.push(new EnemyProjectile(
        this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed,
        12 + this.bossLevel * 4, { radius: 8, color: this.bossColor, life: 3 }));
    }
  }
  this.chargeTimer -= dt;
  if (this.chargeTimer <= 0 && this.chargeTime <= 0) {
    this.chargeTimer = this.phase >= 3 ? 4.5 : 6.5;
    var ca = Math.atan2(p.y - this.y, p.x - this.x);
    this.chargeDir = { x: Math.cos(ca), y: Math.sin(ca) };
    this.chargeTime = 0.65;
    if (!Game.performanceMode) {
      for (var k = 0; k < 10; k++) {
        var sa = Math.random() * 6.2832;
        var ss = 60 + Math.random() * 80;
        Game.particles.push(new Particle(this.x, this.y,
          Math.cos(sa) * ss, Math.sin(sa) * ss, 0.4, this.bossColor, 3));
      }
    }
  }
};

Boss.prototype.updateSummoner = function (dt, p) {
  var dx = p.x - this.x, dy = p.y - this.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  var targetDist = 280;
  if (d > 0.01) {
    var towards = 0;
    if (d < targetDist - 40) towards = -1;
    else if (d > targetDist + 40) towards = 1;
    var spd = this.speed * this.slowFactor * (this.phase >= 3 ? 1.4 : 1);
    this.x += (dx / d) * towards * spd * dt;
    this.y += (dy / d) * towards * spd * dt;
  }
  this.attackTimer -= dt;
  if (this.attackTimer <= 0) {
    this.attackTimer = this.phase >= 3 ? 1.4 : 2.2;
    var baseAngle = Math.atan2(p.y - this.y, p.x - this.x);
    var speed = 200 + this.bossLevel * 15;
    Game.enemyProjectiles.push(new EnemyProjectile(
      this.x, this.y, Math.cos(baseAngle) * speed, Math.sin(baseAngle) * speed,
      16 + this.bossLevel * 5, { radius: 11, color: this.bossColor, life: 3.5 }));
  }
  this.spawnTimer -= dt;
  if (this.spawnTimer <= 0) {
    this.spawnTimer = this.phase >= 3 ? 4.5 : (this.phase >= 2 ? 6 : 8);
    var minionCount = this.phase >= 3 ? 4 : (this.phase >= 2 ? 3 : 2);
    var minionTypes = ['imp', 'wraith', 'shade'];
    for (var i = 0; i < minionCount; i++) {
      if (Game.enemies.length >= Game.getMaxEnemiesForCurrentWave() + 8) break;
      var a = Math.random() * 6.2832;
      var sx = this.x + Math.cos(a) * 60;
      var sy = this.y + Math.sin(a) * 60;
      var mt = minionTypes[Math.floor(Math.random() * minionTypes.length)];
      Game.enemies.push(new Enemy(sx, sy, mt, this.bossLevel * 5));
      if (!Game.performanceMode) Game.particles.push(new RingParticle(sx, sy, 40, 0.4, this.bossColor, 2));
    }
  }
};

Boss.prototype.updateMage = function (dt, p) {
  this.teleportTimer -= dt;
  if (this.teleportTimer <= 0) {
    this.teleportTimer = this.phase >= 3 ? 2.0 : (this.phase >= 2 ? 2.6 : 3.2);
    if (!Game.performanceMode) {
      Game.particles.push(new RingParticle(this.x, this.y, 60, 0.5, this.bossColor, 3));
    }
    var a = Math.random() * 6.2832;
    var r = 220 + Math.random() * 120;
    this.x = p.x + Math.cos(a) * r;
    this.y = p.y + Math.sin(a) * r;
    if (!Game.performanceMode) {
      Game.particles.push(new RingParticle(this.x, this.y, 80, 0.6, this.bossColor, 4));
    }
  } else {
    var ang = Math.atan2(p.y - this.y, p.x - this.x);
    var spd = this.speed * this.slowFactor * 0.5;
    this.x += Math.cos(ang) * spd * dt;
    this.y += Math.sin(ang) * spd * dt;
  }
  this.attackTimer -= dt;
  if (this.attackTimer <= 0) {
    this.attackTimer = this.phase >= 3 ? 1.3 : (this.phase >= 2 ? 1.8 : 2.4);
    var baseAngle = Math.atan2(p.y - this.y, p.x - this.x);
    var ballCount = this.phase >= 3 ? 4 : 3;
    var speed = 150 + this.bossLevel * 10;
    for (var i = 0; i < ballCount; i++) {
      var offset = (i - (ballCount - 1) / 2) * 0.35;
      var ba = baseAngle + offset;
      Game.enemyProjectiles.push(new EnemyProjectile(
        this.x, this.y, Math.cos(ba) * speed, Math.sin(ba) * speed,
        20 + this.bossLevel * 6, { radius: 14, color: this.bossColor, life: 4 }));
    }
  }
};

Boss.prototype.updateTitan = function (dt, p) {
  var ang = Math.atan2(p.y - this.y, p.x - this.x);
  var spd = this.speed * this.slowFactor;
  this.x += Math.cos(ang) * spd * dt;
  this.y += Math.sin(ang) * spd * dt;
  this.attackTimer -= dt;
  var d = Math.sqrt((p.x - this.x) * (p.x - this.x) + (p.y - this.y) * (p.y - this.y));
  if (d < this.radius + 70 && this.attackTimer <= 0) {
    this.attackTimer = this.phase >= 3 ? 1.8 : (this.phase >= 2 ? 2.2 : 2.8);
    var radius = this.radius + 90;
    var dmg = this.damage * 1.3;
    if (d < radius) {
      var dealt = p.hurt(dmg);
      if (dealt > 0) {
        Audio2.playerHurt(); Utils.vibrate(80);
        Game.shake(12);
        Game.spawnDamageText(p.x, p.y - p.radius - 6, dealt, false, '#ff9a3c');
        Game.onPlayerDamaged();
        if (p.dead) { Game.gameOver(); return; }
      }
    }
    if (!Game.performanceMode) {
      Game.particles.push(new RingParticle(this.x, this.y, radius, 0.5, this.bossColor, 5));
      Game.particles.push(new RingParticle(this.x, this.y, radius * 0.7, 0.35, '#ffffff', 3));
    }
  }
  if (this.phase >= 2 && this.attackTimer <= 0 && d >= this.radius + 70 && d < 300) {
    this.attackTimer = this.phase >= 3 ? 2.0 : 2.6;
    Game.enemyProjectiles.push(new EnemyProjectile(
      this.x, this.y, Math.cos(ang) * 180, Math.sin(ang) * 180,
      15 + this.bossLevel * 4, { radius: 10, color: this.bossColor, life: 3 }));
  }
};

Boss.prototype.draw = function (c) {
  var r = this.radius;
  var color = this.bossColor;
  var colorDark = this.bossColorDark;
  var perfMode = (typeof Game !== 'undefined' && Game.performanceMode);

  c.save();
  c.translate(this.x, this.y);

  if (!perfMode) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    var pulse = 1 + Math.sin(this.t * 3) * 0.1;
    Sprites.drawGlow(c, 0, 0, r * 2.4 * pulse, color, 0.35);
    c.globalCompositeOperation = 'source-over';
    c.restore();
  } else {
    c.globalAlpha = 0.15;
    c.fillStyle = color;
    c.beginPath(); c.arc(0, 0, r * 1.8, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
  }

  if (this.slowTimer > 0) {
    c.globalAlpha = 0.5;
    c.strokeStyle = '#7fdcff'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, r + 8, 0, 6.2832); c.stroke();
    c.globalAlpha = 1;
  }

  var flash = this.hitFlash > 0;
  var bodyColor = flash ? '#ffffff' : colorDark;
  c.fillStyle = bodyColor;
  c.beginPath();

  if (this.bossShape === 'octagon') {
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * 6.2832 - Math.PI / 2;
      var px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  } else if (this.bossShape === 'spikes') {
    for (var si = 0; si < 24; si++) {
      var sa = (si / 24) * 6.2832 - Math.PI / 2;
      var sr = (si % 2 === 0) ? r : r * 0.75;
      var spx = Math.cos(sa) * sr, spy = Math.sin(sa) * sr;
      if (si === 0) c.moveTo(spx, spy); else c.lineTo(spx, spy);
    }
    c.closePath();
  } else if (this.bossShape === 'star') {
    for (var sti = 0; sti < 16; sti++) {
      var sta = (sti / 16) * 6.2832 - Math.PI / 2;
      var str = (sti % 2 === 0) ? r : r * 0.5;
      var stx = Math.cos(sta) * str, sty = Math.sin(sta) * str;
      if (sti === 0) c.moveTo(stx, sty); else c.lineTo(stx, sty);
    }
    c.closePath();
  } else {
    for (var hi = 0; hi < 6; hi++) {
      var ha = (hi / 6) * 6.2832 - Math.PI / 2;
      var hpx = Math.cos(ha) * r, hpy = Math.sin(ha) * r;
      if (hi === 0) c.moveTo(hpx, hpy); else c.lineTo(hpx, hpy);
    }
    c.closePath();
  }
  c.fill();
  c.strokeStyle = flash ? '#fff' : color;
  c.lineWidth = 2.5;
  c.stroke();

  if (!perfMode) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    var corePulse = 1 + Math.sin(this.t * 5) * 0.2;
    Sprites.drawGlow(c, 0, 0, r * 0.8 * corePulse, color, 0.85);
    c.globalCompositeOperation = 'source-over';
    c.restore();
  } else {
    c.fillStyle = color;
    c.beginPath(); c.arc(0, 0, r * 0.4, 0, 6.2832); c.fill();
  }

  c.fillStyle = '#0a0714';
  c.beginPath();
  c.arc(-r * 0.35, -r * 0.15, r * 0.11, 0, 6.2832);
  c.arc(r * 0.35, -r * 0.15, r * 0.11, 0, 6.2832);
  c.fill();
  c.fillStyle = this.phase >= 3 ? '#ffc857' : color;
  c.beginPath();
  c.arc(-r * 0.35, -r * 0.15, r * 0.05, 0, 6.2832);
  c.arc(r * 0.35, -r * 0.15, r * 0.05, 0, 6.2832);
  c.fill();

  c.strokeStyle = flash ? '#fff' : (this.bossType === 'titan' ? '#ffe8a8' : color);
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  if (this.bossType === 'devourer') {
    c.moveTo(-r * 0.55, -r * 0.85); c.lineTo(-r * 0.75, -r * 1.35);
    c.moveTo(r * 0.55, -r * 0.85); c.lineTo(r * 0.75, -r * 1.35);
    c.moveTo(-r * 0.2, -r * 0.95); c.lineTo(0, -r * 1.45);
    c.moveTo(r * 0.2, -r * 0.95); c.lineTo(0, -r * 1.45);
  } else if (this.bossType === 'summoner') {
    c.moveTo(-r * 0.7, -r * 0.7); c.lineTo(-r * 0.85, -r * 1.15);
    c.moveTo(r * 0.7, -r * 0.7); c.lineTo(r * 0.85, -r * 1.15);
  } else if (this.bossType === 'mage') {
    c.moveTo(-r * 0.5, -r * 0.9); c.lineTo(0, -r * 1.5); c.lineTo(r * 0.5, -r * 0.9);
  } else {
    c.moveTo(-r * 0.5, -r * 0.95); c.lineTo(-r * 0.5, -r * 1.35);
    c.lineTo(-r * 0.17, -r * 1.05); c.lineTo(0, -r * 1.5);
    c.lineTo(r * 0.17, -r * 1.05); c.lineTo(r * 0.5, -r * 1.35);
    c.lineTo(r * 0.5, -r * 0.95);
  }
  c.stroke();
  c.restore();
};

/* ================= ИГРОК ================= */
function Player(x, y) {
  this.x = x; this.y = y;
  this.vx = 0; this.vy = 0;
  this.radius = 15;
  this.maxHp = 100; this.hp = 100; this.hpRegen = 0;
  this.maxMana = 100; this.mana = 100; this.manaRegen = 7;
  this.speed = 215;
  this.damageMul = 1; this.critChance = 0.05; this.critMul = 2;
  this.cooldownMul = 1;
  this.projectiles = 1; this.lifesteal = 0; this.armor = 0;
  this.boltBurn = 0; this.boltPierce = 0;
  this.level = 1; this.xp = 0; this.xpNext = 8;
  this.cd = [0, 0, 0, 0, 0];
  this.facing = 0; this.bob = 0;
  this.hurtFlash = 0; this.castFlash = 0;
  this.dead = false;
  this.runeAngle = 0;
  this.invulnTimer = 0;
  this.metaNovaDmg = 0;
  this.metaFireBurn = 0;
  this.metaChainRange = 0;
  this.metaFireHoming = 0;
  this.spellCostMod = [1, 1, 1, 1, 1];
  this.spellCdMod = [1, 1, 1, 1, 1];
  this.spellDisabled = [false, false, false, false, false];
  this.chainMaxJumps = 4;
}
Player.prototype.addXp = function (n) {
  this.xp += n;
  var lv = 0;
  while (this.xp >= this.xpNext) {
    this.xp -= this.xpNext;
    this.level++;
    this.xpNext = Math.round(this.xpNext * 1.42 + 4);
    lv++;
  }
  return lv;
};
Player.prototype.hurt = function (d) {
  if (this.invulnTimer > 0) return 0;
  var real = d * (1 - this.armor);
  this.hp -= real;
  this.hurtFlash = 0.25;
  if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  return real;
};
Player.prototype.heal = function (n) { this.hp = Math.min(this.maxHp, this.hp + n); };
Player.prototype.update = function (dt, mx, my) {
  var len = Math.sqrt(mx * mx + my * my);
  if (len > 1) { mx /= len; my /= len; }
  this.vx = Utils.damp(this.vx, mx * this.speed, 22, dt);
  this.vy = Utils.damp(this.vy, my * this.speed, 22, dt);
  this.x += this.vx * dt; this.y += this.vy * dt;
  if (len > 0.05) this.facing = Math.atan2(this.vy, this.vx);
  this.bob += dt * (len > 0.05 ? 11 : 2.5);
  this.runeAngle += dt * 0.7;
  this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
  if (this.hpRegen > 0) this.heal(this.hpRegen * dt);
  for (var i = 0; i < this.cd.length; i++) if (this.cd[i] > 0) this.cd[i] = Math.max(0, this.cd[i] - dt);
  if (this.hurtFlash > 0) this.hurtFlash -= dt;
  if (this.castFlash > 0) this.castFlash -= dt;
  if (this.invulnTimer > 0) this.invulnTimer -= dt;
};
Player.prototype.drawRune = function (c) {
  var perfMode = (typeof Game !== 'undefined' && Game.performanceMode);
  c.save();
  c.translate(this.x, this.y);
  if (!perfMode) {
    var pulse = 0.9 + Math.sin(this.runeAngle * 3) * 0.1;
    c.rotate(this.runeAngle);
    c.scale(pulse, pulse);
  }
  c.strokeStyle = 'rgba(181, 107, 255, 0.35)';
  c.lineWidth = 1.4;
  c.beginPath(); c.arc(0, 0, this.radius + 12, 0, 6.2832); c.stroke();
  c.strokeStyle = 'rgba(181, 107, 255, 0.55)';
  c.lineWidth = 1.6;
  c.beginPath();
  for (var i = 0; i < 6; i++) {
    var a = (i / 6) * 6.2832;
    var px = Math.cos(a) * (this.radius + 8);
    var py = Math.sin(a) * (this.radius + 8);
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath(); c.stroke();
  c.restore();
};
Player.prototype.draw = function (c) {
  var r = this.radius;
  var bobY = Math.sin(this.bob) * 1.8;
  var perfMode = (typeof Game !== 'undefined' && Game.performanceMode);

  // Щит / неуязвимость
  if (this.invulnTimer > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    Sprites.drawGlow(c, this.x, this.y, r * 2.5, '#88ddff', 0.35);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 0.55 + Math.sin(performance.now() * 0.015) * 0.25;
    c.strokeStyle = '#88ddff';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(this.x, this.y, r + 14, 0, 6.2832);
    c.stroke();
    c.restore();
  }

  this.drawRune(c);
  c.save();
  c.translate(this.x, this.y + bobY);

  c.globalAlpha = 0.35;
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(0, r * 0.9, r * 0.9, r * 0.36, 0, 0, 6.2832);
  c.fill();
  c.globalAlpha = 1;

  if (!perfMode) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    var auraA = 0.22 + Math.sin(this.bob * 0.6) * 0.06;
    Sprites.drawGlow(c, 0, 0, r * 3.1, '#8c6eff', auraA);
    c.globalCompositeOperation = 'source-over';
    c.restore();
  }

  var flash = this.hurtFlash > 0;
  c.fillStyle = flash ? '#ff8b9a' : '#2a1c52';
  c.beginPath();
  c.moveTo(0, -r * 1.15);
  c.quadraticCurveTo(r * 1.15, -r * 0.1, r * 0.95, r * 1.05);
  c.lineTo(-r * 0.95, r * 1.05);
  c.quadraticCurveTo(-r * 1.15, -r * 0.1, 0, -r * 1.15);
  c.fill();

  c.strokeStyle = flash ? '#fff' : '#7a5bcf';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(0, -r * 0.85);
  c.lineTo(0, r * 0.95);
  c.stroke();

  c.fillStyle = flash ? '#ffd0d6' : '#4a2f96';
  c.beginPath(); c.arc(0, -r * 0.55, r * 0.62, 0, 6.2832); c.fill();

  c.fillStyle = '#0a0714';
  c.beginPath(); c.arc(0, -r * 0.52, r * 0.40, 0, 6.2832); c.fill();

  c.fillStyle = this.castFlash > 0 ? '#ffffff' : '#8ad4ff';
  c.beginPath();
  c.arc(-r * 0.16, -r * 0.55, 1.9, 0, 6.2832);
  c.arc(r * 0.16, -r * 0.55, 1.9, 0, 6.2832);
  c.fill();

  c.rotate(this.facing);
  c.strokeStyle = '#6b4a2a';
  c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(r * 0.6, r * 0.5);
  c.lineTo(r * 1.55, -r * 0.35);
  c.stroke();

  var cs = this.castFlash > 0 ? 5.5 : 4;
  var crystalColor = this.castFlash > 0 ? '#ffffff' : '#8ad4ff';
  c.fillStyle = crystalColor;
  c.beginPath();
  c.moveTo(r * 1.55, -r * 0.35 - cs);
  c.lineTo(r * 1.55 + cs * 0.7, -r * 0.35);
  c.lineTo(r * 1.55, -r * 0.35 + cs);
  c.lineTo(r * 1.55 - cs * 0.7, -r * 0.35);
  c.closePath();
  c.fill();
  c.restore();
};
