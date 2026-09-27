const App = {
  routes: {
    today: { title: 'Heute', icon: 'home', render: () => TodayView.render() },
    tasks: { title: 'Aufgaben', icon: 'tasks', render: () => TasksView.render() },
    notes: { title: 'Notizen', icon: 'notes', render: () => NotesView.render() },
    focus: { title: 'Fokus', icon: 'focus', render: () => FocusView.render() },
    habits: { title: 'Habits', icon: 'habits', render: () => HabitsView.render() },
  },
  routeOrder: ['today', 'tasks', 'notes', 'focus', 'habits'],

  current: 'today',

  init() {
    document.getElementById('settingsBtn').innerHTML = Icons.settings();
    document.querySelectorAll('nav.bottomnav button').forEach((btn) => {
      const route = btn.dataset.route;
      btn.querySelector('.ic').innerHTML = Icons[this.routes[route].icon]();
      btn.addEventListener('click', () => this.navigate(route));
    });
    document.getElementById('settingsBtn').addEventListener('click', () => SettingsView.open());

    const hash = location.hash.replace('#', '');
    this.navigate(this.routes[hash] ? hash : 'today', { instant: true });

    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    const splash = document.getElementById('splash');
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 550);
    }, 1200);
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
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
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
