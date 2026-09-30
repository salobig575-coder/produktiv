const HabitsView = {
  async render() {
    const wrap = App.el('div');
    const habits = await DB.getAll('habits');
    habits.sort((a, b) => a.createdAt - b.createdAt);
    const logs = await DB.getAll('habitLogs');

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.openEditor() }, [
      App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px' }), 'Neue Gewohnheit',
    ]));
    wrap.appendChild(App.el('div', { style: 'height:14px' }));

    if (habits.length === 0) {
      wrap.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.habits() }),
        'Noch keine Gewohnheiten angelegt.',
      ]));
      return wrap;
    }

    const days = this.lastNDays(7);
    const card = App.el('div', { class: 'card' });
    const grid = App.el('div', { class: 'habit-grid' });

    grid.appendChild(App.el('div', {}));
    for (const d of days) {
      grid.appendChild(App.el('div', { class: 'head' }, d.label));
    }

    for (const h of habits) {
      const nameCell = App.el('div', { class: 'habit-name', style: 'cursor:pointer', onclick: () => this.openEditor(h) }, h.name);
      grid.appendChild(nameCell);
      for (const d of days) {
        const logged = logs.some((l) => l.habitId === h.id && l.date === d.iso);
        grid.appendChild(App.el('button', {
          class: 'dot' + (logged ? ' on' : ''),
          onclick: (e) => this.toggleLog(h.id, d.iso, e.currentTarget),
        }));
      }
    }
    card.appendChild(grid);
    wrap.appendChild(card);

    const list = App.el('div', { class: 'list' });
    for (const h of habits) {
      const streak = this.streak(logs, h.id);
      list.appendChild(App.el('div', { class: 'item' }, [
        App.el('span', { html: Icons.habits(), style: `width:20px;height:20px;flex-shrink:0;color:${streak > 0 ? 'var(--warn)' : 'var(--text-dim)'}` }),
        App.el('div', { style: 'flex:1;cursor:pointer', onclick: () => this.openEditor(h) }, [
          App.el('div', { class: 'item-title' }, h.name),
          App.el('div', { class: 'item-meta' }, (streak > 0 ? `${streak} Tage in Folge` : 'Noch keine Serie') + (h.window ? ` · ${Planner.fmt(h.window.from)}–${Planner.fmt(h.window.to)}` : '')),
        ]),
        App.el('button', { class: 'icon-btn', html: Icons.trash(), onclick: (e) => this.remove(h, e) }),
      ]));
    }
    wrap.appendChild(list);

    return wrap;
  },

  lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ iso: App.todayStr(d), label: d.toLocaleDateString('de-DE', { weekday: 'narrow' }) });
    }
    return out;
  },

  streak(logs, habitId) {
    let count = 0;
    let d = new Date();
    while (true) {
      const iso = App.todayStr(d);
      if (logs.some((l) => l.habitId === habitId && l.date === iso)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return count;
  },

  async toggleLog(habitId, dateIso, btn) {
    if (btn) btn.classList.add('pop');
    const logs = await DB.getAll('habitLogs');
    const existing = logs.find((l) => l.habitId === habitId && l.date === dateIso);
    if (existing) {
      await DB.delete('habitLogs', existing.id);
    } else {
      await DB.put('habitLogs', { id: DB.uid(), habitId, date: dateIso });
    }
    setTimeout(() => App.refresh(), 180);
  },

  async remove(h, e) {
    const el = e.currentTarget.closest('.item');
    if (el) el.classList.add('removing');
    setTimeout(async () => {
      await DB.delete('habits', h.id);
      const logs = await DB.getAll('habitLogs');
      for (const l of logs.filter((x) => x.habitId === h.id)) {
        await DB.delete('habitLogs', l.id);
      }
      App.refresh();
    }, 220);
  },

  openEditor(habit) {
    const isNew = !habit;
    const h = habit ? { ...habit } : { id: DB.uid(), name: '', createdAt: Date.now() };
    const nameInput = App.el('input', { type: 'text', value: h.name, placeholder: 'z.B. Lesen, Sport, Meditieren' });

    const fromInput = App.el('input', { type: 'time', value: Planner.fmt(h.window ? h.window.from : 12 * 60) });
    const toInput = App.el('input', { type: 'time', value: Planner.fmt(h.window ? h.window.to : 14 * 60) });
    const durSelect = App.el('select', {}, [10, 15, 20, 30, 45, 60, 90].map((m) => App.el('option', { value: m }, Planner.fmtDur(m))));
    durSelect.value = String(h.dur || 30);
    const days = new Set(h.days || []);
    const dayBtns = [1, 2, 3, 4, 5, 6, 0].map((d) => App.el('button', {
      class: 'btn secondary' + (days.has(d) ? ' selected' : ''), style: 'width:auto;padding:8px 0;flex:1;min-width:0',
      onclick: (e) => { days.has(d) ? days.delete(d) : days.add(d); e.currentTarget.classList.toggle('selected', days.has(d)); },
    }, ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d]));
    const windowFields = App.el('div', { style: h.window ? '' : 'display:none' }, [
      App.el('div', { class: 'row' }, [
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Frühestens'), fromInput]),
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Spätestens'), toInput]),
      ]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Dauer'), durSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Tage (leer = täglich)'), App.el('div', { class: 'fab-row', style: 'flex-wrap:nowrap;gap:4px;margin-bottom:0' }, dayBtns)]),
    ]);
    let useWindow = !!h.window;

    const content = App.el('div', {}, [
      App.el('h3', {}, isNew ? 'Neue Gewohnheit' : 'Gewohnheit bearbeiten'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Name'), nameInput]),
      App.switchRow('Automatisch im Kalender einplanen', 'Die Gewohnheit sucht sich selbst freie Zeit im Zeitfenster – um Termine herum.', useWindow, (v) => { useWindow = v; windowFields.style.display = v ? '' : 'none'; }),
      windowFields,
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            h.name = nameInput.value.trim();
            if (!h.name) { nameInput.focus(); return; }
            if (useWindow) {
              const from = Planner.parseTime(fromInput.value), to = Planner.parseTime(toInput.value);
              h.window = { from, to: Math.max(to, from + 15) };
              h.dur = Number(durSelect.value);
              h.days = [...days];
            } else { h.window = null; }
            await DB.put('habits', h);
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => nameInput.focus(), 50);
  },
};
