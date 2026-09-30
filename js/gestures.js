// iPhone-Gesten: Zeilen wischen (Erledigt / Morgen / Löschen), langes Drücken für ein Aktionsmenü.
// Alles nutzt Touch-Events; am Desktop gibt es zusätzlich das Aktionsmenü per Rechtsklick.
const Gestures = {
  _open: null,
  lastSwipe: 0,

  install() {
    // Antippen außerhalb schließt eine geöffnete Zeile
    document.addEventListener('touchstart', (e) => {
      if (this._open && !this._open.wrap.contains(e.target)) this._open.close();
    }, { passive: true });
  },

  // Verpackt eine Zeile so, dass sie sich wischen lässt.
  //   right: { label, color, fn }   – langes Wischen nach rechts löst sofort aus (z. B. „Erledigt“)
  //   left:  [{ label, color, fn }] – Wischen nach links zeigt Knöpfe (z. B. „Morgen“, „Löschen“)
  swipeable(row, cfg) {
    const BTN = 82;
    const wrap = App.el('div', { class: 'swipe-wrap' });
    if (cfg.right) wrap.appendChild(App.el('div', { class: 'swipe-bg lead', style: `background:${cfg.right.color}` }, [App.el('span', {}, cfg.right.label)]));
    const openW = (cfg.left || []).length * BTN;
    const api = { wrap, close: () => setX(0, true) };
    if (openW) {
      wrap.appendChild(App.el('div', { class: 'swipe-bg trail' }, cfg.left.map((a) => App.el('button', {
        class: 'swipe-btn', style: `background:${a.color};width:${BTN}px`,
        onclick: (e) => { e.stopPropagation(); api.close(); setTimeout(a.fn, 120); },
      }, a.label))));
    }
    row.classList.add('swipe-row');
    // Eine laufende Einblend-Animation würde die Verschiebung überschreiben – nach ihrem Ende abschalten
    row.addEventListener('animationend', (e) => { if (e.target === row) row.style.animation = 'none'; });
    wrap.appendChild(row);

    let x0 = 0, y0 = 0, base = 0, x = 0, mode = null;
    const setX = (v, animate) => {
      x = v; base = v === -openW && openW ? v : 0;
      row.style.transition = animate ? 'transform .32s cubic-bezier(.32,.72,0,1)' : 'none';
      row.style.transform = v ? `translateX(${v}px)` : '';
      if (v === -openW && openW) Gestures._open = api; else if (Gestures._open === api && v === 0) Gestures._open = null;
    };

    row.addEventListener('touchstart', (e) => {
      if (this._open && this._open !== api) this._open.close();
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; mode = null;
      row.style.transition = 'none';
    }, { passive: true });

    row.addEventListener('touchmove', (e) => {
      const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (mode === null) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) mode = 'h';
        else if (Math.abs(dy) > 10) mode = 'v';
        else return;
      }
      if (mode !== 'h') return;
      if (e.cancelable) e.preventDefault();
      let v = base + dx;
      const max = cfg.right ? row.offsetWidth : 0, min = openW ? -(openW + 30) : 0;
      if (v > 0) v = cfg.right ? Math.min(v, max) : v / 6;          // ohne Aktion: nur zäher Widerstand
      if (v < min) v = min - (min - v) / 4;
      if (!openW && v < 0) v = v / 6;
      row.style.transform = `translateX(${v}px)`;
      x = v;
    }, { passive: false });

    const end = () => {
      if (mode !== 'h') return;
      Gestures.lastSwipe = Date.now();
      row._swiped = true;
      setTimeout(() => { row._swiped = false; }, 350);
      if (cfg.right && x > Math.min(110, row.offsetWidth * 0.32)) {
        row.style.transition = 'transform .26s cubic-bezier(.32,.72,0,1), opacity .26s';
        row.style.transform = `translateX(${row.offsetWidth}px)`;
        row.style.opacity = '.4';
        setTimeout(() => { cfg.right.fn(); setTimeout(() => setX(0, false), 400); }, 200);
      } else if (openW && x < -openW * 0.45) {
        setX(-openW, true);
      } else {
        setX(0, true);
      }
    };
    row.addEventListener('touchend', end);
    row.addEventListener('touchcancel', end);

    // Tippen bei geöffneter Zeile schließt nur; nach einem Wisch kein Klick
    row.addEventListener('click', (e) => {
      if (row._swiped) { e.stopPropagation(); e.preventDefault(); return; }
      if (base !== 0) { e.stopPropagation(); e.preventDefault(); api.close(); }
    }, true);
    return wrap;
  },

  // Langes Drücken (Touch) bzw. Rechtsklick (Maus) öffnet ein Menü
  longPress(el, fn) {
    let timer = null, x0 = 0, y0 = 0;
    el.classList.add('lp-target');
    el.addEventListener('touchstart', (e) => {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      clearTimeout(timer);
      timer = setTimeout(() => { el._lp = true; if (navigator.vibrate) navigator.vibrate(15); fn(); setTimeout(() => { el._lp = false; }, 500); }, 480);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (Math.hypot(e.touches[0].clientX - x0, e.touches[0].clientY - y0) > 8) clearTimeout(timer);
    }, { passive: true });
    ['touchend', 'touchcancel'].forEach((t) => el.addEventListener(t, () => clearTimeout(timer)));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); fn(); });
    el.addEventListener('click', (e) => { if (el._lp) { e.stopPropagation(); e.preventDefault(); el._lp = false; } }, true);
  },

  // Aktionsmenü wie bei iOS: unten als Sheet, mit Abbrechen
  actionSheet(title, actions) {
    const content = App.el('div', {}, [
      title ? App.el('div', { style: 'font-weight:800;font-size:16px;margin:0 2px 14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, title) : null,
      ...actions.filter(Boolean).map((a) => App.el('button', {
        class: 'btn ' + (a.danger ? 'danger' : 'secondary'), style: 'margin-bottom:8px;justify-content:flex-start;padding-left:18px',
        onclick: () => { App.closeModal(); setTimeout(a.fn, 140); },
      }, a.label)),
      App.el('button', { class: 'btn secondary', style: 'margin:6px 0 0', onclick: () => App.closeModal() }, 'Abbrechen'),
    ]);
    App.showModal(content);
  },
};
