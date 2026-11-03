/* ============================================================================
   ХАБ ПРОЕКТОВ · hub.js · v2026-11-03-1

   Что нового:
     • Раздел «🎨 Скины»: список скинов из skins.json, 3D-просмотр через
       skinview3d (CDN), кнопка скачать PNG, ссылки на ely.by (скин + автор).
     • Lazy init 3D через IntersectionObserver — не создаём десятки
       Three.js-контекстов сразу. При уходе с раздела — dispose().
     • Cache-busting для iframe проектов: HEAD → Last-Modified → ?v=.
     • Одноразовая очистка устаревших Service Worker из /projects/*.

   ============================================================================ */
(function () {
  'use strict';

  const HUB_VERSION = '2026-11-03-1';
  const STORAGE_FAV = 'hub_favorites_v1';
  const STORAGE_RECENT = 'hub_recent_v1';
  const CLEAN_KEY = 'hub_cleaned_' + HUB_VERSION;
  const RECENT_MAX = 12;

  /* ---------------- DOM ---------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const grid         = $('#grid');
  const skinsGrid    = $('#skins-grid');
  const tagbar       = $('#tagbar');
  const searchInp    = $('#search-input');
  const emptyEl      = $('#empty');
  const emptyText    = $('#empty-text');
  const skinsEmptyEl = $('#skins-empty');
  const loadErr      = $('#load-error');
  const statTotal    = $('#stat-total');
  const statTags     = $('#stat-tags');
  const statFav      = $('#stat-fav');
  const skinTotal    = $('#skin-total');
  const modal        = $('#modal');
  const modalFrame   = $('#modal-frame');
  const modalIcon    = $('#modal-icon');
  const modalTitle   = $('#modal-title');
  const modalExt     = $('#modal-external');
  const skinModal        = $('#skin-modal');
  const skinModalTitle   = $('#skin-modal-title');
  const skinModalInfo    = $('#skin-modal-info');
  const skinModalCanvas  = $('#skin-modal-canvas');
  const skinModalDownload = $('#skin-modal-download');
  const toastEl      = $('#toast');
  const resetBtn     = $('#reset-btn');

  /* ---------------- State ---------------- */
  let allProjects = [];
  let allSkins    = [];
  let favorites   = loadSet(STORAGE_FAV);
  let recent      = loadArray(STORAGE_RECENT);
  let activeView  = 'all';   // all | favorites | recent | skins
  let activeTag   = 'all';
  let query       = '';
  let openProject = null;
  let openSkin    = null;
  let skinViewers = new Map();   // id -> SkinViewer instance
  let skinObserver = null;

  /* ---------------- Хранилище ---------------- */
  function loadSet(key) {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) { return new Set(); }
  }
  function saveSet(key, set) {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  function loadArray(key) {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveArray(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }

  /* ---------------- Утилиты ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function pickIconHtml(icon) {
    if (!icon) return '<span>◈</span>';
    if (typeof icon === 'string' && icon.trim().startsWith('<')) return icon;
    return `<span>${escapeHtml(icon)}</span>`;
  }
  function safePath(p) {
    if (!p) return '';
    let path = String(p).replace(/^\/+/, '');
    if (!path.endsWith('/') && !path.endsWith('.html')) path += '/';
    return path;
  }
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('is-show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toastEl.classList.remove('is-show');
      setTimeout(() => { toastEl.hidden = true; }, 250);
    }, 1800);
  }
  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return `rgba(139,92,246,${a})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ---------------- Cache-busting версия проекта ---------------- */
  async function getProjectVersion(proj) {
    try {
      const url = safePath(proj.path) + 'index.html';
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (res && res.ok) {
        const lm = res.headers.get('last-modified');
        if (lm) {
          const ts = new Date(lm).getTime();
          if (!isNaN(ts) && ts > 0) return 'lm' + ts;
        }
        const etag = res.headers.get('etag');
        if (etag) return 'et' + etag.replace(/[^a-z0-9]/gi, '').slice(0, 20);
      }
    } catch (e) { /* offline fallback */ }
    const v = proj.version || proj.added || '1';
    return 'fb' + String(v).replace(/[^a-z0-9]/gi, '');
  }

  /* ---------------- Очистка устаревших SW ---------------- */
  async function cleanupStaleGameCaches() {
    if (!('serviceWorker' in navigator)) return;
    try { if (localStorage.getItem(CLEAN_KEY) === '1') return; } catch (e) {}

    let unregistered = 0;
    let cleared = 0;

    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        try {
          if (reg.scope && reg.scope.indexOf('/projects/') !== -1) {
            await reg.unregister();
            unregistered++;
          }
        } catch (e) {}
      }
    } catch (e) {}

    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        for (const k of keys) {
          if (k.indexOf('lux7-') === 0) {
            try { await caches.delete(k); cleared++; } catch (e) {}
          }
        }
      }
    } catch (e) {}

    try { localStorage.setItem(CLEAN_KEY, '1'); } catch (e) {}
    if (unregistered || cleared) {
      console.log('[hub] cleanup: SW=' + unregistered + ' caches=' + cleared);
    }
  }

  /* ---------------- Init ---------------- */
  function init() {
    cleanupStaleGameCaches();
    updateStats();
    bindEvents();
    bindHashChange();
    loadSkins();
    fetchProjects();
  }

  /* ---------------- События ---------------- */
  function bindEvents() {
    searchInp.addEventListener('input', () => {
      query = searchInp.value.trim().toLowerCase();
      if (activeView !== 'skins') render();
    });

    $$('.hub-nav__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setView(btn.dataset.view);
      });
    });

    tagbar.addEventListener('click', (e) => {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      activeTag = chip.dataset.tag;
      $$('.tag-chip').forEach((c) => c.classList.toggle('is-active', c === chip));
      render();
    });

    /* Клики по проектам */
    grid.addEventListener('click', (e) => {
      const favBtn = e.target.closest('.card__fav');
      if (favBtn) {
        e.stopPropagation();
        toggleFavorite(favBtn.dataset.id);
        return;
      }
      const launchBtn = e.target.closest('.card__launch');
      if (launchBtn) {
        e.stopPropagation();
        const id = launchBtn.dataset.id;
        const proj = allProjects.find((p) => p.id === id);
        if (proj) openProjectModal(proj);
        return;
      }
      const card = e.target.closest('.card');
      if (card && card.dataset.id) {
        const proj = allProjects.find((p) => p.id === card.dataset.id);
        if (proj) openProjectModal(proj);
      }
    });

    grid.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });

    /* Клики по скинам */
    if (skinsGrid) {
      skinsGrid.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-skin-action]');
        if (actionBtn) {
          e.stopPropagation();
          const id = actionBtn.dataset.id;
          const skin = allSkins.find((s) => s.id === id);
          if (!skin) return;
          const action = actionBtn.dataset.skinAction;
          if (action === 'download') downloadSkin(skin);
          else if (action === 'view') openSkinModal(skin);
          return;
        }
        // Клик по карточке (не по ссылке) → открыть модалку
        if (e.target.closest('a')) return;
        const card = e.target.closest('.skin-card');
        if (card && card.dataset.id) {
          const skin = allSkins.find((s) => s.id === card.dataset.id);
          if (skin) openSkinModal(skin);
        }
      });
    }

    /* Модалка проекта */
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeProjectModal();
    });

    /* Модалка скина */
    if (skinModal) {
      skinModal.addEventListener('click', (e) => {
        if (e.target.closest('[data-skin-close]')) closeSkinModal();
      });
    }

    /* Скачать из модалки скина */
    if (skinModalDownload) {
      skinModalDownload.addEventListener('click', () => {
        if (openSkin) downloadSkin(openSkin);
      });
    }

    /* Горячие клавиши */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (skinModal && !skinModal.hidden) { closeSkinModal(); return; }
        if (!modal.hidden) { closeProjectModal(); return; }
      }
      if (e.key === '/' && document.activeElement !== searchInp && activeView !== 'skins') {
        e.preventDefault();
        searchInp.focus();
      }
      if (/^[1-9]$/.test(e.key) && modal.hidden && document.activeElement !== searchInp && activeView !== 'skins') {
        const list = getVisibleProjects();
        const p = list[parseInt(e.key, 10) - 1];
        if (p) openProjectModal(p);
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('Сбросить избранное и историю посещений?')) return;
        favorites.clear();
        recent = [];
        saveSet(STORAGE_FAV, favorites);
        saveArray(STORAGE_RECENT, recent);
        updateStats();
        render();
        toast('Данные сброшены');
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_FAV) {
        favorites = loadSet(STORAGE_FAV);
        updateStats();
        render();
      }
      if (e.key === STORAGE_RECENT) {
        recent = loadArray(STORAGE_RECENT);
        render();
      }
    });

    window.addEventListener('beforeunload', () => {
      disposeAllSkinViewers();
    });
  }

  /* ---------------- Переключение раздела ---------------- */
  function setView(view) {
    activeView = view;
    const isSkins = view === 'skins';

    document.body.classList.toggle('mode-skins', isSkins);

    $$('.hub-nav__btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.view === view);
    });

    if (isSkins) {
      // Закрываем открытые чужие модалки
      if (!modal.hidden) closeProjectModal({ updateHash: false });
      // Меняем placeholder поиска
      if (searchInp) {
        searchInp.placeholder = 'Поиск по скинам…';
        searchInp.value = '';
        query = '';
      }
      renderSkins();
    } else {
      if (!skinModal.hidden) closeSkinModal({ updateHash: false });
      disposeAllSkinViewers();
      if (searchInp) searchInp.placeholder = 'Поиск проекта…';
      render();
    }
  }

  /* ---------------- Hash ---------------- */
  function bindHashChange() {
    window.addEventListener('hashchange', () => {
      // Проект
      const mp = location.hash.match(/^#project=(.+)$/);
      if (mp && allProjects.length) {
        if (activeView === 'skins') setView('all');
        const proj = allProjects.find((p) => p.id === mp[1]);
        if (proj) openProjectModal(proj, { updateHash: false });
        return;
      }
      // Скин
      const ms = location.hash.match(/^#skin=(.+)$/);
      if (ms && allSkins.length) {
        if (activeView !== 'skins') setView('skins');
        const skin = allSkins.find((s) => s.id === ms[1]);
        if (skin) openSkinModal(skin, { updateHash: false });
        return;
      }
      // Пусто — закрываем всё
      if (!modal.hidden) closeProjectModal({ updateHash: false });
      if (skinModal && !skinModal.hidden) closeSkinModal({ updateHash: false });
    });
  }

  /* ---------------- Загрузка projects.json ---------------- */
  async function fetchProjects() {
    try {
      const res = await fetch('projects.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.projects)) throw new Error('bad schema');

      allProjects = data.projects
        .filter((p) => p && p.id && p.name && p.path)
        .sort((a, b) => (b.added || '').localeCompare(a.added || ''));

      loadErr.hidden = true;
      buildTagBar();
      updateStats();
      render();

      const m = location.hash.match(/^#project=(.+)$/);
      if (m) {
        const proj = allProjects.find((p) => p.id === m[1]);
        if (proj) openProjectModal(proj, { updateHash: false });
      }
    } catch (err) {
      console.error('Failed to load projects.json:', err);
      loadErr.hidden = false;
      grid.innerHTML = '';
    }
  }

  /* ---------------- Загрузка skins.json ---------------- */
  async function loadSkins() {
    try {
      const res = await fetch('skins.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.skins)) throw new Error('bad schema');

      allSkins = data.skins.filter((s) => s && s.id && s.name && s.file);
      updateSkinStats();
      // Если открыт раздел скинов — рендерим
      if (activeView === 'skins') renderSkins();

      // Прямая ссылка через hash
      const ms = location.hash.match(/^#skin=(.+)$/);
      if (ms) {
        const skin = allSkins.find((s) => s.id === ms[1]);
        if (skin) {
          setView('skins');
          openSkinModal(skin, { updateHash: false });
        }
      }
    } catch (e) {
      console.warn('skins.json not loaded:', e);
      allSkins = [];
      updateSkinStats();
      if (activeView === 'skins') renderSkins();
    }
  }

  /* ---------------- Статистика ---------------- */
  function updateStats() {
    statTotal.textContent = allProjects.length;
    const tagSet = new Set();
    allProjects.forEach((p) => (p.tags || []).forEach((t) => tagSet.add(t)));
    statTags.textContent = tagSet.size;
    statFav.textContent = favorites.size;
  }
  function updateSkinStats() {
    if (skinTotal) skinTotal.textContent = allSkins.length;
  }

  /* ---------------- Теги ---------------- */
  function buildTagBar() {
    const tagSet = new Set();
    allProjects.forEach((p) => (p.tags || []).forEach((t) => tagSet.add(t)));

    const html = ['<button class="tag-chip is-active" data-tag="all">Все</button>'];
    Array.from(tagSet).sort().forEach((t) => {
      html.push(`<button class="tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`);
    });
    tagbar.innerHTML = html.join('');

    if (activeTag !== 'all' && !tagSet.has(activeTag)) {
      activeTag = 'all';
      $$('.tag-chip').forEach((c) => c.classList.toggle('is-active', c.dataset.tag === 'all'));
    }
  }

  /* ---------------- Фильтрация проектов ---------------- */
  function getVisibleProjects() {
    return allProjects.filter((p) => {
      if (activeView === 'favorites' && !favorites.has(p.id)) return false;
      if (activeView === 'recent' && !recent.includes(p.id)) return false;

      if (activeTag !== 'all') {
        const tags = p.tags || [];
        if (!tags.includes(activeTag)) return false;
      }

      if (query) {
        const hay = [
          p.name, p.desc || '', p.description || '',
          (p.tags || []).join(' '),
        ].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (activeView === 'recent') {
        return recent.indexOf(a.id) - recent.indexOf(b.id);
      }
      return (b.added || '').localeCompare(a.added || '');
    });
  }

  /* ---------------- Рендер проектов ---------------- */
  function render() {
    if (!grid) return;
    const list = getVisibleProjects();

    if (list.length === 0) {
      grid.innerHTML = '';
      emptyEl.hidden = false;
      if (activeView === 'favorites') {
        emptyText.textContent = 'Ты ещё не добавил ни одного проекта в избранное. Нажми на ★ на карточке.';
      } else if (activeView === 'recent') {
        emptyText.textContent = 'Здесь появятся проекты, которые ты запускал.';
      } else if (query) {
        emptyText.textContent = `По запросу "${query}" ничего не нашлось.`;
      } else {
        emptyText.textContent = 'Попробуй снять фильтр или выбрать другой тег.';
      }
      return;
    }

    emptyEl.hidden = true;
    grid.innerHTML = list.map((p, i) => cardHtml(p, i)).join('');
  }

  function cardHtml(p, index) {
    const accent = p.accent || '#8b5cf6';
    const isFav = favorites.has(p.id);
    const tags = (p.tags || []).map((t) => `<span class="card__tag">${escapeHtml(t)}</span>`).join('');
    const desc = escapeHtml(p.desc || p.description || '');
    const styleVars = [
      `--icon-bg:${hexToRgba(accent, 0.22)}`,
      `--icon-glow:${hexToRgba(accent, 0.28)}`,
      `--card-accent-glow:${hexToRgba(accent, 0.18)}`,
    ].join(';');

    return `
      <article class="card" data-id="${escapeHtml(p.id)}" style="${styleVars};animation-delay:${Math.min(index * 40, 400)}ms">
        <button class="card__fav ${isFav ? 'is-fav' : ''}" data-id="${escapeHtml(p.id)}" aria-label="${isFav ? 'Убрать из избранного' : 'В избранное'}">
          ${isFav ? '★' : '☆'}
        </button>
        <div class="card__icon">${pickIconHtml(p.icon)}</div>
        <h2 class="card__name">${escapeHtml(p.name)}</h2>
        <p class="card__desc">${desc}</p>
        <div class="card__tags">${tags}</div>
        <button class="card__launch" data-id="${escapeHtml(p.id)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Запустить
        </button>
      </article>
    `;
  }

  /* ---------------- Избранное ---------------- */
  function toggleFavorite(id) {
    if (favorites.has(id)) {
      favorites.delete(id);
      toast('Убрано из избранного');
    } else {
      favorites.add(id);
      toast('Добавлено в избранное ★');
    }
    saveSet(STORAGE_FAV, favorites);
    updateStats();
    render();
  }

  /* ---------------- Недавние ---------------- */
  function markRecent(id) {
    recent = recent.filter((x) => x !== id);
    recent.unshift(id);
    if (recent.length > RECENT_MAX) recent = recent.slice(0, RECENT_MAX);
    saveArray(STORAGE_RECENT, recent);
  }

  /* ---------------- Модалка проекта ---------------- */
  async function openProjectModal(proj, opts) {
    opts = opts || {};
    if (!proj) return;
    openProject = proj;

    modalIcon.innerHTML = pickIconHtml(proj.icon);
    modalTitle.textContent = proj.name;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    markRecent(proj.id);

    const version = await getProjectVersion(proj);
    if (modal.hidden || openProject !== proj) return;

    const url = safePath(proj.path) + '?v=' + encodeURIComponent(version);
    modalFrame.src = url;
    modalExt.href = url;

    if (opts.updateHash !== false) {
      try { history.replaceState(null, '', '#project=' + proj.id); } catch (e) {}
    }
  }

  function closeProjectModal(opts) {
    opts = opts || {};
    modal.hidden = true;
    modalFrame.src = 'about:blank';
    openProject = null;
    document.body.style.overflow = '';

    if (opts.updateHash !== false) {
      try {
        const url = location.pathname + location.search;
        history.replaceState(null, '', url);
      } catch (e) {}
    }
  }

  /* ---------------- Рендер скинов ---------------- */
  function renderSkins() {
    if (!skinsGrid) return;

    if (allSkins.length === 0) {
      skinsGrid.innerHTML = '';
      skinsGrid.hidden = true;
      if (skinsEmptyEl) skinsEmptyEl.hidden = false;
      return;
    }

    if (skinsEmptyEl) skinsEmptyEl.hidden = true;
    skinsGrid.hidden = false;
    skinsGrid.innerHTML = allSkins.map((s, i) => skinCardHtml(s, i)).join('');
    observeSkinCards();
  }

  function skinCardHtml(s, index) {
    const safe = escapeHtml;
    const desc = s.description ? `<p class="skin-card__desc">${safe(s.description)}</p>` : '';
    const skinLink = s.skinLink ? `
      <a href="${safe(s.skinLink)}" target="_blank" rel="noopener" class="skin-link" title="Открыть скин на ely.by">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M21 14v7H3V3h7"></path>
        </svg>
        Скин на ely.by
      </a>` : '';
    const authorLink = (s.author && s.authorLink) ? `
      <a href="${safe(s.authorLink)}" target="_blank" rel="noopener" class="skin-link" title="Профиль автора на ely.by">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4"></circle>
          <path d="M20 21a8 8 0 1 0-16 0"></path>
        </svg>
        ${safe(s.author)}
      </a>` : '';

    return `
      <article class="skin-card" data-id="${safe(s.id)}" style="animation-delay:${Math.min(index * 40, 400)}ms">
        <div class="skin-card__preview">
          <div class="skin-card__loading">Загрузка 3D…</div>
          <canvas data-skin-id="${safe(s.id)}" width="180" height="260"></canvas>
        </div>
        <div class="skin-card__body">
          <h2 class="skin-card__name">${safe(s.name)}</h2>
          ${desc}
          <div class="skin-card__links">${skinLink}${authorLink}</div>
          <div class="skin-card__actions">
            <button class="skin-btn" data-skin-action="download" data-id="${safe(s.id)}" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Скачать
            </button>
            <button class="skin-btn skin-btn--primary" data-skin-action="view" data-id="${safe(s.id)}" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Открыть
            </button>
          </div>
        </div>
      </article>
    `;
  }

  /* ---------------- 3D-превью скинов (ленивая инициализация) ---------------- */
  function observeSkinCards() {
    if (!('IntersectionObserver' in window)) {
      // Fallback — инициализируем всё сразу
      if (skinsGrid) {
        skinsGrid.querySelectorAll('canvas[data-skin-id]').forEach((c) => {
          const id = c.dataset.skinId;
          const skin = allSkins.find((s) => s.id === id);
          if (skin) initSkinViewer(c, skin);
        });
      }
      return;
    }

    if (skinObserver) skinObserver.disconnect();
    skinObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const c = entry.target;
        const id = c.dataset.skinId;
        const skin = allSkins.find((s) => s.id === id);
        if (skin) initSkinViewer(c, skin);
        skinObserver.unobserve(c);
      });
    }, { rootMargin: '200px' });

    skinsGrid.querySelectorAll('canvas[data-skin-id]').forEach((c) => {
      skinObserver.observe(c);
    });
  }

  async function initSkinViewer(canvasEl, skin) {
    if (skinViewers.has(skin.id)) return;

    // Ждём skinview3d, максимум 3 секунды
    const started = Date.now();
    while (!window.skinview3d && Date.now() - started < 3000) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!window.skinview3d) {
      show2DFallback(canvasEl, skin);
      return;
    }

    try {
      const viewer = new window.skinview3d.SkinViewer({
        canvas: canvasEl,
        width: 180,
        height: 260,
      });
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.8;
      viewer.controls.enableZoom = false;
      viewer.controls.enablePan = false;
      viewer.controls.enableRotate = false;

      await viewer.loadSkin(skin.file);

      skinViewers.set(skin.id, viewer);

      const loading = canvasEl.parentNode.querySelector('.skin-card__loading');
      if (loading) loading.remove();
    } catch (e) {
      console.warn('Skin 3D failed for ' + skin.id + ', using 2D:', e);
      show2DFallback(canvasEl, skin);
    }
  }

  function show2DFallback(canvasEl, skin) {
    const preview = canvasEl.parentNode;
    if (!preview) return;

    canvasEl.style.display = 'none';
    const existing = preview.querySelector('.skin-card__fallback');
    if (existing) existing.remove();

    const img = document.createElement('img');
    img.src = skin.file;
    img.alt = skin.name;
    img.className = 'skin-card__fallback';
    img.style.imageRendering = 'pixelated';
    preview.appendChild(img);

    const loading = preview.querySelector('.skin-card__loading');
    if (loading) loading.remove();
  }

  function disposeAllSkinViewers() {
    if (skinObserver) {
      try { skinObserver.disconnect(); } catch (e) {}
      skinObserver = null;
    }
    skinViewers.forEach((v) => {
      try { v.dispose(); } catch (e) {}
    });
    skinViewers.clear();
  }

  /* ---------------- Модалка скина ---------------- */
  async function openSkinModal(skin, opts) {
    opts = opts || {};
    if (!skin) return;
    openSkin = skin;

    skinModalTitle.textContent = skin.name;

    let infoHtml = '';
    if (skin.description) infoHtml += `<p>${escapeHtml(skin.description)}</p>`;
    const links = [];
    if (skin.skinLink) {
      links.push(`<a href="${escapeHtml(skin.skinLink)}" target="_blank" rel="noopener">Скин на ely.by →</a>`);
    }
    if (skin.author && skin.authorLink) {
      links.push(`<a href="${escapeHtml(skin.authorLink)}" target="_blank" rel="noopener">Автор: ${escapeHtml(skin.author)} →</a>`);
    }
    if (links.length) infoHtml += `<div class="skin-modal__links">${links.join('')}</div>`;
    skinModalInfo.innerHTML = infoHtml;

    skinModal.hidden = false;
    document.body.style.overflow = 'hidden';

    // Уничтожаем предыдущий модальный viewer
    const modalKey = 'modal-' + skin.id;
    if (skinViewers.has(modalKey)) {
      try { skinViewers.get(modalKey).dispose(); } catch (e) {}
      skinViewers.delete(modalKey);
    }

    // Пробуем создать 3D
    await new Promise((r) => setTimeout(r, 60));

    // Размер под окно
    const stage = skinModalCanvas.parentNode;
    const maxW = Math.min(360, (stage ? stage.clientWidth : window.innerWidth) - 40);
    const maxH = Math.min(540, window.innerHeight - 260);

    if (!window.skinview3d) {
      renderModal2DFallback(skin);
      return;
    }

    try {
      const viewer = new window.skinview3d.SkinViewer({
        canvas: skinModalCanvas,
        width: maxW,
        height: maxH,
      });
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.5;
      viewer.controls.enableZoom = true;
      viewer.controls.enablePan = false;
      viewer.controls.enableRotate = true;
      viewer.zoom = 0.9;

      await viewer.loadSkin(skin.file);

      if (openSkin !== skin || skinModal.hidden) {
        try { viewer.dispose(); } catch (e) {}
        return;
      }

      skinViewers.set(modalKey, viewer);
    } catch (e) {
      console.warn('Skin modal 3D failed:', e);
      renderModal2DFallback(skin);
    }

    if (opts.updateHash !== false) {
      try { history.replaceState(null, '', '#skin=' + skin.id); } catch (e) {}
    }
  }

  function renderModal2DFallback(skin) {
    const canvas = skinModalCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.style.display = 'block';

    const img = new Image();
    img.onload = () => {
      const scale = 6;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      canvas.style.imageRendering = 'pixelated';
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Не удалось загрузить', canvas.width / 2, canvas.height / 2);
    };
    img.src = skin.file;
  }

  function closeSkinModal(opts) {
    opts = opts || {};
    skinModal.hidden = true;
    document.body.style.overflow = '';

    if (openSkin) {
      const key = 'modal-' + openSkin.id;
      if (skinViewers.has(key)) {
        try { skinViewers.get(key).dispose(); } catch (e) {}
        skinViewers.delete(key);
      }
    }
    openSkin = null;

    if (opts.updateHash !== false) {
      try {
        const url = location.pathname + location.search;
        history.replaceState(null, '', url);
      } catch (e) {}
    }
  }

  /* ---------------- Скачивание скина ---------------- */
  async function downloadSkin(skin) {
    const url = skin.file;
    const safeName = (skin.id || 'skin').replace(/[^a-z0-9_-]/gi, '_');
    const filename = safeName + '.png';

    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();

      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
      toast('Скачано: ' + filename);
    } catch (e) {
      console.warn('Download failed:', e);
      window.open(url, '_blank');
      toast('Открыл в новой вкладке — сохрани через Ctrl+S');
    }
  }

  /* ---------------- Старт ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
