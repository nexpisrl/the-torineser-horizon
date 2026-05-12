/**
 * Mappa copertine Torineser: Leaflet, filtro quartieri, pannello dettaglio.
 * Dipende da Leaflet caricato prima di questo script.
 */
(function () {
  'use strict';

  /** @param {string} raw */
  function parseCoords(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const m = raw.match(/@?\s*(-?\d+\.?\d*)\s*,\s*@?\s*(-?\d+\.?\d*)/);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  }

  /** @param {Record<string, unknown>} p */
  function normalizeProduct(p) {
    const coords = parseCoords(String(p.coords_raw || ''));
    if (!coords) return null;
    const edition = p.edition != null && String(p.edition).trim() !== '' ? String(p.edition).trim() : '';
    return {
      id: Number(p.id),
      title: String(p.title || ''),
      url: String(p.url || ''),
      quartiere: String(p.quartiere || ''),
      coords,
      vendor: String(p.vendor || ''),
      description: String(p.description || ''),
      location_label: String(p.location_label || p.quartiere || ''),
      edition,
      image: p.image != null ? String(p.image) : null,
    };
  }

  function countBy(arr, key) {
    const out = {};
    arr.forEach((c) => {
      const v = c[key];
      out[v] = (out[v] || 0) + 1;
    });
    return out;
  }

  /**
   * @param {string} collectionUrl path tipo /collections/all
   * @param {string} view
   * @param {number} totalPages
   * @param {unknown[]} initial
   */
  async function loadAllPages(collectionUrl, view, totalPages, initial) {
    const merged = [...initial];
    const max = Math.min(totalPages || 1, 500);
    for (let page = 2; page <= max; page++) {
      try {
        const url = new URL(collectionUrl, window.location.origin);
        url.searchParams.set('view', view);
        url.searchParams.set('page', String(page));
        const res = await fetch(url.toString(), { credentials: 'same-origin' });
        const text = await res.text();
        const chunk = JSON.parse(text);
        if (!Array.isArray(chunk) || chunk.length === 0) break;
        merged.push(...chunk);
        if (chunk.length < 50) break;
      } catch {
        break;
      }
    }
    return merged;
  }

  /**
   * @param {HTMLElement} root
   */
  function init(root) {
    if (root.dataset.torineserMapInit === '1') return;
    root.dataset.torineserMapInit = '1';

    const collectionUrl = root.dataset.collectionUrl || '';
    const view = root.dataset.jsonView || 'torineser-map-data';
    const totalPages = parseInt(root.dataset.totalPages || '1', 10) || 1;
    const initialZoom = parseInt(root.dataset.initialZoom || '14', 10) || 14;
    const mapCenterLat = parseFloat(root.dataset.centerLat || '45.0703');
    const mapCenterLng = parseFloat(root.dataset.centerLng || '7.6869');

    const jsonEl = root.querySelector('[data-torineser-map-json]');
    let rawList = [];
    try {
      rawList = jsonEl && jsonEl.textContent ? JSON.parse(jsonEl.textContent.trim()) : [];
    } catch {
      rawList = [];
    }
    if (!Array.isArray(rawList)) rawList = [];

    const mapEl = root.querySelector('[data-torineser-map-canvas]');
    const filterQuartieriEl = root.querySelector('[data-filter-quartieri]');
    const countLabel = root.querySelector('[data-count-label]');
    const fabCount = root.querySelector('[data-fab-count]');
    const panel = root.querySelector('[data-detail-panel]');
    const panelContent = root.querySelector('[data-detail-panel-content]');
    const sheetBackdrop = root.querySelector('[data-sheet-backdrop]');

    if (!mapEl || typeof L === 'undefined') return;

    const tileLayers = {
      positron: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }),
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }),
      voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }),
    };

    const map = L.map(mapEl, {
      center: [mapCenterLat, mapCenterLng],
      zoom: initialZoom,
      zoomControl: false,
    });
    tileLayers.voyager.addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    let currentTile = 'voyager';

    /** @type {Record<number, HTMLDivElement>} */
    const markerEls = {};
    /** @type {Record<number, L.Marker>} */
    const markers = {};

    /** @type {Set<string>} */
    const filterQuartiere = new Set();
    let activeId = null;

    /** @type {{ id: number, edition: string, markerLabel: string }[]} */
    let covers = [];

    function makeChip(value, label, count) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'torineser-map__chip';
      btn.dataset.value = value;
      btn.innerHTML =
        label + (count != null ? ` <span class="torineser-map__chip-count">${count}</span>` : '');
      return btn;
    }

    function syncChipPane(paneEl, set) {
      if (!paneEl) return;
      paneEl.querySelectorAll('.torineser-map__chip').forEach((b) => {
        const btn = /** @type {HTMLButtonElement} */ (b);
        const v = btn.dataset.value;
        if (v === 'all') btn.classList.toggle('torineser-map__chip--active', set.size === 0);
        else btn.classList.toggle('torineser-map__chip--active', set.has(v));
      });
    }

    function toggleSetValue(set, value) {
      if (value === 'all') {
        set.clear();
        return;
      }
      if (set.has(value)) set.delete(value);
      else set.add(value);
    }

    function buildQuartieriChips() {
      if (!filterQuartieriEl) return;
      filterQuartieriEl.innerHTML = '';
      const quartiereCounts = countBy(covers, 'quartiere');
      const sorted = Object.keys(quartiereCounts).sort((a, b) => {
        return quartiereCounts[b] - quartiereCounts[a] || a.localeCompare(b);
      });
      const allChip = makeChip('all', 'Tutta Torino', null);
      allChip.classList.add('torineser-map__chip--active');
      filterQuartieriEl.appendChild(allChip);
      sorted.forEach((q) => filterQuartieriEl.appendChild(makeChip(q, q, quartiereCounts[q])));
    }

    function clearMarkers() {
      Object.values(markers).forEach((m) => {
        map.removeLayer(m);
      });
      for (const k of Object.keys(markers)) delete markers[Number(k)];
      for (const k of Object.keys(markerEls)) delete markerEls[Number(k)];
    }

    function buildMarkers() {
      clearMarkers();
      covers.forEach((c, idx) => {
        const label =
          c.edition && c.edition.length > 0
            ? c.edition.length > 3
              ? c.edition.slice(0, 3)
              : c.edition
            : String(idx + 1);
        c.markerLabel = label;

        const el = document.createElement('div');
        el.className = 'torineser-map__cover-marker';
        el.innerHTML = `<span>${label}</span><div class="torineser-map__marker-tooltip">#${c.id} — ${escapeHtml(c.title)}</div>`;
        el.addEventListener('click', () => openPanel(c.id));

        const icon = L.divIcon({ html: el, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });
        const marker = L.marker(c.coords, { icon }).addTo(map);
        markerEls[c.id] = el;
        markers[c.id] = marker;
      });
    }

    function escapeHtml(s) {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function openPanel(id) {
      const c = covers.find((x) => x.id === id);
      if (!c || !panel || !panelContent) return;

      if (activeId != null && markerEls[activeId]) markerEls[activeId].classList.remove('torineser-map__cover-marker--active');
      activeId = id;
      markerEls[id].classList.add('torineser-map__cover-marker--active');

      const numLine =
        c.edition && c.edition.length > 0
          ? `${escapeHtml(c.edition)} · ${escapeHtml(c.quartiere)}`
          : `#${c.id} · ${escapeHtml(c.quartiere)}`;

      const imgHtml = c.image
        ? `<img class="torineser-map__panel-cover" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}" loading="lazy" width="600" height="800">`
        : `<div class="torineser-map__panel-cover-placeholder"><span class="torineser-map__panel-cover-num">${escapeHtml(c.markerLabel)}</span><span class="torineser-map__panel-cover-label">The Torineser</span></div>`;

      const linkHtml = c.url
        ? `<a href="${escapeHtml(c.url)}" class="torineser-map__panel-link">Scopri →</a>`
        : '';

      panelContent.innerHTML = `
        ${imgHtml}
        <div class="torineser-map__panel-body">
          <div class="torineser-map__panel-num">${numLine}</div>
          <div class="torineser-map__panel-title">${escapeHtml(c.title)}</div>
          ${c.vendor ? `<div class="torineser-map__panel-artist">${escapeHtml(c.vendor)}</div>` : ''}
          <div class="torineser-map__panel-location">
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
              <path d="M5 0C2.79 0 1 1.79 1 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4zm0 5.5C4.17 5.5 3.5 4.83 3.5 4S4.17 2.5 5 2.5 6.5 3.17 6.5 4 5.83 5.5 5 5.5z" fill="currentColor"/>
            </svg>
            ${escapeHtml(c.location_label)}
          </div>
          <div class="torineser-map__panel-desc">${escapeHtml(c.description)}</div>
          ${linkHtml}
        </div>
      `;

      root.classList.add('torineser-map--panel-open');
      map.panTo(c.coords, { animate: true, duration: 0.5 });
    }

    function closePanel() {
      if (activeId != null && markerEls[activeId]) markerEls[activeId].classList.remove('torineser-map__cover-marker--active');
      activeId = null;
      root.classList.remove('torineser-map--panel-open');
    }

    function matches(c) {
      return filterQuartiere.size === 0 || filterQuartiere.has(c.quartiere);
    }

    function applyFilters() {
      let count = 0;
      /** @type {{ coords: number[] }[]} */
      const visible = [];
      covers.forEach((c) => {
        const show = matches(c);
        const el = markerEls[c.id];
        if (!el) return;
        if (show) {
          el.classList.remove('torineser-map__cover-marker--dimmed');
          count++;
          visible.push(c);
        } else {
          el.classList.add('torineser-map__cover-marker--dimmed');
        }
      });

      const activeFilters = [];
      if (filterQuartiere.size) activeFilters.push([...filterQuartiere].join(', '));

      if (countLabel) {
        countLabel.textContent =
          activeFilters.length === 0
            ? `${covers.length} luoghi · Torino`
            : `${count} copertine · ${activeFilters.join(' · ')}`;
      }

      if (visible.length && activeFilters.length > 0) {
        map.fitBounds(L.latLngBounds(visible.map((c) => c.coords)), { padding: [80, 80], maxZoom: 16 });
      } else if (activeFilters.length === 0) {
        map.setView([mapCenterLat, mapCenterLng], initialZoom);
      }

      if (fabCount) {
        const activeCount = filterQuartiere.size > 0 ? 1 : 0;
        fabCount.textContent = activeCount === 0 ? String(covers.length) : `${count}/${covers.length}`;
        fabCount.style.background = activeCount === 0 ? 'rgba(255,255,255,0.18)' : '';
      }
    }

    function wireFilters() {
      if (filterQuartieriEl) {
        filterQuartieriEl.addEventListener('click', (e) => {
          const btn = /** @type {HTMLElement} */ (e.target).closest('.torineser-map__chip');
          if (!btn || !(btn instanceof HTMLButtonElement)) return;
          const v = btn.dataset.value;
          if (v == null) return;
          toggleSetValue(filterQuartiere, v);
          syncChipPane(filterQuartieriEl, filterQuartiere);
          applyFilters();
          closePanel();
        });
      }

      const resetBtn = root.querySelector('[data-filter-reset]');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          filterQuartiere.clear();
          syncChipPane(filterQuartieriEl, filterQuartiere);
          applyFilters();
          closePanel();
        });
      }

      const panelClose = root.querySelector('[data-panel-close]');
      if (panelClose) panelClose.addEventListener('click', closePanel);

      const fab = root.querySelector('[data-filter-fab]');
      if (fab) fab.addEventListener('click', () => root.classList.add('torineser-map--sheet-open'));
      if (sheetBackdrop) sheetBackdrop.addEventListener('click', () => root.classList.remove('torineser-map--sheet-open'));

      const styleSelect = root.querySelector('[data-map-style-select]');
      if (styleSelect && styleSelect instanceof HTMLSelectElement) {
        styleSelect.addEventListener('change', () => {
          const style = styleSelect.value;
          if (!tileLayers[style] || style === currentTile) return;
          map.removeLayer(tileLayers[currentTile]);
          tileLayers[style].addTo(map);
          currentTile = style;
        });
      }
    }

    loadAllPages(collectionUrl, view, totalPages, rawList).then((merged) => {
      const normalized = [];
      merged.forEach((raw) => {
        const n = normalizeProduct(raw);
        if (n) normalized.push(n);
      });
      const seen = new Set();
      covers = normalized.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      buildQuartieriChips();
      buildMarkers();
      wireFilters();
      applyFilters();
      setTimeout(() => map.invalidateSize(), 100);
    });
  }

  function boot() {
    document.querySelectorAll('[data-torineser-map]').forEach((el) => {
      if (el instanceof HTMLElement) init(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
