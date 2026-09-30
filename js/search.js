// Globale Suche über Aufgaben, Termine, Notizen und Routinen.
const SearchView = {
  async open() {
    const [data, notes] = await Promise.all([Planner.load(), DB.getAll('notes')]);
    const input = App.el('input', { type: 'text', placeholder: 'Aufgaben, Termine, Notizen …', autocomplete: 'off' });
    const box = App.el('div');
    const content = App.el('div', {}, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:12px' }, [
        App.el('h3', { style: 'margin:0' }, 'Suche'),
        App.el('button', { class: 'icon-btn', html: Icons.close(), onclick: () => App.closeModal() }),
      ]),
      App.el('div', { class: 'field' }, [input]),
      box,
    ]);
    input.addEventListener('input', () => this.draw(box, input.value, data, notes));
    this.draw(box, '', data, notes);
    App.showModal(content);
    setTimeout(() => input.focus(), 60);
  },

  // Öffnet nach dem Schließen der Suche das Ziel (kurze Pause für die Animation)
  go(fn) {
    App.closeModal();
    setTimeout(fn, 240);
  },

  nextDate(ev) {
    const today = App.todayStr();
    if (ev.date >= today || (ev.repeat || 'none') === 'none') return ev.date;
    for (let i = 0; i < 400; i++) {
      const d = Planner.addDays(today, i);
      if (Planner.occursOn(ev, d)) return d;
    }
    return ev.date;
  },

  draw(box, q, data, notes) {
    box.innerHTML = '';
    q = q.trim().toLowerCase();
    if (!q) {
      box.appendChild(App.el('div', { class: 'empty', style: 'padding:24px 10px' }, [App.el('div', { class: 'empty-icon', html: Icons.search() }), 'Tippe, um alles zu durchsuchen.']));
      return;
    }
    const has = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(q);
    const groups = [
      {
        title: 'Aufgaben', icon: Icons.tasks(),
        rows: data.tasks.filter((t) => has(t.title, t.notes, (t.subtasks || []).map((s) => s.title).join(' ')))
          .sort((a, b) => Number(a.done) - Number(b.done))
          .map((t) => ({ title: t.title, meta: t.done ? 'Erledigt' : (t.dueDate ? `fällig ${App.formatDate(t.dueDate)}` : 'Inbox'), open: () => TasksView.openEditor(t) })),
      },
      {
        title: 'Termine', icon: Icons.planen(),
        rows: data.events.filter((e) => has(e.title)).map((e) => {
          const d = this.nextDate(e);
          return {
            title: e.title,
            meta: `${new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${Planner.fmt(e.start)}${(e.repeat || 'none') !== 'none' ? ' · ' + Planner.REPEAT_LABEL[e.repeat].toLowerCase() : ''}`,
            open: () => { PlanenHub.activeTab = 'calendar'; CalendarView.mode = 'day'; CalendarView.selectedDate = d; CalendarView._scrolled = false; App.navigate('planen'); setTimeout(() => CalendarView.openEventEditor(e), 450); },
          };
        }),
      },
      {
        title: 'Notizen', icon: Icons.notes(),
        rows: notes.filter((n) => has(n.title, n.content)).map((n) => ({ title: n.title || '(ohne Titel)', meta: (n.content || '').slice(0, 60), open: () => NotesView.openEditor(n) })),
      },
      {
        title: 'Routinen', icon: Icons.habits(),
        rows: data.habits.filter((h) => has(h.name)).map((h) => ({ title: h.name, meta: h.window ? `${Planner.fmt(h.window.from)}–${Planner.fmt(h.window.to)}` : 'Gewohnheit', open: () => HabitsView.openEditor(h) })),
      },
    ].filter((g) => g.rows.length);

    if (groups.length === 0) {
      box.appendChild(App.el('div', { class: 'empty', style: 'padding:24px 10px' }, 'Nichts gefunden.'));
      return;
    }
    for (const g of groups) {
      const card = App.el('div', { style: 'margin-bottom:14px' }, [
        App.el('div', { class: 'tag', style: 'font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px' }, `${g.title} · ${g.rows.length}`),
      ]);
      const list = App.el('div', { class: 'list' });
      g.rows.slice(0, 6).forEach((r) => list.appendChild(App.el('div', { class: 'item', style: 'cursor:pointer;animation:none', onclick: () => this.go(r.open) }, [
        App.el('span', { html: g.icon, style: 'width:18px;height:18px;color:var(--accent);flex-shrink:0' }),
        App.el('div', { style: 'flex:1;min-width:0' }, [
          App.el('div', { class: 'item-title', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, r.title),
          r.meta ? App.el('div', { class: 'tag' }, r.meta) : null,
        ]),
      ])));
      card.appendChild(list);
      if (g.rows.length > 6) card.appendChild(App.el('div', { class: 'tag', style: 'margin-top:6px' }, `+ ${g.rows.length - 6} weitere – Suchbegriff genauer eingeben`));
      box.appendChild(card);
    }
  },
};
