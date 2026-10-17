/* ============================================================
   BOOK — книга душ с обложкой и перелистыванием страниц
   ============================================================ */

var Book = {
  state: 'closed',
  currentPage: 0,
  pages: [
    { chapter: 0, items: ['hp', 'manaRegen', 'damage'] },
    { chapter: 0, items: ['speed', 'crit'] },
    { chapter: 1, items: ['novaDmg', 'fireBurn'] },
    { chapter: 1, items: ['chainRange', 'fireHoming'] }
  ],
  chapters: [
    { id: 'stats',  title: '📊 Статы персонажа' },
    { id: 'spells', title: '✨ Заклинания' }
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

    // build tabs
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
    for (var i = 0; i < this.pages.length; i++) {
      if (this.pages[i].chapter === chapterIdx) {
        if (i === this.currentPage) return;
        this.animateToPage(i, i > this.currentPage ? 'forward' : 'backward');
        return;
      }
    }
  },

  prevPage: function () {
    if (this.currentPage <= 0) return;
    this.animateToPage(this.currentPage - 1, 'backward');
  },

  nextPage: function () {
    if (this.currentPage >= this.pages.length - 1) return;
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
    var chapter = this.pages[this.currentPage].chapter;
    var tabs = this.elems.tabs.querySelectorAll('.book-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (parseInt(tabs[i].getAttribute('data-chapter'), 10) === chapter) {
        tabs[i].classList.add('active');
      } else {
        tabs[i].classList.remove('active');
      }
    }
  },

  updateNav: function () {
    this.elems.prev.disabled = this.currentPage <= 0;
    this.elems.next.disabled = this.currentPage >= this.pages.length - 1;
    this.elems.pageNum.textContent = (this.currentPage + 1) + ' / ' + this.pages.length;
  },

  renderPage: function () {
    var pageIdx = this.currentPage;
    var pageData = this.pages[pageIdx];
    var chapterIdx = pageData.chapter;
    var chapter = this.chapters[chapterIdx];
    var group = chapterIdx === 0 ? 'stats' : 'spells';
    var upgList = chapterIdx === 0 ? META_STATS : META_SPELLS;

    var html = '';
    html += '<div class="book-souls-badge">✦ ' + Utils.formatNum(Game.meta.souls) + '</div>';

    // chapter title only on first page of chapter
    var isFirstPageOfChapter = pageIdx === 0 || this.pages[pageIdx - 1].chapter !== chapterIdx;
    if (isFirstPageOfChapter) {
      html += '<div class="book-chapter-title">' + chapter.title + '</div>';
    }

    for (var i = 0; i < pageData.items.length; i++) {
      html += this.renderRow(pageData.items[i], group, upgList, chapterIdx);
    }

    this.elems.page.innerHTML = html;

    // bind buy buttons
    var btns = this.elems.page.querySelectorAll('.book-upg-buy[data-id]');
    var self = this;
    for (var j = 0; j < btns.length; j++) {
      (function (btn) {
        var id = btn.getAttribute('data-id');
        var ch = parseInt(btn.getAttribute('data-chapter'), 10);
        var handler = function (e) {
          e.preventDefault(); e.stopPropagation();
          self.buyUpgrade(id, ch);
        };
        btn.addEventListener('click', handler);
        btn.addEventListener('touchstart', handler, { passive: false });
      })(btns[j]);
    }
  },

  renderRow: function (upgId, group, upgList, chapterIdx) {
    var upg = null;
    for (var i = 0; i < upgList.length; i++) {
      if (upgList[i].id === upgId) { upg = upgList[i]; break; }
    }
    if (!upg) return '';
    var level = Game.meta[group][upg.id] || 0;
    var maxed = level >= upg.maxLevel;
    var cost = maxed ? 0 : costFor(upg, level);
    var canBuy = !maxed && Game.meta.souls >= cost;

    var html = '<div class="book-upgrade-row' + (maxed ? ' maxed' : '') + '">';
    html += '<div class="book-upg-icon">' + upg.icon + '</div>';
    html += '<div class="book-upg-info">';
    html += '<div class="book-upg-name">' + upg.name + ' <span class="book-upg-level">' + level + '/' + upg.maxLevel + '</span></div>';
    html += '<div class="book-upg-desc">' + (maxed ? 'Максимум' : upg.desc(level + 1)) + '</div>';
    html += '</div>';
    if (maxed) {
      html += '<button class="book-upg-buy" disabled>✓</button>';
    } else {
      html += '<button class="book-upg-buy" data-id="' + upg.id + '" data-chapter="' + chapterIdx + '"' + (canBuy ? '' : ' disabled') + '>' + cost + ' ✦</button>';
    }
    html += '</div>';
    return html;
  },

  buyUpgrade: function (id, chapterIdx) {
    var group = chapterIdx === 0 ? 'stats' : 'spells';
    var upgList = chapterIdx === 0 ? META_STATS : META_SPELLS;
    var upg = null;
    for (var i = 0; i < upgList.length; i++) {
      if (upgList[i].id === id) { upg = upgList[i]; break; }
    }
    if (!upg) return;
    var level = Game.meta[group][upg.id] || 0;
    if (level >= upg.maxLevel) return;
    var cost = costFor(upg, level);
    if (Game.meta.souls < cost) return;
    Game.meta.souls -= cost;
    Game.meta[group][upg.id] = level + 1;
    Game.saveMeta();
    Audio2.buy();
    Utils.vibrate(30);
    this.renderPage();
    this.updateSouls();
  },

  updateSouls: function () {
    if (this.elems.coverSouls) this.elems.coverSouls.textContent = Utils.formatNum(Game.meta.souls);
    // also refresh menu souls display
    var menuSouls = document.getElementById('menu-souls');
    if (menuSouls) menuSouls.textContent = Utils.formatNum(Game.meta.souls);
  }
};
