const TodayView = {
  async render() {
    const wrap = App.el('div');
    const today = App.todayStr();

    const tasks = await DB.getAll('tasks');
    const dueToday = tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today);
    dueToday.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const openCount = tasks.filter((t) => !t.done).length;

    const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.appendChild(App.el('div', { class: 'card hero' }, [
      App.el('h2', {}, 'Übersicht'),
      App.el('div', { style: 'font-size:19px;font-weight:800;margin-bottom:2px' }, `${App.greeting()} 👋`),
      App.el('div', { style: 'font-size:13px;opacity:.85;margin-bottom:14px' }, dateLabel),
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [
          App.el('div', { class: 'num' }, String(openCount)),
          App.el('div', { class: 'lbl' }, 'Offene Aufgaben'),
        ]),
        App.el('div', { class: 'stat' }, [
          App.el('div', { class: 'num' }, String(dueToday.length)),
          App.el('div', { class: 'lbl' }, 'Heute fällig'),
        ]),
      ]),
    ]));

    const taskCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.tasks(), style: 'width:14px;height:14px' }), 'Fällige Aufgaben']),
    ]);
    if (dueToday.length === 0) {
      taskCard.appendChild(App.el('div', { class: 'empty', style: 'padding:16px 10px' }, 'Nichts Fälliges — gut gemacht 🎉'));
    } else {
      const list = App.el('div', { class: 'list' });
      for (const t of dueToday.slice(0, 6)) {
        const overdue = t.dueDate < today;
        list.appendChild(App.el('div', { class: 'item' }, [
          App.el('button', { class: 'checkbox', html: Icons.check(), onclick: async (e) => { e.currentTarget.classList.add('checked', 'pop'); t.done = true; await DB.put('tasks', t); setTimeout(() => App.refresh(), 200); } }),
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
      const habitCard = App.el('div', { class: 'card' }, [App.el('h2', {}, [App.el('span', { html: Icons.habits(), style: 'width:14px;height:14px' }), 'Heutige Gewohnheiten'])]);
      const list = App.el('div', { class: 'list' });
      for (const h of habits) {
        const done = logs.some((l) => l.habitId === h.id && l.date === today);
        list.appendChild(App.el('div', { class: 'item' }, [
          App.el('button', {
            class: 'checkbox' + (done ? ' checked' : ''),
            html: Icons.check(),
            onclick: async (e) => {
              e.currentTarget.classList.add('pop');
              const existing = logs.find((l) => l.habitId === h.id && l.date === today);
              if (existing) await DB.delete('habitLogs', existing.id);
              else await DB.put('habitLogs', { id: DB.uid(), habitId: h.id, date: today });
              setTimeout(() => App.refresh(), 200);
            },
          }),
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
      App.el('h2', {}, [App.el('span', { html: Icons.focus(), style: 'width:14px;height:14px' }), 'Fokuszeit']),
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
      App.el('button', { class: 'btn secondary', style: 'margin-top:12px', onclick: () => App.navigate('focus') }, [
        'Zum Fokus-Timer', App.el('span', { html: Icons.arrowRight(), style: 'width:16px;height:16px' }),
      ]),
    ]);
    wrap.appendChild(focusCard);

    const notes = await DB.getAll('notes');
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    if (notes.length > 0) {
      const noteCard = App.el('div', { class: 'card' }, [App.el('h2', {}, [App.el('span', { html: Icons.notes(), style: 'width:14px;height:14px' }), 'Zuletzt bearbeitete Notizen'])]);
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
