const App = {
  routes: {
    today: { title: 'Heute', render: () => TodayView.render() },
    tasks: { title: 'Aufgaben', render: () => TasksView.render() },
    notes: { title: 'Notizen', render: () => NotesView.render() },
    focus: { title: 'Fokus', render: () => FocusView.render() },
    habits: { title: 'Habits', render: () => HabitsView.render() },
  },

  current: 'today',

  init() {
    document.querySelectorAll('nav.bottomnav button').forEach((btn) => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.route));
    });
    document.getElementById('settingsBtn').addEventListener('click', () => SettingsView.open());

    const hash = location.hash.replace('#', '');
    this.navigate(this.routes[hash] ? hash : 'today');

    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  navigate(route) {
    if (!this.routes[route]) route = 'today';
    this.current = route;
    location.hash = route;
    document.querySelectorAll('nav.bottomnav button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    document.getElementById('pageTitle').textContent = this.routes[route].title;
    document.getElementById('pageSub').textContent = '';
    const view = document.getElementById('view');
    view.innerHTML = '';
    Promise.resolve(this.routes[route].render()).then((node) => {
      if (node) view.appendChild(node);
    });
  },

  refresh() {
    this.navigate(this.current);
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
      this._modal.remove();
      this._modal = null;
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
};
