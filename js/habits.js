const HabitsView = {
  async render() {
    const wrap = App.el('div');
    const habits = await DB.getAll('habits');
    habits.sort((a, b) => a.createdAt - b.createdAt);
    const logs = await DB.getAll('habitLogs');

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.openEditor() }, '+ Neue Gewohnheit'));
    wrap.appendChild(App.el('div', { style: 'height:12px' }));

    if (habits.length === 0) {
      wrap.appendChild(App.el('div', { class: 'empty' }, 'Noch keine Gewohnheiten angelegt.'));
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
          onclick: () => this.toggleLog(h.id, d.iso),
        }));
      }
    }
    card.appendChild(grid);
    wrap.appendChild(card);

    const list = App.el('div', { class: 'list' });
    for (const h of habits) {
      const streak = this.streak(logs, h.id);
      list.appendChild(App.el('div', { class: 'item' }, [
        App.el('div', { style: 'flex:1' }, [
          App.el('div', { class: 'item-title' }, h.name),
          App.el('div', { class: 'item-meta' }, streak > 0 ? `🔥 ${streak} Tage in Folge` : 'Noch keine Serie'),
        ]),
        App.el('button', { class: 'icon-btn', onclick: () => this.remove(h) }, '🗑️'),
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

  async toggleLog(habitId, dateIso) {
    const logs = await DB.getAll('habitLogs');
    const existing = logs.find((l) => l.habitId === habitId && l.date === dateIso);
    if (existing) {
      await DB.delete('habitLogs', existing.id);
    } else {
      await DB.put('habitLogs', { id: DB.uid(), habitId, date: dateIso });
    }
    App.refresh();
  },

  async remove(h) {
    await DB.delete('habits', h.id);
    const logs = await DB.getAll('habitLogs');
    for (const l of logs.filter((x) => x.habitId === h.id)) {
      await DB.delete('habitLogs', l.id);
    }
    App.refresh();
  },

  openEditor(habit) {
    const isNew = !habit;
    const h = habit ? { ...habit } : { id: DB.uid(), name: '', createdAt: Date.now() };
    const nameInput = App.el('input', { type: 'text', value: h.name, placeholder: 'z.B. Lesen, Sport, Meditieren' });

    const content = App.el('div', {}, [
      App.el('h3', {}, isNew ? 'Neue Gewohnheit' : 'Gewohnheit bearbeiten'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Name'), nameInput]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            h.name = nameInput.value.trim();
            if (!h.name) { nameInput.focus(); return; }
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
