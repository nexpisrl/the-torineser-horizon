/**
 * Shop by Color: filtri colore da metaobject (taxonomy + handle + hex serializzati dal tema) + artista + anno + quartiere.
 * I pallini filtro mostrano solo i colori effettivamente presenti nei metafield dei prodotti caricati.
 */
(function () {
  'use strict';

  /** Section Rendering: stessa card della bank (non section-rendering-product-card). */
  const SBC_FETCH_SECTION_ID = 'torineser-shop-color-card';

  const UNKNOWN_COLOR_KEY = '__unknown__';

  /**
   * Chiave filtro: nome taxonomy → handle metaobject (`mo:`) → bucket da hex (`hex:`).
   * @param {string} taxonomyLabel
   * @param {string} moHandle system.handle del metaobject colore
   * @param {string} hexSlot come colors[idx]
   */
  function colorFilterKey(taxonomyLabel, moHandle, hexSlot) {
    const t = String(taxonomyLabel || '').trim();
    if (t) return t;
    const h = String(moHandle || '').trim();
    if (h) return `mo:${h}`;
    const x = String(hexSlot || '')
      .replace('#', '')
      .trim();
    if (x.length >= 6) return `hex:${x.slice(0, 6).toLowerCase()}`;
    return UNKNOWN_COLOR_KEY;
  }

  /** Testo UI (swatch / pill): taxonomy, altrimenti handle leggibile.
   * @param {string} taxonomyLabel
   * @param {string} moHandle
   */
  function colorUiName(taxonomyLabel, moHandle) {
    const t = String(taxonomyLabel || '').trim();
    if (t) return t;
    const h = String(moHandle || '').trim();
    if (h) return h.replace(/-/g, ' ');
    return '';
  }

  /** @param {Record<string, unknown>} raw */
  function normalizeProduct(raw) {
    const hexP = String(raw.hex_primary || '').trim();
    const hexS = String(raw.hex_secondary || '').trim();
    const labelP = String(raw.label_primary ?? raw.labelPrimary ?? '').trim();
    const labelS = String(raw.label_secondary ?? raw.labelSecondary ?? '').trim();
    const hdlP = String(raw.mo_handle_primary ?? raw.moHandlePrimary ?? '').trim();
    const hdlS = String(raw.mo_handle_secondary ?? raw.moHandleSecondary ?? '').trim();
    if (!hexP && !hexS && !labelP && !labelS && !hdlP && !hdlS) {
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
        colorUiPrimary: '',
        colorUiSecondary: '',
        price: Number(raw.price) || 0,
        published_at: Number(raw.published_at) || 0,
        anno: raw.anno === null || raw.anno === undefined || raw.anno === '' ? null : Number(raw.anno),
        image: raw.image != null ? String(raw.image) : null,
      };
    }
    const colors = [hexP || hexS, hexS || hexP];
    const colorKeys = [
      colorFilterKey(labelP, hdlP, colors[0] ?? ''),
      colorFilterKey(labelS, hdlS, colors[1] ?? ''),
    ];
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
      colorUiPrimary: colorUiName(labelP, hdlP),
      colorUiSecondary: colorUiName(labelS, hdlS),
      price: Number(raw.price) || 0,
      published_at: Number(raw.published_at) || 0,
      anno: raw.anno === null || raw.anno === undefined || raw.anno === '' ? null : Number(raw.anno),
      image: raw.image != null ? String(raw.image) : null,
    };
  }

  /**
   * Colori filtro: solo chiavi (e hex) davvero usati nei metafield primario/secondario del catalogo caricato.
   * @param {ReturnType<typeof normalizeProduct>[]} list
   * @param {'primary'|'secondary'} role
   * @returns {{ key: string, hex: string, name: string }[]}
   */
  function swatchEntriesForRole(list, role) {
    const idx = role === 'primary' ? 0 : 1;
    /** @type {Map<string, { key: string, hex: string, name: string }>} */
    const byKey = new Map();
    for (const p of list) {
      const key = p.colorKeys[idx];
      if (!key || key === UNKNOWN_COLOR_KEY) continue;
      const hexField = role === 'primary' ? p.hex_primary : p.hex_secondary;
      const hex = String(hexField || '').trim() || String(p.colors[idx] || '').trim();
      if (!hex) continue;
      if (!byKey.has(key)) {
        const ui = role === 'primary' ? p.colorUiPrimary : p.colorUiSecondary;
        const prettyKey = key.startsWith('hex:')
          ? `#${key.slice(4)}`
          : key.startsWith('mo:')
            ? key
                .slice(3)
                .replace(/-/g, ' ')
            : key;
        byKey.set(key, {
          key,
          hex,
          name: ui || prettyKey,
        });
      }
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }

  /** Pallini sulla card: usa hex primario/secondario; se mancanti, classe vuota. */
  /** @param {ReturnType<typeof normalizeProduct>} p */
  function cardColorDotsHtml(p) {
    const h0 = String(p.hex_primary || '').trim();
    const h1 = String(p.hex_secondary || '').trim();
    /** @param {string} hex @param {string} title */
    const dot = (hex, title) => {
      const h = String(hex || '').trim();
      const emptyCls = h ? '' : ' torineser-sbc__card-color-dot--empty';
      const style = h ? ` style="background:${h}"` : '';
      return `<span class="torineser-sbc__card-color-dot${emptyCls}"${style} title="${title}"></span>`;
    };
    return dot(h0, 'Primario') + dot(h1, 'Secondario');
  }

  /**
   * @param {string} collectionUrl
   * @param {string} view
   * @param {number} totalPages
   * @param {unknown[]} initial
   * @param {number} pageSize stesso valore del paginate Liquid (bank + collection view JSON)
   */
  async function loadAllPages(collectionUrl, view, totalPages, initial, pageSize) {
    const merged = [...initial];
    const max = Math.min(totalPages || 1, 500);
    const size = pageSize > 0 ? pageSize : 50;
    for (let page = 2; page <= max; page++) {
      try {
        const url = new URL(collectionUrl, window.location.origin);
        url.searchParams.set('view', view);
        url.searchParams.set('page', String(page));
        const res = await fetch(url.toString(), { credentials: 'same-origin' });
        if (!res.ok) break;
        const chunk = JSON.parse(await res.text());
        if (!Array.isArray(chunk) || chunk.length === 0) break;
        merged.push(...chunk);
        if (chunk.length < size) break;
      } catch {
        break;
      }
    }
    return merged;
  }

  /** Cache solo HTML valido: mai memorizzare stringa vuota (evita fallback “permanente” dopo un errore transitorio). */
  /** @type {Map<string, string>} */
  const cardHtmlCache = new Map();

  /** @param {string} productUrl */
  async function fetchProductCardOuterHtml(productUrl) {
    const cached = cardHtmlCache.get(productUrl);
    if (cached !== undefined) return cached;
    const u = new URL(productUrl, window.location.origin);
    u.searchParams.set('section_id', SBC_FETCH_SECTION_ID);
    let res;
    try {
      res = await fetch(u.toString(), { credentials: 'same-origin' });
    } catch {
      return '';
    }
    if (!res.ok) return '';
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const card = doc.querySelector('product-card');
    const html = card ? card.outerHTML : '';
    if (html) cardHtmlCache.set(productUrl, html);
    return html;
  }

  /**
   * Dopo un fetch riuscito, aggiunge uno slot nascosto alla bank così filtri/ordinamenti successivi clonano come i prodotti della prima pagina.
   * @param {HTMLElement} bankEl
   * @param {ReturnType<typeof normalizeProduct>} p
   * @param {string} html outerHTML di product-card
   */
  function appendFetchedCardToBank(bankEl, p, html) {
    if (!html || bankEl.querySelector(`[data-sbc-template][data-product-id="${p.id}"]`)) return;
    const tpl = document.createElement('div');
    tpl.setAttribute('data-sbc-template', '');
    tpl.dataset.productId = String(p.id);
    tpl.setAttribute('data-product-url', p.url);
    const slot = document.createElement('div');
    slot.className = 'torineser-sbc__card-slot';
    slot.hidden = true;
    slot.innerHTML = html;
    tpl.appendChild(slot);
    bankEl.appendChild(tpl);
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
    const pageSize = parseInt(root.dataset.sbcPageSize || '50', 10) || 50;

    const jsonEl = root.querySelector('[data-torineser-sbc-json]');
    let rawList = [];
    try {
      rawList = jsonEl && jsonEl.textContent ? JSON.parse(jsonEl.textContent.trim()) : [];
    } catch {
      rawList = [];
    }
    if (!Array.isArray(rawList)) rawList = [];

    const gridEl = root.querySelector('[data-sbc-grid]');
    const bankEl = root.querySelector('[data-sbc-bank]');
    const countLabel = root.querySelector('[data-sbc-count]');
    const activeWrap = root.querySelector('[data-sbc-active-filters]');
    const sortSelect = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-sbc-sort]'));
    const swPrimary = /** @type {HTMLElement | null} */ (root.querySelector('[data-sbc-swatches="primary"]'));
    const swSecondary = /** @type {HTMLElement | null} */ (root.querySelector('[data-sbc-swatches="secondary"]'));
    const yearBar = /** @type {HTMLElement | null} */ (root.querySelector('[data-sbc-years]'));
    const artistSel = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-sbc-artist]'));
    const quartiereSel = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-sbc-quartiere]'));
    const resetBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-sbc-reset]'));
    const roleToggle = /** @type {HTMLElement | null} */ (root.querySelector('[data-sbc-role-toggle]'));
    const sheetBackdrop = root.querySelector('[data-sbc-sheet-backdrop]');
    const filterFab = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-sbc-filter-fab]'));
    const fabCount = root.querySelector('[data-sbc-fab-count]');

    function closeSbcSheet() {
      root.classList.remove('torineser-sbc--sheet-open');
      if (filterFab) filterFab.setAttribute('aria-expanded', 'false');
    }

    function openSbcSheet() {
      root.classList.add('torineser-sbc--sheet-open');
      if (filterFab) filterFab.setAttribute('aria-expanded', 'true');
    }

    if (filterFab) {
      filterFab.addEventListener('click', () => openSbcSheet());
    }
    if (sheetBackdrop) {
      sheetBackdrop.addEventListener('click', () => closeSbcSheet());
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!root.classList.contains('torineser-sbc--sheet-open')) return;
      closeSbcSheet();
    });

    if (!(gridEl instanceof HTMLElement) || !(bankEl instanceof HTMLElement)) return;

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

    /** @param {ReturnType<typeof normalizeProduct>} c */
    function matches(c) {
      const okP = state.primary.size === 0 || state.primary.has(c.colorKeys[0]);
      const okS = state.secondary.size === 0 || state.secondary.has(c.colorKeys[1]);
      const okY =
        state.year.size === 0 || (c.anno != null && !Number.isNaN(c.anno) && state.year.has(String(c.anno)));
      const okA = state.artist === 'all' || c.artist === state.artist;
      const okQ = state.quartiere === 'all' || c.quartiere === state.quartiere;
      return okP && okS && okY && okA && okQ;
    }

    /** @param {ReturnType<typeof normalizeProduct>[]} list */
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

    /** @param {HTMLElement | null} container @param {'primary'|'secondary'} role @param {{ key: string, hex: string, name: string }[]} entries */
    function buildSwatches(container, role, entries) {
      if (!container) return;
      container.innerHTML = '';
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'torineser-sbc__swatch torineser-sbc__swatch--clear torineser-sbc__swatch--active';
      clearBtn.dataset.value = 'all';
      clearBtn.dataset.role = role;
      clearBtn.innerHTML = '<span>×</span><span class="torineser-sbc__swatch-name">Qualsiasi</span>';
      container.appendChild(clearBtn);
      entries.forEach((c) => {
        const s = document.createElement('button');
        s.type = 'button';
        s.className = 'torineser-sbc__swatch';
        s.dataset.value = c.key;
        s.dataset.role = role;
        s.style.background = c.hex;
        const nm = document.createElement('span');
        nm.className = 'torineser-sbc__swatch-name';
        nm.textContent = c.name;
        s.appendChild(nm);
        container.appendChild(s);
      });
    }

    /** @param {'primary'|'secondary'} role */
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

    /** @param {Set<string>} set @param {string} v */
    function toggleSet(set, v) {
      if (v === 'all') {
        set.clear();
        return;
      }
      if (set.has(v)) set.delete(v);
      else set.add(v);
    }

    /** @param {HTMLElement | null} wrap @param {'primary'|'secondary'} role */
    function wireSwatches(wrap, role) {
      if (!wrap) return;
      wrap.addEventListener('click', (/** @type {MouseEvent} */ e) => {
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
      /** @type {Record<string, number>} */
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
      /** @type {Record<string, number>} */
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
      /** @type {Record<string, number>} */
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

    /** @param {string} k @param {'primary'|'secondary'} role */
    function hexForActivePill(k, role) {
      const idx = role === 'primary' ? 0 : 1;
      const hit = products.find((p) => p.colorKeys[idx] === k);
      if (!hit) return undefined;
      const raw = role === 'primary' ? hit.hex_primary : hit.hex_secondary;
      const h = String(raw || '').trim();
      return h || undefined;
    }

    /** @param {string} k @param {'primary'|'secondary'} role */
    function uiLabelForFilterKey(k, role) {
      if (!k || k === UNKNOWN_COLOR_KEY) return k;
      const idx = role === 'primary' ? 0 : 1;
      const hit = products.find((p) => p.colorKeys[idx] === k);
      if (!hit) return k.startsWith('hex:') ? `#${k.slice(4)}` : k.replace(/^mo:/, '');
      const ui = role === 'primary' ? hit.colorUiPrimary : hit.colorUiSecondary;
      if (ui) return ui;
      if (k.startsWith('hex:')) return `#${k.slice(4)}`;
      return k.replace(/^mo:/, '');
    }

    function renderActiveFilters() {
      if (!activeWrap) return;
      activeWrap.innerHTML = '';
      /** @type {{ dot?: string, label: string, remove: () => void }[]} */
      const pills = [];
      state.primary.forEach((k) => {
        pills.push({
          dot: hexForActivePill(k, 'primary'),
          label: uiLabelForFilterKey(k, 'primary'),
          remove: () => {
            state.primary.delete(k);
            syncSwatches('primary');
          },
        });
      });
      state.secondary.forEach((k) => {
        pills.push({
          dot: hexForActivePill(k, 'secondary'),
          label: '+ ' + uiLabelForFilterKey(k, 'secondary'),
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
      if (!(gridEl instanceof HTMLElement) || !(bankEl instanceof HTMLElement)) return;

      const visible = products.filter(matches);
      const sorted = sortVisible(visible);

      if (countLabel) {
        countLabel.innerHTML =
          sorted.length === products.length
            ? `<strong>${products.length}</strong> copertine <em>disponibili</em>`
            : `<strong>${sorted.length}</strong> di ${products.length} copertine`;
      }

      if (fabCount) {
        const secondaryActive =
          state.year.size > 0 || state.artist !== 'all' || state.quartiere !== 'all';
        if (products.length === 0) {
          fabCount.textContent = '0';
          fabCount.classList.add('torineser-sbc__fab-badge--muted');
        } else if (!secondaryActive) {
          fabCount.textContent = String(products.length);
          fabCount.classList.add('torineser-sbc__fab-badge--muted');
        } else {
          fabCount.textContent = `${sorted.length}/${products.length}`;
          fabCount.classList.remove('torineser-sbc__fab-badge--muted');
        }
      }

      renderActiveFilters();

      gridEl.innerHTML = '';

      if (sorted.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'torineser-sbc__grid-empty';
        emptyLi.style.gridColumn = '1 / -1';
        emptyLi.innerHTML =
          '<h3 class="torineser-sbc__empty-title">Nessuna copertina con questi filtri</h3><p class="torineser-sbc__empty-text">Prova ad allargare la selezione o azzera i filtri.</p>';
        gridEl.appendChild(emptyLi);
        return;
      }

      for (const p of sorted) {
        const li = document.createElement('li');
        li.className = 'product-grid__item torineser-sbc__grid-item';
        li.dataset.productId = String(p.id);

        const cell = document.createElement('div');
        cell.className = 'torineser-sbc__cell-wrap';

        const tpl = bankEl.querySelector(`[data-sbc-template][data-product-id="${p.id}"]`);
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
            gridEl.appendChild(li);
            continue;
          }
        }

        li.classList.add('torineser-sbc__grid-item--loading');
        cell.innerHTML = '<div class="torineser-sbc__card-skeleton"></div>';
        li.appendChild(cell);
        gridEl.appendChild(li);
        const html = await fetchProductCardOuterHtml(p.url);
        li.classList.remove('torineser-sbc__grid-item--loading');
        cell.innerHTML = '';
        if (html) {
          appendFetchedCardToBank(bankEl, p, html);
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

    wireSwatches(swPrimary, 'primary');
    wireSwatches(swSecondary, 'secondary');

    /** Come il mock HTML: display none/'' oltre a [hidden], così non restano visibili due file di swatch. */
    /** @param {'primary'|'secondary'} role */
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
      roleToggle.querySelectorAll('button[data-sbc-color-role]').forEach((btnEl) => {
        const btn = /** @type {HTMLButtonElement} */ (btnEl);
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

    loadAllPages(collectionUrl, view, totalPages, rawList, pageSize).then((merged) => {
      products = [];
      const seen = new Set();
      merged.forEach((raw) => {
        const n = normalizeProduct(/** @type {Record<string, unknown>} */ (raw));
        if (seen.has(n.id)) return;
        seen.add(n.id);
        products.push(n);
      });
      buildSwatches(swPrimary, 'primary', swatchEntriesForRole(products, 'primary'));
      buildSwatches(swSecondary, 'secondary', swatchEntriesForRole(products, 'secondary'));
      syncSwatches('primary');
      syncSwatches('secondary');
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
