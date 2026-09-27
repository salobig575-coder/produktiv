const TodayView = {
  async render() {
    const wrap = App.el('div');
    const today = App.todayStr();

    const tasks = await DB.getAll('tasks');
    const dueToday = tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today);
    dueToday.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const taskCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, 'Fällige Aufgaben'),
    ]);
    if (dueToday.length === 0) {
      taskCard.appendChild(App.el('div', { class: 'empty' }, 'Nichts Fälliges — gut gemacht 🎉'));
    } else {
      const list = App.el('div', { class: 'list' });
      for (const t of dueToday.slice(0, 6)) {
        const overdue = t.dueDate < today;
        list.appendChild(App.el('div', { class: 'item' }, [
          App.el('button', { class: 'checkbox', onclick: async () => { t.done = true; await DB.put('tasks', t); App.refresh(); } }, ''),
          App.el('div', { style: 'flex:1' }, [
            App.el('div', { class: 'item-title' }, t.title),
            App.el('span', { class: 'pill' + (overdue ? ' overdue' : '') }, App.formatDate(t.dueDate)),
          ]),
        ]));
      }
      taskCard.appendChild(list);
    }
    wrap.appendChild(taskCard);

    const habits = await DB.getAll('habits');
    if (habits.length > 0) {
      const logs = await DB.getAll('habitLogs');
      const habitCard = App.el('div', { class: 'card' }, [App.el('h2', {}, 'Heutige Gewohnheiten')]);
      const list = App.el('div', { class: 'list' });
      for (const h of habits) {
        const done = logs.some((l) => l.habitId === h.id && l.date === today);
        list.appendChild(App.el('div', { class: 'item' }, [
          App.el('button', {
            class: 'checkbox' + (done ? ' checked' : ''),
            onclick: async () => {
              const existing = logs.find((l) => l.habitId === h.id && l.date === today);
              if (existing) await DB.delete('habitLogs', existing.id);
              else await DB.put('habitLogs', { id: DB.uid(), habitId: h.id, date: today });
              App.refresh();
            },
          }, done ? '✓' : ''),
          App.el('div', { class: 'item-title' }, h.name),
        ]));
      }
      habitCard.appendChild(list);
      wrap.appendChild(habitCard);
    }

    const sessions = await DB.getAll('focusSessions');
    const todaysSessions = sessions.filter((s) => App.todayStr(new Date(s.startedAt)) === today);
    const focusMin = Math.round(todaysSessions.reduce((sum, s) => sum + s.duration, 0) / 60);
    const focusCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, 'Fokuszeit'),
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [
          App.el('div', { class: 'num' }, String(focusMin)),
          App.el('div', { class: 'lbl' }, 'Minuten heute'),
        ]),
        App.el('div', { class: 'stat' }, [
          App.el('div', { class: 'num' }, String(todaysSessions.length)),
          App.el('div', { class: 'lbl' }, 'Sessions'),
        ]),
      ]),
      App.el('button', { class: 'btn secondary', style: 'margin-top:10px', onclick: () => App.navigate('focus') }, 'Zum Fokus-Timer →'),
    ]);
    wrap.appendChild(focusCard);

    const notes = await DB.getAll('notes');
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    if (notes.length > 0) {
      const noteCard = App.el('div', { class: 'card' }, [App.el('h2', {}, 'Zuletzt bearbeitete Notizen')]);
      const list = App.el('div', { class: 'list' });
      for (const n of notes.slice(0, 3)) {
        list.appendChild(App.el('div', { class: 'item', style: 'cursor:pointer', onclick: () => NotesView.openEditor(n) }, [
          App.el('div', { class: 'item-title' }, n.title || '(ohne Titel)'),
        ]));
      }
      noteCard.appendChild(list);
      wrap.appendChild(noteCard);
    }

    return wrap;
  },
};
