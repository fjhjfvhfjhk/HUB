/* ============================================================
   BOOK v6 — статы, заклинания (loadout), достижения
   ============================================================ */

var Book = {
  state: 'closed',
  currentPage: 0,
  chapters: [
    { id: 'stats',        title: '📊 Статы',        type: 'upgrades' },
    { id: 'loadout',      title: '✨ Заклинания',   type: 'loadout' },
    { id: 'achievements', title: '🏆 Достижения',   type: 'achievements' }
  ],
  elems: {},

  init: function () {
    var $ = function (id) { return document.getElementById(id); };
    this.elems = {
      cover: $('book-cover'),
      content: $('book-content'),
      page: $('book-page'),
      tabs: $('book-tabs'),
      prev: $('book-prev'),
      next: $('book-next'),
      pageNum: $('book-page-num'),
      close: $('book-close'),
      coverSouls: $('cover-souls')
    };

    var self = this;
    this.elems.cover.addEventListener('click', function () { self.openBook(); });
    this.elems.close.addEventListener('click', function (e) { e.stopPropagation(); self.closeBook(); });
    this.elems.prev.addEventListener('click', function () { self.prevPage(); });
    this.elems.next.addEventListener('click', function () { self.nextPage(); });

    var tabHtml = '';
    for (var i = 0; i < this.chapters.length; i++) {
      tabHtml += '<button class="book-tab" data-chapter="' + i + '">' + this.chapters[i].title + '</button>';
    }
    this.elems.tabs.innerHTML = tabHtml;
    var tabs = this.elems.tabs.querySelectorAll('.book-tab');
    for (var j = 0; j < tabs.length; j++) {
      (function (idx) {
        tabs[idx].addEventListener('click', function () { self.goToChapter(idx); });
      })(j);
    }
  },

  show: function () {
    this.state = 'closed';
    this.currentPage = 0;
    this.elems.cover.style.display = 'flex';
    this.elems.cover.style.opacity = '1';
    this.elems.cover.style.transform = 'scale(1)';
    this.elems.content.classList.remove('visible');
    this.elems.content.style.opacity = '0';
    if (this.elems.coverSouls) this.elems.coverSouls.textContent = Utils.formatNum(Game.meta.souls);
  },

  openBook: function () {
    if (this.state === 'open') return;
    this.state = 'open';
    Audio2.bookOpen();
    Utils.vibrate(20);
    var cover = this.elems.cover;
    var content = this.elems.content;
    cover.style.transition = 'opacity .3s, transform .3s';
    cover.style.opacity = '0';
    cover.style.transform = 'scale(.92)';
    var self = this;
    setTimeout(function () {
      cover.style.display = 'none';
      content.classList.add('visible');
      content.style.opacity = '0';
      self.currentPage = 0;
      self.renderPage();
      self.updateTabs();
      self.updateNav();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          content.style.transition = 'opacity .3s';
          content.style.opacity = '1';
        });
      });
    }, 300);
  },

  closeBook: function () {
    Audio2.uiClick();
    Game.setState('menu');
    this.show();
  },

  goToChapter: function (chapterIdx) {
    if (chapterIdx === this.currentPage) return;
    this.animateToPage(chapterIdx, chapterIdx > this.currentPage ? 'forward' : 'backward');
  },

  prevPage: function () {
    if (this.currentPage <= 0) return;
    this.animateToPage(this.currentPage - 1, 'backward');
  },

  nextPage: function () {
    if (this.currentPage >= this.chapters.length - 1) return;
    this.animateToPage(this.currentPage + 1, 'forward');
  },

  animateToPage: function (target, direction) {
    var el = this.elems.page;
    var outClass = direction === 'forward' ? 'slide-left-out' : 'slide-right-out';
    var inClass = direction === 'forward' ? 'slide-right-in' : 'slide-left-in';
    el.classList.remove('slide-left-out', 'slide-right-out', 'slide-left-in', 'slide-right-in');
    el.classList.add(outClass);
    var self = this;
    setTimeout(function () {
      self.currentPage = target;
      self.renderPage();
      self.updateTabs();
      self.updateNav();
      el.classList.remove(outClass);
      el.classList.add(inClass);
      setTimeout(function () {
        el.classList.remove(inClass);
      }, 240);
    }, 200);
  },

  updateTabs: function () {
    var tabs = this.elems.tabs.querySelectorAll('.book-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (parseInt(tabs[i].getAttribute('data-chapter'), 10) === this.currentPage) {
        tabs[i].classList.add('active');
      } else {
        tabs[i].classList.remove('active');
      }
    }
  },

  updateNav: function () {
    this.elems.prev.disabled = this.currentPage <= 0;
    this.elems.next.disabled = this.currentPage >= this.chapters.length - 1;
    this.elems.pageNum.textContent = (this.currentPage + 1) + ' / ' + this.chapters.length;
  },

  /* ================== RENDER ================== */
  renderPage: function () {
    var chapter = this.chapters[this.currentPage];
    var pageEl = this.elems.page;
    pageEl.innerHTML = '';

    if (chapter.type === 'upgrades') this.renderStatsPage(pageEl);
    else if (chapter.type === 'loadout') this.renderLoadoutPage(pageEl);
    else if (chapter.type === 'achievements') this.renderAchievementsPage(pageEl);
  },

  /* ---------- STATS ---------- */
  renderStatsPage: function (pageEl) {
    var html = '';
    html += '<div class="book-souls-badge">✦ ' + Utils.formatNum(Game.meta.souls) + '</div>';
    html += '<div class="book-chapter-title">📊 Статы персонажа</div>';

    for (var i = 0; i < META_STATS.length; i++) {
      var upg = META_STATS[i];
      var level = Game.meta.stats[upg.id] || 0;
      var maxed = level >= upg.maxLevel;
      var cost = maxed ? 0 : costFor(upg, level);
      var canBuy = !maxed && Game.meta.souls >= cost;

      html += '<div class="book-upgrade-row' + (maxed ? ' maxed' : '') + '">';
      html += '<div class="book-upg-icon">' + upg.icon + '</div>';
      html += '<div class="book-upg-info">';
      html += '<div class="book-upg-name">' + upg.name + ' <span class="book-upg-level">' + level + '/' + upg.maxLevel + '</span></div>';
      html += '<div class="book-upg-desc">' + (maxed ? 'Максимум' : upg.desc(level + 1)) + '</div>';
      html += '</div>';
      if (maxed) {
        html += '<button class="book-upg-buy" disabled>✓</button>';
      } else {
        html += '<button class="book-upg-buy" data-action="buystat" data-id="' + upg.id + '"' + (canBuy ? '' : ' disabled') + '>' + cost + ' ✦</button>';
      }
      html += '</div>';
    }

    pageEl.innerHTML = html;
    this.bindStatButtons();
  },

  bindStatButtons: function () {
    var self = this;
    var btns = this.elems.page.querySelectorAll('.book-upg-buy[data-action="buystat"]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        var handler = function (e) {
          e.preventDefault(); e.stopPropagation();
          self.buyStat(btn.getAttribute('data-id'));
        };
        btn.addEventListener('click', handler);
        btn.addEventListener('touchstart', handler, { passive: false });
      })(btns[i]);
    }
  },

  buyStat: function (id) {
    var upg = null;
    for (var i = 0; i < META_STATS.length; i++) if (META_STATS[i].id === id) { upg = META_STATS[i]; break; }
    if (!upg) return;
    var level = Game.meta.stats[upg.id] || 0;
    if (level >= upg.maxLevel) return;
    var cost = costFor(upg, level);
    if (Game.meta.souls < cost) return;
    Game.meta.souls -= cost;
    Game.meta.stats[upg.id] = level + 1;
    Game.saveMeta();
    Audio2.buy();
    Utils.vibrate(30);
    Game.checkAchievements();
    this.renderPage();
    this.updateSouls();
  },

  /* ---------- LOADOUT ---------- */
  renderLoadoutPage: function (pageEl) {
    var meta = Game.meta;
    var slots = meta.spellSlots;
    var loadout = meta.spellsLoadout;
    var unlocked = meta.spellsUnlocked;

    var html = '';
    html += '<div class="book-souls-badge">✦ ' + Utils.formatNum(meta.souls) + '</div>';
    html += '<div class="book-chapter-title">✨ Выбор заклинаний</div>';

    html += '<div class="loadout-header">';
    html += '<div class="loadout-slots-info">Слоты: <b>' + loadout.length + '/' + slots + '</b></div>';
    if (slots < SPELL_SLOT_MAX) {
      var canBuySlot = meta.souls >= SPELL_SLOT_5_COST;
      html += '<button class="loadout-buy-slot" data-action="buyslot"' + (canBuySlot ? '' : ' disabled') + '>+ Слот 5 за ' + SPELL_SLOT_5_COST + ' ✦</button>';
    } else {
      html += '<div class="loadout-slots-info" style="font-size:11px;color:#8a4d1d">Максимум слотов</div>';
    }
    html += '</div>';

    for (var i = 0; i < SPELL_DEFS.length; i++) {
      var sp = SPELL_DEFS[i];
      var isUnlocked = unlocked.indexOf(sp.id) !== -1;
      var isEquipped = loadout.indexOf(sp.id) !== -1;
      var rowClass = 'spell-row';
      if (isEquipped) rowClass += ' equipped';
      else if (!isUnlocked) rowClass += ' locked';

      html += '<div class="' + rowClass + '">';
      html += '<div class="spell-row-icon">' + sp.icon + '</div>';
      html += '<div class="spell-row-info">';
      html += '<div class="spell-row-name">' + sp.name + ' <span style="font-size:10px;color:#8a4d1d;font-weight:700">' + sp.cost + '✦ · ' + sp.cooldown + 'с</span></div>';
      html += '<div class="spell-row-desc">' + sp.desc + '</div>';
      html += '</div>';

      if (isEquipped) {
        html += '<button class="spell-row-action unequip" data-action="unequip" data-id="' + sp.id + '">Снять</button>';
      } else if (isUnlocked) {
        var canEquip = loadout.length < slots;
        html += '<button class="spell-row-action equip" data-action="equip" data-id="' + sp.id + '"' + (canEquip ? '' : ' disabled') + '>' + (canEquip ? 'Экипировать' : 'Слот полон') + '</button>';
      } else {
        var canBuy = meta.souls >= sp.unlockCost;
        html += '<button class="spell-row-action buy" data-action="buyspell" data-id="' + sp.id + '"' + (canBuy ? '' : ' disabled') + '>Купить ' + sp.unlockCost + ' ✦</button>';
      }
      html += '</div>';
    }

    pageEl.innerHTML = html;
    this.bindLoadoutButtons();
  },

  bindLoadoutButtons: function () {
    var self = this;
    var btns = this.elems.page.querySelectorAll('[data-action]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        var handler = function (e) {
          e.preventDefault(); e.stopPropagation();
          var action = btn.getAttribute('data-action');
          var id = btn.getAttribute('data-id');
          if (action === 'buyslot') self.buySlot();
          else if (action === 'equip') self.equipSpell(id);
          else if (action === 'unequip') self.unequipSpell(id);
          else if (action === 'buyspell') self.buySpell(id);
        };
        btn.addEventListener('click', handler);
        btn.addEventListener('touchstart', handler, { passive: false });
      })(btns[i]);
    }
  },

  buySlot: function () {
    if (Game.meta.spellSlots >= SPELL_SLOT_MAX) return;
    if (Game.meta.souls < SPELL_SLOT_5_COST) return;
    Game.meta.souls -= SPELL_SLOT_5_COST;
    Game.meta.spellSlots = SPELL_SLOT_MAX;
    Game.saveMeta();
    Audio2.buy();
    Utils.vibrate(40);
    this.renderPage();
    this.updateSouls();
  },

  buySpell: function (id) {
    var def = findSpellDef(id);
    if (!def || !def.unlockCost) return;
    if (Game.meta.spellsUnlocked.indexOf(id) !== -1) return;
    if (Game.meta.souls < def.unlockCost) return;
    Game.meta.souls -= def.unlockCost;
    Game.meta.spellsUnlocked.push(id);
    Game.saveMeta();
    Audio2.buy();
    Utils.vibrate(30);
    Game.checkAchievements();
    this.renderPage();
    this.updateSouls();
  },

  equipSpell: function (id) {
    if (Game.meta.spellsLoadout.indexOf(id) !== -1) return;
    if (Game.meta.spellsLoadout.length >= Game.meta.spellSlots) return;
    if (Game.meta.spellsUnlocked.indexOf(id) === -1) return;
    Game.meta.spellsLoadout.push(id);
    Game.saveMeta();
    Audio2.buy();
    Utils.vibrate(20);
    this.renderPage();
  },

  unequipSpell: function (id) {
    var idx = Game.meta.spellsLoadout.indexOf(id);
    if (idx === -1) return;
    Game.meta.spellsLoadout.splice(idx, 1);
    Game.saveMeta();
    Audio2.uiClick();
    Utils.vibrate(15);
    this.renderPage();
  },

  /* ---------- ACHIEVEMENTS ---------- */
  renderAchievementsPage: function (pageEl) {
    var unlocked = Game.meta.achievements || {};
    var total = ACHIEVEMENTS.length;
    var doneCount = 0;
    for (var i = 0; i < total; i++) if (unlocked[ACHIEVEMENTS[i].id]) doneCount++;

    var html = '';
    html += '<div class="book-souls-badge">✦ ' + Utils.formatNum(Game.meta.souls) + '</div>';
    html += '<div class="book-chapter-title">🏆 Достижения (' + doneCount + '/' + total + ')</div>';

    for (var j = 0; j < ACHIEVEMENTS.length; j++) {
      var a = ACHIEVEMENTS[j];
      var isDone = !!unlocked[a.id];
      var rowClass = 'ach-row ' + (isDone ? 'unlocked' : 'locked');
      html += '<div class="' + rowClass + '">';
      html += '<div class="ach-row-icon">' + (isDone ? a.icon : '🔒') + '</div>';
      html += '<div class="ach-row-info">';
      html += '<div class="ach-row-name">' + a.name + '</div>';
      html += '<div class="ach-row-desc">' + a.desc + '</div>';
      html += '</div>';
      html += '<div class="ach-row-reward">' + (isDone ? '✓' : '+' + a.souls + ' ✦') + '</div>';
      html += '</div>';
    }

    pageEl.innerHTML = html;
  },

  updateSouls: function () {
    if (this.elems.coverSouls) this.elems.coverSouls.textContent = Utils.formatNum(Game.meta.souls);
    var menuSouls = document.getElementById('menu-souls');
    if (menuSouls) menuSouls.textContent = Utils.formatNum(Game.meta.souls);
  }
};
