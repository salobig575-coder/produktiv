const App = {
  routes: {
    today: { title: 'Heute', icon: 'home', render: () => TodayView.render() },
    planen: { title: 'Planen', icon: 'planen', render: () => PlanenHub.render() },
    fitness: { title: 'Fitness', icon: 'fitness', render: () => FitnessHub.render() },
  },
  routeOrder: ['today', 'planen', 'fitness'],

  current: 'today',

  init() {
    document.getElementById('settingsBtn').innerHTML = Icons.settings();
    document.getElementById('settingsBtn').addEventListener('click', () => SettingsView.open());
    document.getElementById('searchBtn').innerHTML = Icons.search();
    document.getElementById('searchBtn').addEventListener('click', () => SearchView.open());

    let lastErr = 0;
    const surface = (m) => { if (Date.now() - lastErr > 4000) { lastErr = Date.now(); Planner.toast('Fehler: ' + String(m).slice(0, 90)); } };
    window.addEventListener('error', (e) => surface(e.message));
    window.addEventListener('unhandledrejection', (e) => surface((e.reason && e.reason.message) || e.reason));
    this.renderNav();
    window.addEventListener('resize', () => this.renderNav());
    this.bindShortcuts();
    this.bindGestures();

    // Browser-Zurück und direkte Hash-Links (#planen)
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '');
      if (this.routes[h] && h !== this.current) this.navigate(h);
    });
    // Läuft die App über Mitternacht, springt „heute“ mit
    this._day = this.todayStr();
    const dayCheck = () => {
      if (this.todayStr() === this._day) return;
      const old = this._day;
      this._day = this.todayStr();
      if (typeof CalendarView !== 'undefined') { if (CalendarView.selectedDate === old) CalendarView.selectedDate = this._day; CalendarView._lastDate = null; }
      this.refresh();
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') dayCheck(); });
    setInterval(dayCheck, 60000);
    if (typeof FocusView !== 'undefined') FocusView.restore();

    const hash = location.hash.replace('#', '');
    this.navigate(this.routes[hash] ? hash : 'today', { instant: true });

    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(() => {});
      // Cache-first-Service-Worker: neue Versionen kommen im Hintergrund an – dann zum Neuladen auffordern
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) Planner.toast('Neue Version verfügbar', { label: 'Neu laden', fn: () => location.reload() });
      });
    }

    setTimeout(() => this.backupReminder(), 6000);

    const splash = document.getElementById('splash');
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 550);
    }, 1200);
  },

  // Ohne Sync gibt es nur eine lokale Kopie: alle 14 Tage an eine Sicherung erinnern (erster Start setzt nur die Uhr).
  async backupReminder() {
    try {
      const sess = await DB.get('settings', 'syncSession');
      if (sess && sess.value) return;
      const last = Number(localStorage.getItem('lastBackup') || 0);
      if (!last) { localStorage.setItem('lastBackup', String(Date.now())); return; }
      if (Date.now() - last < 14 * 86400000) return;
      const has = (await DB.getAll('tasks')).length + (await DB.getAll('events')).length + (await DB.getAll('workoutSessions')).length;
      if (has === 0) return;
      Planner.toast('Backup fällig – deine Daten liegen nur auf diesem Gerät.', { label: 'Sichern', fn: () => SettingsView.exportFile() });
    } catch (e) {}
  },

  // Nächster/vorheriger Tab bzw. Bereich (Reihenfolge: Heute – Planen-Tabs – Fitness-Tabs)
  stepTab(dir) {
    const hub = { planen: PlanenHub, fitness: FitnessHub }[this.current];
    if (hub) {
      const i = hub.tabs.findIndex((t) => t.key === hub.activeTab), n = i + dir;
      if (n >= 0 && n < hub.tabs.length) { hub.activeTab = hub.tabs[n].key; this.navigate(this.current, { animate: true }); return; }
    }
    const r = this.routeOrder.indexOf(this.current) + dir;
    if (r >= 0 && r < this.routeOrder.length) {
      const next = this.routeOrder[r], nh = { planen: PlanenHub, fitness: FitnessHub }[next];
      if (nh) nh.activeTab = dir > 0 ? nh.tabs[0].key : nh.tabs[nh.tabs.length - 1].key;
      this.navigate(next);
    }
  },

  // Globale Gesten: vom Rand wischen (zurück/Tab wechseln), nach unten ziehen zum Aktualisieren
  bindGestures() {
    Gestures.install();
    const ptr = this.el('div', { id: 'ptr', html: Icons.sparkles() });
    document.body.appendChild(ptr);
    let x0 = 0, y0 = 0, edge = 0, ptrOk = false, pulling = false, pull = 0, busy = false;
    const reset = () => { ptr.style.transition = 'transform .3s cubic-bezier(.32,.72,0,1), opacity .3s'; ptr.style.transform = 'translate(-50%, -60px)'; ptr.style.opacity = '0'; ptr.classList.remove('spin'); };

    document.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; pulling = false; pull = 0;
      edge = t.clientX < 22 ? -1 : (t.clientX > window.innerWidth - 22 ? 1 : 0);
      ptrOk = !busy && !edge && !this._modal && window.scrollY <= 0 &&
        !e.target.closest('.tl-scroll, .date-strip, .tab-bar, input, textarea, select, #splash');
      ptr.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!ptrOk) return;
      const t = e.touches[0], dy = t.clientY - y0, dx = t.clientX - x0;
      if (!pulling) {
        if (dy > 12 && Math.abs(dx) < dy) pulling = true; else return;
      }
      if (e.cancelable) e.preventDefault();
      pull = Math.min(dy * 0.5, 84);
      ptr.style.opacity = String(Math.min(1, pull / 40));
      ptr.style.transform = `translate(-50%, ${pull - 40}px) rotate(${pull * 4}deg)`;
    }, { passive: false });

    document.addEventListener('touchend', async (e) => {
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (pulling) {
        pulling = false;
        if (pull >= 46 && !busy) {
          busy = true;
          ptr.style.transition = 'transform .25s cubic-bezier(.32,.72,0,1)';
          ptr.style.transform = 'translate(-50%, 34px)';
          ptr.classList.add('spin');
          try { if (typeof Sync !== 'undefined') await Sync.run(); } catch (err) {}
          await new Promise((r) => setTimeout(r, 350));
          this.refresh();
          busy = false;
        }
        reset();
        return;
      }
      // Vom Rand wischen: links → zurück (Fenster schließen) bzw. vorheriger Tab, rechts → nächster Tab
      if (edge !== 0 && Math.abs(dy) < 70) {
        if (edge === -1 && dx > 70) { if (this._modal) this.closeModal(); else this.stepTab(-1); }
        else if (edge === 1 && dx < -70 && !this._modal) this.stepTab(1);
      }
    }, { passive: true });
  },

  // Tastenkürzel für Mac und PC (greifen nicht beim Tippen in Feldern)
  bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
      if (!e.key) return; // Autofill-Ereignisse auf iOS haben keine Taste
      if (e.key === 'Escape' && this._modal) { this.closeModal(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 'k') { e.preventDefault(); SearchView.open(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || this._modal) return;
      const cal = this.current === 'planen' && PlanenHub.activeTab === 'calendar';
      const step = (n) => { CalendarView.selectedDate = Planner.addDays(CalendarView.selectedDate || this.todayStr(), n * (CalendarView.mode === 'week' ? 7 : 1)); this.refresh(); };
      const keys = {
        '/': () => SearchView.open(),
        '1': () => this.navigate('today'), '2': () => this.navigate('planen'), '3': () => this.navigate('fitness'),
      };
      if (cal) {
        Object.assign(keys, {
          ArrowLeft: () => step(-1), ArrowRight: () => step(1),
          t: () => { CalendarView.selectedDate = this.todayStr(); this.refresh(); },
          d: () => { CalendarView.mode = 'day'; this.refresh(); },
          w: () => { CalendarView.mode = 'week'; this.refresh(); },
          n: () => { const h = Math.min(23, new Date().getHours() + 1); CalendarView.openEventEditor(null, h * 60); },
        });
      }
      if (this.current === 'planen' && PlanenHub.activeTab === 'tasks') keys.n = () => TasksView.openEditor();
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    });
  },

  // Statt eines leeren Bildschirms: Fehler sichtbar machen, mit Ausweg
  showError(err) {
    console.error(err);
    const msg = (err && (err.message || err.name)) || String(err);
    const view = document.getElementById('view');
    if (!view) return;
    view.classList.remove('leaving');
    view.replaceChildren(this.el('div', { class: 'card' }, [
      this.el('h2', {}, 'Hier ist etwas schiefgegangen'),
      this.el('p', { class: 'tag', style: 'word-break:break-word;margin:0 0 14px' }, msg),
      this.el('button', { class: 'btn', style: 'margin-bottom:8px', onclick: () => location.reload() }, 'Neu laden'),
      this.el('button', { class: 'btn secondary', onclick: async () => {
        if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
        location.reload();
      } }, 'Zwischenspeicher leeren & neu laden'),
    ]));
  },

  // Untere Leiste: im Bereich Planen/Fitness zeigt sie dessen Tabs (mit „Menü“ zurück zu Heute/Planen/Fitness),
  // sonst die drei Hauptbereiche. Die obere Tab-Leiste gibt es nicht mehr.
  navItems() {
    const route = this.current;
    const hub = { planen: PlanenHub, fitness: FitnessHub }[route];
    if (hub && !this._menuOpen) {
      return [
        { key: '__menu', label: 'Menü', icon: 'chevronLeft', back: true, fn: () => { this._menuOpen = true; this.renderNav(); } },
        ...hub.tabs.map((t) => ({
          key: 't:' + t.key, tab: t.key, label: t.label, icon: hub.tabIcons[t.key], active: hub.activeTab === t.key,
          fn: () => { hub.activeTab = t.key; this._menuOpen = false; this.navigate(route, { animate: true }); },
        })),
      ];
    }
    return this.routeOrder.map((r) => ({
      key: 'r:' + r, route: r, label: this.routes[r].title, icon: this.routes[r].icon, active: r === route,
      fn: () => {
        if (r === this.current) { this._menuOpen = false; this.renderNav(); this.refresh(); return; }
        this._menuOpen = false;
        this.navigate(r);
      },
    }));
  },

  renderNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    const items = this.navItems();
    const sig = items.map((i) => i.key).join('|');
    if (sig !== this._navSig) {
      this._navSig = sig;
      nav.querySelectorAll('button').forEach((b) => b.remove());
      nav.classList.toggle('sect', items.some((i) => i.back));
      nav.classList.remove('swap');
      void nav.offsetWidth;
      nav.classList.add('swap');
      items.forEach((it) => {
        const btn = this.el('button', {
          class: it.back ? 'nav-back' : '', 'aria-label': it.label, onclick: () => it.fn(),
        }, [this.el('span', { class: 'ic', html: Icons[it.icon]() }), this.el('span', { class: 'nav-label' }, it.label)]);
        if (it.route) btn.dataset.route = it.route;
        if (it.tab) btn.dataset.tab = it.tab;
        nav.appendChild(btn);
      });
    }
    const btns = [...nav.querySelectorAll('button')];
    let activeBtn = null;
    items.forEach((it, i) => {
      btns[i].classList.toggle('active', !!it.active);
      if (it.active) { btns[i].setAttribute('aria-current', 'page'); activeBtn = btns[i]; } else btns[i].removeAttribute('aria-current');
    });
    // Markierung unter dem aktiven Eintrag (pixelgenau statt Drittel-Annahme)
    const ind = document.getElementById('navIndicator');
    if (ind) {
      requestAnimationFrame(() => {
        if (!activeBtn) { ind.style.opacity = '0'; return; }
        ind.style.opacity = '1';
        ind.style.width = activeBtn.offsetWidth + 'px';
        ind.style.transform = `translateX(${activeBtn.offsetLeft - 6}px)`;
      });
    }
  },

  // Rendert eine Ansicht ohne Flackern: alter Inhalt bleibt stehen, bis der neue fertig ist (kein leerer Zwischenzustand).
  // Gleicher Bereich + gleicher Tab = "leises" Aktualisieren: keine Einblend-Animation, Scrollposition bleibt.
  navigate(route, opts = {}) {
    if (!this.routes[route]) route = 'today';
    const wasCurrent = this.current === route;
    const silent = !!opts.silent || (wasCurrent && !opts.animate);
    this.current = route;
    if (location.hash !== '#' + route) location.hash = route;

    if (!silent) this._menuOpen = false; // Wechsel in einen Bereich zeigt dessen Tabs unten
    this.renderNav();

    document.getElementById('pageTitle').textContent = this.routes[route].title;
    if (!silent) document.getElementById('pageSub').textContent = '';

    const view = document.getElementById('view');
    const token = (this._renderToken = (this._renderToken || 0) + 1);
    const y = window.scrollY;
    const apply = () => Promise.resolve().then(() => this.routes[route].render()).then((node) => {
      if (token !== this._renderToken) return; // ein neuerer Aufruf hat übernommen
      view.classList.remove('leaving');
      view.classList.toggle('no-anim', silent);
      view.replaceChildren(...(node ? [node] : []));
      this.linkLabels(view);
      if (silent) {
        window.scrollTo(0, y);
      } else {
        window.scrollTo(0, 0);
        view.style.animation = 'none';
        void view.offsetWidth; // Animation neu starten
        view.style.animation = '';
      }
    }).catch((err) => { if (token === this._renderToken) this.showError(err); });

    if (opts.instant || silent || !view.hasChildNodes()) {
      apply();
    } else {
      view.classList.add('leaving');
      setTimeout(apply, 110);
    }
  },

  refresh() {
    this.navigate(this.current, { instant: true, silent: true });
  },

  setSub(text) {
    document.getElementById('pageSub').textContent = text;
  },

  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'title' && tag === 'button') { node.setAttribute('title', v); node.setAttribute('aria-label', v); }
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (typeof v === 'boolean') { if (v) node.setAttribute(k, ''); else node.removeAttribute(k); }
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  },

  delta(value, opts = {}) {
    if (!value) return null;
    const rounded = Math.round(value * 10) / 10;
    const sign = rounded > 0 ? '+' : '';
    return this.el('span', { class: 'delta ' + (rounded >= 0 ? 'pos' : 'neg') }, `(${sign}${rounded}${opts.suffix || ''})`);
  },

  exerciseAbbr(name) {
    const words = (name || '').split(/[\s-]+/).filter(Boolean);
    if (words.length === 0) return '–';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  },

  positionChip(index, name, opts = {}) {
    return this.el('div', { class: 'pos-chip' + (opts.lg ? ' lg' : '') }, [
      this.el('div', { class: 'pos-code' }, `${index + 1}A`),
      this.el('div', { class: 'pos-abbr' }, this.exerciseAbbr(name)),
    ]);
  },

  tabBar(tabs, activeKey, onChange) {
    const bar = this.el('div', { class: 'tab-bar' }, tabs.map((t) =>
      this.el('button', {
        class: 'tab-pill' + (t.key === activeKey ? ' active' : ''),
        onclick: () => onChange(t.key),
      }, t.label)
    ));
    requestAnimationFrame(() => {
      const active = bar.querySelector('.tab-pill.active');
      if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
    return bar;
  },

  chipTabBar(tabs, activeKey, onChange) {
    const bar = this.el('div', { class: 'chip-tab-bar' }, tabs.map((t, i) =>
      this.el('button', {
        class: 'chip-tab' + (t.key === activeKey ? ' active' : '') + (t.done ? ' tab-done' : ''),
        onclick: () => onChange(t.key),
      }, [
        this.el('div', { class: 'pos-code' }, `${i + 1}A`),
        this.el('div', { class: 'pos-abbr' }, this.exerciseAbbr(t.label)),
      ])
    ));
    requestAnimationFrame(() => {
      const active = bar.querySelector('.chip-tab.active');
      if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
    return bar;
  },

  switchRow(label, desc, checked, onChange) {
    const sw = this.el('div', { class: 'switch' + (checked ? ' on' : '') });
    sw.addEventListener('click', () => {
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      onChange(next);
    });
    const textCol = [this.el('div', { class: 'switch-label' }, label)];
    if (desc) textCol.push(this.el('div', { class: 'switch-desc' }, desc));
    return this.el('div', { class: 'switch-row' }, [
      this.el('div', { style: 'flex:1;min-width:0' }, textCol),
      sw,
    ]);
  },

  showModal(contentNode) {
    const backdrop = this.el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) App.closeModal(); } });
    const modal = this.el('div', { class: 'modal' }, [contentNode]);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this._modal = backdrop;
    // Barrierefreiheit: als Dialog auszeichnen, Fokus hineinsetzen, Beschriftungen mit Feldern verknüpfen
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const heading = modal.querySelector('h3');
    if (heading) { heading.id = heading.id || 'dlgTitle' + (++this._fid); modal.setAttribute('aria-labelledby', heading.id); }
    this._prevFocus = document.activeElement;
    modal.tabIndex = -1;
    try { modal.focus({ preventScroll: true }); } catch (e) {}
    this.linkLabels(modal);
    this.enableSheetDrag(backdrop, modal);
    return backdrop;
  },

  _fid: 0,
  // Gestalteter Leer-Zustand: Symbol in Kachel, Titel, kurzer Hinweis, optional ein Knopf
  emptyState({ icon, title, sub, action }) {
    return this.el('div', { class: 'empty-state' }, [
      this.el('div', { class: 'es-icon', html: Icons[icon]() }),
      this.el('div', { class: 'es-title' }, title),
      sub ? this.el('div', { class: 'es-sub' }, sub) : null,
      action ? this.el('button', { class: 'btn', onclick: action.fn }, action.label) : null,
    ]);
  },

  // Verknüpft <label> und Eingabefeld innerhalb von .field (Screenreader lesen so den Feldnamen vor)
  linkLabels(root) {
    root.querySelectorAll('.field').forEach((f) => {
      const l = f.querySelector('label'), c = f.querySelector('input, select, textarea');
      if (l && c && !l.htmlFor) { if (!c.id) c.id = 'fld' + (++this._fid); l.htmlFor = c.id; }
    });
  },

  // Wie bei iOS-Sheets: Nach unten ziehen schließt das Fenster – am Balken (auch mit der Maus) oder überall im Inhalt,
  // sobald er ganz oben ist. Schnelles Wischen reicht ebenfalls.
  enableSheetDrag(backdrop, modal) {
    const ease = 'cubic-bezier(.32,.72,0,1)';
    let y0 = 0, x0 = 0, dy = 0, t0 = 0, dragging = false, active = false, fromHandle = false;

    const begin = (x, y, handle) => { x0 = x; y0 = y; dy = 0; t0 = performance.now(); dragging = false; active = true; fromHandle = handle; };
    const drag = (dyNow) => {
      dy = Math.max(0, dyNow);
      if (!dragging) { dragging = true; modal.style.animation = 'none'; modal.style.transition = 'none'; modal.classList.add('sheet-dragging'); }
      modal.style.transform = `translateY(${dy}px)`;
      backdrop.style.opacity = String(Math.max(0.15, 1 - dy / 450));
    };
    const finish = () => {
      active = false;
      if (!dragging) return;
      dragging = false;
      modal.classList.remove('sheet-dragging');
      const speed = dy / Math.max(1, performance.now() - t0); // px pro ms
      if (dy > 120 || (dy > 40 && speed > 0.6)) {
        this._modal = null;
        modal.style.transition = `transform .28s ${ease}`;
        backdrop.style.transition = 'opacity .28s linear';
        modal.style.transform = 'translateY(105%)';
        backdrop.style.opacity = '0';
        setTimeout(() => backdrop.remove(), 300);
      } else {
        modal.style.transition = `transform .34s ${ease}`;
        modal.style.transform = '';
        backdrop.style.transition = 'opacity .34s linear';
        backdrop.style.opacity = '';
      }
    };

    // Touch (iPhone): oben im Inhalt nach unten ziehen
    modal.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      begin(t.clientX, t.clientY, t.clientY - modal.getBoundingClientRect().top < 56);
    }, { passive: true });
    modal.addEventListener('touchmove', (e) => {
      if (!active) return;
      const t = e.touches[0];
      const dyRaw = t.clientY - y0, dxRaw = t.clientX - x0;
      if (!dragging) {
        if (modal.scrollTop > 0 && !fromHandle) { y0 = t.clientY; return; } // erst ganz nach oben scrollen
        if (dyRaw <= 8 || Math.abs(dxRaw) > Math.abs(dyRaw)) return;
      }
      if (e.cancelable) e.preventDefault();
      drag(dyRaw);
    }, { passive: false });
    modal.addEventListener('touchend', finish);
    modal.addEventListener('touchcancel', finish);

    // Maus (Mac/PC): am oberen Rand greifen
    modal.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.clientY - modal.getBoundingClientRect().top > 44) return;
      begin(e.clientX, e.clientY, true);
      modal.setPointerCapture(e.pointerId);
    });
    modal.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const overHandle = e.clientY - modal.getBoundingClientRect().top < 44;
      modal.classList.toggle('sheet-grab', overHandle || dragging);
      if (active && Math.abs(e.clientY - y0) > 4) drag(e.clientY - y0);
    });
    modal.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') finish(); });
  },

  closeModal() {
    if (this._modal) {
      const m = this._modal;
      this._modal = null;
      m.classList.add('closing');
      setTimeout(() => m.remove(), 300);
      try { if (this._prevFocus && document.body.contains(this._prevFocus)) this._prevFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  },

  // Kleines Konfetti-Feuerwerk an einem Element (oder Bildschirmmitte)
  confetti(origin, count = 16) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const colors = ['#34d399', '#4ade80', '#f5a524', '#60a5fa', '#f472b6'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
      const p = document.createElement('span');
      p.className = 'confetti';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 540 - 270) + 'deg');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  },

  animateCounter(el, to, opts = {}) {
    if (!el) return;
    const duration = opts.duration || 500;
    const from = opts.from != null ? opts.from : (parseFloat(el.dataset.counterVal) || 0);
    if (el._counterRAF) cancelAnimationFrame(el._counterRAF);
    if (Math.abs(to - from) < 0.5) { el.textContent = Math.round(to).toLocaleString('de-DE'); el.dataset.counterVal = to; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (to - from) * eased;
      el.textContent = Math.round(val).toLocaleString('de-DE');
      if (t < 1) {
        el._counterRAF = requestAnimationFrame(step);
      } else {
        el.dataset.counterVal = to;
        el._counterRAF = null;
      }
    };
    el._counterRAF = requestAnimationFrame(step);
  },

  applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
      theme = 'auto';
    }
    try { localStorage.setItem('theme', theme); } catch (e) {}
    DB.put('settings', { key: 'theme', value: theme }).catch(() => {});
  },

  currentTheme() {
    try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; }
  },

  todayStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatDate(str) {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  },

  greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Noch spät wach';
    if (h < 11) return 'Guten Morgen';
    if (h < 17) return 'Guten Tag';
    if (h < 22) return 'Guten Abend';
    return 'Noch spät wach';
  },
};
