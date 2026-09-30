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
    document.querySelectorAll('nav.bottomnav button').forEach((btn) => {
      const route = btn.dataset.route;
      btn.querySelector('.ic').innerHTML = Icons[this.routes[route].icon]();
      btn.addEventListener('click', () => this.navigate(route));
    });
    document.getElementById('settingsBtn').addEventListener('click', () => SettingsView.open());
    document.getElementById('searchBtn').innerHTML = Icons.search();
    document.getElementById('searchBtn').addEventListener('click', () => SearchView.open());

    this.bindShortcuts();

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

    const splash = document.getElementById('splash');
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 550);
    }, 1200);
  },

  // Tastenkürzel für Mac und PC (greifen nicht beim Tippen in Feldern)
  bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
      if (e.key === 'Escape' && this._modal) { this.closeModal(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); SearchView.open(); return; }
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

  navigate(route, opts = {}) {
    if (!this.routes[route]) route = 'today';
    this.current = route;
    location.hash = route;

    document.querySelectorAll('nav.bottomnav button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    const idx = this.routeOrder.indexOf(route);
    const indicator = document.getElementById('navIndicator');
    if (indicator) indicator.style.transform = `translateX(${idx * 100}%)`;

    document.getElementById('pageTitle').textContent = this.routes[route].title;
    document.getElementById('pageSub').textContent = '';

    const view = document.getElementById('view');
    const render = () => {
      view.innerHTML = '';
      view.classList.remove('leaving');
      Promise.resolve(this.routes[route].render()).then((node) => {
        if (node) view.appendChild(node);
      });
    };

    if (opts.instant || !view.hasChildNodes()) {
      render();
    } else {
      view.classList.add('leaving');
      setTimeout(render, 150);
    }
  },

  refresh() {
    this.navigate(this.current, { instant: true });
  },

  setSub(text) {
    document.getElementById('pageSub').textContent = text;
  },

  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
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
    return backdrop;
  },

  closeModal() {
    if (this._modal) {
      const m = this._modal;
      this._modal = null;
      m.classList.add('closing');
      setTimeout(() => m.remove(), 200);
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
