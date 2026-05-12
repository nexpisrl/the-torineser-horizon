/**
 * Shop by Color: filtri (palette + artista + anno + quartiere), ordinamento, griglia card.
 */
(function () {
  'use strict';

  const COLOR_PALETTE = [
    { key: 'nero', name: 'Nero', hex: '#1A1A1A' },
    { key: 'crema', name: 'Crema', hex: '#F0EBDD' },
    { key: 'grigio', name: 'Grigio', hex: '#9A9489' },
    { key: 'sabbia', name: 'Sabbia', hex: '#D9C9A3' },
    { key: 'giallo', name: 'Giallo', hex: '#F2C84B' },
    { key: 'ocra', name: 'Ocra', hex: '#B89020' },
    { key: 'arancio', name: 'Arancio', hex: '#E8853A' },
    { key: 'rame', name: 'Rame', hex: '#C4642A' },
    { key: 'rosa', name: 'Rosa', hex: '#E89898' },
    { key: 'rosso', name: 'Rosso', hex: '#C8342A' },
    { key: 'magenta', name: 'Magenta', hex: '#D88BB0' },
    { key: 'lilla', name: 'Lilla', hex: '#B5A8D6' },
    { key: 'viola', name: 'Viola', hex: '#4A148C' },
    { key: 'blu', name: 'Blu', hex: '#1B4D8E' },
    { key: 'verde', name: 'Verde', hex: '#2D6A4F' },
    { key: 'turchese', name: 'Turchese', hex: '#3A8C8C' },
    { key: 'marrone', name: 'Marrone', hex: '#6B4423' },
  ];

  const COLOR_KEY_MAP = Object.fromEntries(COLOR_PALETTE.map((c) => [c.key, c]));

  /** @param {string} hex */
  function nearestColorKey(hex) {
    const h = String(hex || '')
      .replace('#', '')
      .trim();
    if (h.length < 6) return 'nero';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return 'nero';
    let best = 'nero';
    let bestD = Infinity;
    COLOR_PALETTE.forEach((p) => {
      const ph = p.hex.replace('#', '');
      const pr = parseInt(ph.slice(0, 2), 16);
      const pg = parseInt(ph.slice(2, 4), 16);
      const pb = parseInt(ph.slice(4, 6), 16);
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p.key;
      }
    });
    return best;
  }

  const UNKNOWN_COLOR_KEY = '__unknown__';

  /** @param {Record<string, unknown>} raw */
  function normalizeProduct(raw) {
    const hexP = String(raw.hex_primary || '').trim();
    const hexS = String(raw.hex_secondary || '').trim();
    if (!hexP && !hexS) {
      return {
        id: Number(raw.id),
        handle: String(raw.handle || ''),
        url: String(raw.url || ''),
        title: String(raw.title || ''),
        artist: String(raw.artist || ''),
        quartiere: String(raw.quartiere || ''),
        hex_primary: '',
        hex_secondary: '',
        colors: ['', ''],
        colorKeys: [UNKNOWN_COLOR_KEY, UNKNOWN_COLOR_KEY],
        price: Number(raw.price) || 0,
        published_at: Number(raw.published_at) || 0,
        anno: raw.anno === null || raw.anno === undefined || raw.anno === '' ? null : Number(raw.anno),
        image: raw.image != null ? String(raw.image) : null,
      };
    }
    const colors = [hexP || hexS, hexS || hexP];
    const colorKeys = [nearestColorKey(colors[0]), nearestColorKey(colors[1])];
    return {
      id: Number(raw.id),
      handle: String(raw.handle || ''),
      url: String(raw.url || ''),
      title: String(raw.title || ''),
      artist: String(raw.artist || ''),
      quartiere: String(raw.quartiere || ''),
      hex_primary: hexP,
      hex_secondary: hexS,
      colors,
      colorKeys,
      price: Number(raw.price) || 0,
      published_at: Number(raw.published_at) || 0,
      anno: raw.anno === null || raw.anno === undefined || raw.anno === '' ? null : Number(raw.anno),
      image: raw.image != null ? String(raw.image) : null,
    };
  }

  /** Pallini sulla card: usa hex primario/secondario; se mancanti, classe vuota. */
  function cardColorDotsHtml(p) {
    const h0 = String(p.hex_primary || '').trim();
    const h1 = String(p.hex_secondary || '').trim();
    const dot = (hex, title) => {
      const h = String(hex || '').trim();
      const emptyCls = h ? '' : ' torineser-sbc__card-color-dot--empty';
      const style = h ? ` style="background:${h}"` : '';
      return `<span class="torineser-sbc__card-color-dot${emptyCls}"${style} title="${title}"></span>`;
    };
    return dot(h0, 'Primario') + dot(h1, 'Secondario');
  }

  async function loadAllPages(collectionUrl, view, totalPages, initial) {
    const merged = [...initial];
    const max = Math.min(totalPages || 1, 500);
    for (let page = 2; page <= max; page++) {
      try {
        const url = new URL(collectionUrl, window.location.origin);
        url.searchParams.set('view', view);
        url.searchParams.set('page', String(page));
        const res = await fetch(url.toString(), { credentials: 'same-origin' });
        const chunk = JSON.parse(await res.text());
        if (!Array.isArray(chunk) || chunk.length === 0) break;
        merged.push(...chunk);
        if (chunk.length < 50) break;
      } catch {
        break;
      }
    }
    return merged;
  }

  const cardHtmlCache = new Map();

  async function fetchProductCardOuterHtml(productUrl) {
    if (cardHtmlCache.has(productUrl)) return cardHtmlCache.get(productUrl);
    const u = new URL(productUrl, window.location.origin);
    u.searchParams.set('section_id', 'section-rendering-product-card');
    const res = await fetch(u.toString(), { credentials: 'same-origin' });
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const card = doc.querySelector('product-card');
    const html = card ? card.outerHTML : '';
    cardHtmlCache.set(productUrl, html);
    return html;
  }

  /**
   * @param {HTMLElement} root
   */
  function init(root) {
    if (root.dataset.torineserSbcInit === '1') return;
    root.dataset.torineserSbcInit = '1';

    const collectionUrl = root.dataset.collectionUrl || '';
    const view = root.dataset.jsonView || 'torineser-shop-color-data';
    const totalPages = parseInt(root.dataset.totalPages || '1', 10) || 1;

    const jsonEl = root.querySelector('[data-torineser-sbc-json]');
    let rawList = [];
    try {
      rawList = jsonEl && jsonEl.textContent ? JSON.parse(jsonEl.textContent.trim()) : [];
    } catch {
      rawList = [];
    }
    if (!Array.isArray(rawList)) rawList = [];

    const grid = root.querySelector('[data-sbc-grid]');
    const bank = root.querySelector('[data-sbc-bank]');
    const countLabel = root.querySelector('[data-sbc-count]');
    const activeWrap = root.querySelector('[data-sbc-active-filters]');
    const sortSelect = root.querySelector('[data-sbc-sort]');
    const swPrimary = root.querySelector('[data-sbc-swatches="primary"]');
    const swSecondary = root.querySelector('[data-sbc-swatches="secondary"]');
    const yearBar = root.querySelector('[data-sbc-years]');
    const artistSel = root.querySelector('[data-sbc-artist]');
    const quartiereSel = root.querySelector('[data-sbc-quartiere]');
    const resetBtn = root.querySelector('[data-sbc-reset]');
    const roleToggle = root.querySelector('[data-sbc-role-toggle]');

    if (!grid || !bank) return;

    const state = {
      primary: new Set(),
      secondary: new Set(),
      year: new Set(),
      artist: 'all',
      quartiere: 'all',
      sort: 'newest',
    };

    /** @type {ReturnType<typeof normalizeProduct>[]} */
    let products = [];

    function matches(c) {
      const okP = state.primary.size === 0 || state.primary.has(c.colorKeys[0]);
      const okS = state.secondary.size === 0 || state.secondary.has(c.colorKeys[1]);
      const okY =
        state.year.size === 0 || (c.anno != null && !Number.isNaN(c.anno) && state.year.has(String(c.anno)));
      const okA = state.artist === 'all' || c.artist === state.artist;
      const okQ = state.quartiere === 'all' || c.quartiere === state.quartiere;
      return okP && okS && okY && okA && okQ;
    }

    function sortVisible(list) {
      const sorted = [...list];
      sorted.sort((a, b) => {
        if (state.sort === 'title') return a.title.localeCompare(b.title, 'it');
        const ya = a.anno != null ? a.anno : 0;
        const yb = b.anno != null ? b.anno : 0;
        if (state.sort === 'oldest') {
          if (ya !== yb) return ya - yb;
          return a.published_at - b.published_at || a.id - b.id;
        }
        if (yb !== ya) return yb - ya;
        return b.published_at - a.published_at || b.id - a.id;
      });
      return sorted;
    }

    function buildSwatches(container, role) {
      if (!container) return;
      container.innerHTML = '';
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'torineser-sbc__swatch torineser-sbc__swatch--clear torineser-sbc__swatch--active';
      clearBtn.dataset.value = 'all';
      clearBtn.dataset.role = role;
      clearBtn.innerHTML = '<span>×</span><span class="torineser-sbc__swatch-name">Qualsiasi</span>';
      container.appendChild(clearBtn);
      COLOR_PALETTE.forEach((c) => {
        const s = document.createElement('button');
        s.type = 'button';
        s.className = 'torineser-sbc__swatch';
        s.dataset.value = c.key;
        s.dataset.role = role;
        s.style.background = c.hex;
        s.innerHTML = `<span class="torineser-sbc__swatch-name">${c.name}</span>`;
        container.appendChild(s);
      });
    }

    function syncSwatches(role) {
      const wrap = role === 'primary' ? swPrimary : swSecondary;
      if (!wrap) return;
      const set = role === 'primary' ? state.primary : state.secondary;
      wrap.querySelectorAll('.torineser-sbc__swatch').forEach((s) => {
        const btn = /** @type {HTMLButtonElement} */ (s);
        const v = btn.dataset.value;
        if (v === 'all') btn.classList.toggle('torineser-sbc__swatch--active', set.size === 0);
        else btn.classList.toggle('torineser-sbc__swatch--active', set.has(v));
      });
    }

    function toggleSet(set, v) {
      if (v === 'all') {
        set.clear();
        return;
      }
      if (set.has(v)) set.delete(v);
      else set.add(v);
    }

    function wireSwatches(wrap, role) {
      if (!wrap) return;
      wrap.addEventListener('click', (e) => {
        const sw = /** @type {HTMLElement} */ (e.target).closest('.torineser-sbc__swatch');
        if (!sw || !(sw instanceof HTMLButtonElement)) return;
        const r = /** @type {'primary'|'secondary'} */ (sw.dataset.role || role);
        toggleSet(r === 'primary' ? state.primary : state.secondary, sw.dataset.value || 'all');
        syncSwatches('primary');
        syncSwatches('secondary');
        void apply();
      });
    }

    function buildYears() {
      if (!yearBar) return;
      yearBar.innerHTML = '';
      const counts = {};
      products.forEach((c) => {
        if (c.anno == null || Number.isNaN(c.anno)) return;
        const y = String(c.anno);
        counts[y] = (counts[y] || 0) + 1;
      });
      const allChip = document.createElement('button');
      allChip.type = 'button';
      allChip.className = 'torineser-sbc__chip torineser-sbc__chip--active';
      allChip.dataset.value = 'all';
      allChip.textContent = 'Tutti';
      yearBar.appendChild(allChip);
      Object.keys(counts)
        .sort()
        .forEach((y) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'torineser-sbc__chip';
          b.dataset.value = y;
          b.innerHTML = `${y} <span class="torineser-sbc__chip-count">${counts[y]}</span>`;
          yearBar.appendChild(b);
        });
    }

    function buildArtistOptions() {
      if (!artistSel) return;
      const counts = {};
      products.forEach((c) => {
        if (!c.artist) return;
        counts[c.artist] = (counts[c.artist] || 0) + 1;
      });
      artistSel.innerHTML = '<option value="all">Tutti gli artisti</option>';
      Object.keys(counts)
        .sort((a, b) => a.localeCompare(b, 'it'))
        .forEach((a) => {
          const o = document.createElement('option');
          o.value = a;
          o.textContent = `${a} · ${counts[a]}`;
          artistSel.appendChild(o);
        });
    }

    function buildQuartiereOptions() {
      if (!quartiereSel) return;
      const counts = {};
      products.forEach((c) => {
        if (!c.quartiere) return;
        counts[c.quartiere] = (counts[c.quartiere] || 0) + 1;
      });
      quartiereSel.innerHTML = '<option value="all">Tutta Torino</option>';
      Object.keys(counts)
        .sort((a, b) => a.localeCompare(b, 'it'))
        .forEach((q) => {
          const o = document.createElement('option');
          o.value = q;
          o.textContent = `${q} · ${counts[q]}`;
          quartiereSel.appendChild(o);
        });
    }

    function renderActiveFilters() {
      if (!activeWrap) return;
      activeWrap.innerHTML = '';
      /** @type {{ dot?: string, label: string, remove: () => void }[]} */
      const pills = [];
      state.primary.forEach((k) => {
        pills.push({
          dot: COLOR_KEY_MAP[k]?.hex,
          label: COLOR_KEY_MAP[k]?.name || k,
          remove: () => {
            state.primary.delete(k);
            syncSwatches('primary');
          },
        });
      });
      state.secondary.forEach((k) => {
        pills.push({
          dot: COLOR_KEY_MAP[k]?.hex,
          label: '+ ' + (COLOR_KEY_MAP[k]?.name || k),
          remove: () => {
            state.secondary.delete(k);
            syncSwatches('secondary');
          },
        });
      });
      state.year.forEach((y) => {
        pills.push({
          label: y,
          remove: () => {
            state.year.delete(y);
            yearBar?.querySelectorAll('.torineser-sbc__chip').forEach((b) => {
              const btn = /** @type {HTMLButtonElement} */ (b);
              const v = btn.dataset.value;
              if (v === 'all') btn.classList.toggle('torineser-sbc__chip--active', state.year.size === 0);
              else btn.classList.toggle('torineser-sbc__chip--active', state.year.has(v));
            });
          },
        });
      });
      if (state.artist !== 'all') {
        pills.push({
          label: state.artist,
          remove: () => {
            state.artist = 'all';
            if (artistSel) artistSel.value = 'all';
          },
        });
      }
      if (state.quartiere !== 'all') {
        pills.push({
          label: state.quartiere,
          remove: () => {
            state.quartiere = 'all';
            if (quartiereSel) quartiereSel.value = 'all';
          },
        });
      }

      pills.forEach((p) => {
        const pill = document.createElement('span');
        pill.className = 'torineser-sbc__active-pill';
        if (p.dot) {
          const dot = document.createElement('span');
          dot.className = 'torineser-sbc__pill-dot';
          dot.style.background = p.dot;
          pill.appendChild(dot);
        }
        const labelSpan = document.createElement('span');
        labelSpan.className = 'torineser-sbc__pill-label';
        labelSpan.textContent = p.label;
        pill.appendChild(labelSpan);
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'torineser-sbc__pill-remove';
        rm.setAttribute('aria-label', 'Rimuovi');
        rm.textContent = '×';
        rm.addEventListener('click', () => {
          p.remove();
          void apply();
        });
        pill.appendChild(rm);
        activeWrap.appendChild(pill);
      });
    }

    async function apply() {
      const visible = products.filter(matches);
      const sorted = sortVisible(visible);

      if (countLabel) {
        countLabel.innerHTML =
          sorted.length === products.length
            ? `<strong>${products.length}</strong> copertine <em>disponibili</em>`
            : `<strong>${sorted.length}</strong> di ${products.length} copertine`;
      }

      renderActiveFilters();

      grid.innerHTML = '';

      if (sorted.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'torineser-sbc__grid-empty';
        emptyLi.style.gridColumn = '1 / -1';
        emptyLi.innerHTML =
          '<h3 class="torineser-sbc__empty-title">Nessuna copertina con questi filtri</h3><p class="torineser-sbc__empty-text">Prova ad allargare la selezione o azzera i filtri.</p>';
        grid.appendChild(emptyLi);
        return;
      }

      for (const p of sorted) {
        const li = document.createElement('li');
        li.className = 'product-grid__item torineser-sbc__grid-item';
        li.dataset.productId = String(p.id);

        const cell = document.createElement('div');
        cell.className = 'torineser-sbc__cell-wrap';

        const tpl = bank.querySelector(`[data-sbc-template][data-product-id="${p.id}"]`);
        if (tpl) {
          const inner = tpl.querySelector('.torineser-sbc__card-slot');
          if (inner) {
            const slot = /** @type {HTMLElement} */ (inner.cloneNode(true));
            slot.hidden = false;
            slot.classList.add('torineser-sbc__card-slot--live');
            cell.appendChild(slot);
            const dots = document.createElement('div');
            dots.className = 'torineser-sbc__card-colors';
            dots.innerHTML = cardColorDotsHtml(p);
            cell.appendChild(dots);
            li.appendChild(cell);
            grid.appendChild(li);
            continue;
          }
        }

        li.classList.add('torineser-sbc__grid-item--loading');
        cell.innerHTML = '<div class="torineser-sbc__card-skeleton"></div>';
        li.appendChild(cell);
        grid.appendChild(li);
        const html = await fetchProductCardOuterHtml(p.url);
        li.classList.remove('torineser-sbc__grid-item--loading');
        cell.innerHTML = '';
        if (html) {
          const wrap = document.createElement('div');
          wrap.className = 'torineser-sbc__card-slot torineser-sbc__card-slot--live';
          wrap.innerHTML = html;
          cell.appendChild(wrap);
        } else {
          const fb = document.createElement('a');
          fb.className = 'torineser-sbc__fallback';
          fb.href = p.url;
          const t = document.createElement('span');
          t.className = 'torineser-sbc__fallback-title';
          t.textContent = p.title;
          fb.appendChild(t);
          cell.appendChild(fb);
        }
        const dots = document.createElement('div');
        dots.className = 'torineser-sbc__card-colors';
        dots.innerHTML = cardColorDotsHtml(p);
        cell.appendChild(dots);
      }
    }

    buildSwatches(swPrimary, 'primary');
    buildSwatches(swSecondary, 'secondary');
    wireSwatches(swPrimary, 'primary');
    wireSwatches(swSecondary, 'secondary');

    /** Come il mock HTML: display none/'' oltre a [hidden], così non restano visibili due file di swatch. */
    function setColorSwatchPanel(role) {
      const showPrimary = role === 'primary';
      if (swPrimary) {
        swPrimary.style.display = showPrimary ? '' : 'none';
        swPrimary.toggleAttribute('hidden', !showPrimary);
        swPrimary.setAttribute('aria-hidden', showPrimary ? 'false' : 'true');
      }
      if (swSecondary) {
        swSecondary.style.display = showPrimary ? 'none' : '';
        swSecondary.toggleAttribute('hidden', showPrimary);
        swSecondary.setAttribute('aria-hidden', showPrimary ? 'true' : 'false');
      }
    }

    setColorSwatchPanel('primary');
    if (roleToggle) {
      roleToggle.querySelectorAll('button[data-sbc-color-role]').forEach((btn) => {
        btn.addEventListener('click', () => {
          roleToggle.querySelectorAll('button[data-sbc-color-role]').forEach((b) => b.classList.remove('torineser-sbc__role-btn--active'));
          btn.classList.add('torineser-sbc__role-btn--active');
          const role = /** @type {'primary'|'secondary'} */ (btn.dataset.sbcColorRole === 'secondary' ? 'secondary' : 'primary');
          setColorSwatchPanel(role);
        });
      });
    }

    if (yearBar) {
      yearBar.addEventListener('click', (e) => {
        const c = /** @type {HTMLElement} */ (e.target).closest('.torineser-sbc__chip');
        if (!c || !(c instanceof HTMLButtonElement)) return;
        toggleSet(state.year, c.dataset.value || 'all');
        yearBar.querySelectorAll('.torineser-sbc__chip').forEach((b) => {
          const btn = /** @type {HTMLButtonElement} */ (b);
          const v = btn.dataset.value;
          if (v === 'all') btn.classList.toggle('torineser-sbc__chip--active', state.year.size === 0);
          else btn.classList.toggle('torineser-sbc__chip--active', state.year.has(v));
        });
        void apply();
      });
    }

    if (artistSel) artistSel.addEventListener('change', () => {
      state.artist = artistSel.value;
      void apply();
    });
    if (quartiereSel) quartiereSel.addEventListener('change', () => {
      state.quartiere = quartiereSel.value;
      void apply();
    });
    if (sortSelect) sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      void apply();
    });
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.primary.clear();
        state.secondary.clear();
        state.year.clear();
        state.artist = 'all';
        state.quartiere = 'all';
        syncSwatches('primary');
        syncSwatches('secondary');
        yearBar?.querySelectorAll('.torineser-sbc__chip').forEach((b) => {
          const btn = /** @type {HTMLButtonElement} */ (b);
          btn.classList.toggle('torineser-sbc__chip--active', btn.dataset.value === 'all');
        });
        if (artistSel) artistSel.value = 'all';
        if (quartiereSel) quartiereSel.value = 'all';
        roleToggle?.querySelectorAll('button[data-sbc-color-role]').forEach((b) => {
          const el = /** @type {HTMLButtonElement} */ (b);
          el.classList.toggle('torineser-sbc__role-btn--active', el.dataset.sbcColorRole === 'primary');
        });
        setColorSwatchPanel('primary');
        void apply();
      });
    }

    loadAllPages(collectionUrl, view, totalPages, rawList).then((merged) => {
      products = [];
      const seen = new Set();
      merged.forEach((raw) => {
        const n = normalizeProduct(raw);
        if (!n) return;
        if (seen.has(n.id)) return;
        seen.add(n.id);
        products.push(n);
      });
      buildYears();
      buildArtistOptions();
      buildQuartiereOptions();
      void apply();
    });
  }

  function boot() {
    document.querySelectorAll('[data-torineser-shop-by-color]').forEach((el) => {
      if (el instanceof HTMLElement) init(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
