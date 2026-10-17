/* ============================================================================
   ХАБ ПРОЕКТОВ · hub.js
   Загружает projects.json, рендерит карточки, обрабатывает поиск,
   фильтры, избранное, историю и запуск в модалке-iframe.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------------- Константы ---------------- */
  const STORAGE_FAV    = 'hub_favorites_v1';
  const STORAGE_RECENT = 'hub_recent_v1';
  const RECENT_MAX     = 12;

  /* ---------------- DOM ---------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const grid       = $('#grid');
  const tagbar     = $('#tagbar');
  const searchInp  = $('#search-input');
  const emptyEl    = $('#empty');
  const emptyText  = $('#empty-text');
  const loadErr    = $('#load-error');
  const statTotal  = $('#stat-total');
  const statTags   = $('#stat-tags');
  const statFav    = $('#stat-fav');
  const modal      = $('#modal');
  const modalFrame = $('#modal-frame');
  const modalIcon  = $('#modal-icon');
  const modalTitle = $('#modal-title');
  const modalExt   = $('#modal-external');
  const toastEl    = $('#toast');
  const resetBtn   = $('#reset-btn');

  /* ---------------- State ---------------- */
  let allProjects = [];
  let favorites   = loadSet(STORAGE_FAV);
  let recent      = loadArray(STORAGE_RECENT);
  let activeView  = 'all';  // all | favorites | recent
  let activeTag   = 'all';
  let query       = '';
  let openProject = null;

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
    // Если содержит "<" — считаем, что это готовый SVG/HTML
    if (typeof icon === 'string' && icon.trim().startsWith('<')) return icon;
    return `<span>${escapeHtml(icon)}</span>`;
  }
  function safePath(p) {
    if (!p) return '';
    // Убираем ведущий слэш, чтобы ссылка была относительной
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

  /* ---------------- Инициализация ---------------- */
  function init() {
    updateStats();
    bindEvents();
    bindHashChange();
    fetchProjects();
  }

  /* ---------------- События ---------------- */
  function bindEvents() {
    // Поиск
    searchInp.addEventListener('input', () => {
      query = searchInp.value.trim().toLowerCase();
      render();
    });

    // Виды (все / избранное / недавние)
    $$('.hub-nav__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeView = btn.dataset.view;
        $$('.hub-nav__btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        render();
      });
    });

    // Теги — делегирование
    tagbar.addEventListener('click', (e) => {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      activeTag = chip.dataset.tag;
      $$('.tag-chip').forEach((c) => c.classList.toggle('is-active', c === chip));
      render();
    });

    // Карточки — делегирование (клик по кнопке / избранному)
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

    // Мышь — свечение по курсору
    grid.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });

    // Модалка — закрытие
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeProjectModal();
    });

    // Esc + "/" — горячие клавиши
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) { closeProjectModal(); return; }
      if (e.key === '/' && document.activeElement !== searchInp) {
        e.preventDefault();
        searchInp.focus();
      }
      // 1..9 — открыть проект по счёту в текущем виде
      if (/^[1-9]$/.test(e.key) && modal.hidden && document.activeElement !== searchInp) {
        const list = getVisibleProjects();
        const p = list[parseInt(e.key, 10) - 1];
        if (p) openProjectModal(p);
      }
    });

    // Сброс данных
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

    // Обновляем избранное/недавние между вкладками
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
  }

  /* ---------------- Hash — прямая ссылка на проект ---------------- */
  function bindHashChange() {
    window.addEventListener('hashchange', () => {
      const m = location.hash.match(/^#project=(.+)$/);
      if (m && allProjects.length) {
        const proj = allProjects.find((p) => p.id === m[1]);
        if (proj) openProjectModal(proj, { updateHash: false });
      } else if (modal.hidden === false) {
        closeProjectModal({ updateHash: false });
      }
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

      // Прямая ссылка через hash
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

  /* ---------------- Статистика ---------------- */
  function updateStats() {
    statTotal.textContent = allProjects.length;
    const tagSet = new Set();
    allProjects.forEach((p) => (p.tags || []).forEach((t) => tagSet.add(t)));
    statTags.textContent = tagSet.size;
    statFav.textContent = favorites.size;
  }

  /* ---------------- Теги ---------------- */
  function buildTagBar() {
    const tagSet = new Set();
    allProjects.forEach((p) => (p.tags || []).forEach((t) => tagSet.add(t)));

    // Сохраняем существующий "all" и убираем остальные
    const html = ['<button class="tag-chip is-active" data-tag="all">Все</button>'];
    Array.from(tagSet).sort().forEach((t) => {
      html.push(`<button class="tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`);
    });
    tagbar.innerHTML = html.join('');

    // Если активный тег исчез — сбрасываем
    if (activeTag !== 'all' && !tagSet.has(activeTag)) {
      activeTag = 'all';
      $$('.tag-chip').forEach((c) => c.classList.toggle('is-active', c.dataset.tag === 'all'));
    }
  }

  /* ---------------- Фильтрация ---------------- */
  function getVisibleProjects() {
    const favArr = Array.from(favorites);
    return allProjects.filter((p) => {
      // Вид
      if (activeView === 'favorites' && !favorites.has(p.id)) return false;
      if (activeView === 'recent' && !recent.includes(p.id)) return false;

      // Тег
      if (activeTag !== 'all') {
        const tags = p.tags || [];
        if (!tags.includes(activeTag)) return false;
      }

      // Поиск
      if (query) {
        const hay = [
          p.name, p.desc || '', p.description || '',
          (p.tags || []).join(' '),
        ].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => {
      // В "недавних" — по индексу в recent (новые сверху)
      if (activeView === 'recent') {
        return recent.indexOf(a.id) - recent.indexOf(b.id);
      }
      // Иначе — по дате добавления
      return (b.added || '').localeCompare(a.added || '');
    });
  }

  /* ---------------- Рендер ---------------- */
  function render() {
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

  /* ---------------- Модалка ---------------- */
  function openProjectModal(proj, opts) {
    opts = opts || {};
    if (!proj) return;
    openProject = proj;

    const url = safePath(proj.path);
    modalFrame.src = url;
    modalIcon.innerHTML = pickIconHtml(proj.icon);
    modalTitle.textContent = proj.name;
    modalExt.href = url;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    markRecent(proj.id);

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
    // Вернуть фокус в поиск не нужно — пусть пользователь сам выбирает
  }

  /* ---------------- Старт ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
