const TodayView = {
  async render() {
    const wrap = App.el('div');
    const today = App.todayStr();

    const tasks = await DB.getAll('tasks');
    const dueToday = tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today);
    dueToday.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const openCount = tasks.filter((t) => !t.done).length;

    if (typeof WorkoutSessionView !== 'undefined' && WorkoutSessionView.state.active && WorkoutSessionView.state.phase !== 'finished') {
      const sState = WorkoutSessionView.state;
      wrap.appendChild(App.el('div', { class: 'card hero', onclick: () => { FitnessHub.activeTab = 'workouts'; App.navigate('fitness'); }, style: 'cursor:pointer' }, [
        App.el('div', { class: 'row', style: 'justify-content:space-between' }, [
          App.el('div', {}, [
            App.el('div', { style: 'font-weight:800;font-size:16px' }, `🏋️ ${sState.workoutName} läuft`),
            App.el('div', { style: 'font-size:13px;opacity:.85' }, WorkoutSessionView.fmtTime(sState.elapsedSeconds) + ' · weiter tippen'),
          ]),
          App.el('span', { html: Icons.arrowRight(), style: 'width:20px;height:20px' }),
        ]),
      ]));
    }

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

    if (typeof Planner !== 'undefined') {
      const pdata = await Planner.load();
      const nowMin = Planner.nowMin();
      const upcoming = Planner.dayItems(today, pdata).filter((i) => !i.done && i.end > nowMin).slice(0, 4);
      const planCard = App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.planen(), style: 'width:14px;height:14px' }), 'Heutiger Plan']),
      ]);
      if (upcoming.length === 0) {
        planCard.appendChild(App.el('div', { class: 'empty', style: 'padding:16px 10px' }, 'Nichts mehr geplant.'));
      } else {
        planCard.appendChild(App.el('div', { class: 'list' }, upcoming.map((i) => App.el('div', { class: 'item' }, [
          App.el('div', { class: 'pill' + (i.start <= nowMin ? ' active' : '') }, Planner.fmt(i.start)),
          App.el('div', { style: 'flex:1;min-width:0' }, [
            App.el('div', { class: 'item-title' }, i.title),
            App.el('div', { class: 'tag' }, Planner.fmtDur(i.dur)),
          ]),
        ]))));
      }
      planCard.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-top:12px', onclick: () => { PlanenHub.activeTab = 'calendar'; CalendarView.selectedDate = today; CalendarView.mode = 'day'; App.navigate('planen'); } }, [
        'Zum Kalender', App.el('span', { html: Icons.arrowRight(), style: 'width:16px;height:16px' }),
      ]));
      wrap.appendChild(planCard);
    }

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
          App.el('button', { class: 'checkbox', html: Icons.check(), onclick: async (e) => { e.currentTarget.classList.add('checked', 'pop'); t.done = true; await DB.put('tasks', t); await Planner.spawnNext(t); setTimeout(() => App.refresh(), 200); } }),
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

    const fitSessions = (await DB.getAll('workoutSessions')).filter((s) => s.finishedAt);
    const streak = typeof ProgressView !== 'undefined' ? ProgressView.trainingStreak(fitSessions) : 0;
    const weekAgoTs = Date.now() - 6 * 86400000;
    const workoutsThisWeek = fitSessions.filter((s) => s.finishedAt >= weekAgoTs).length;
    const weightEnabled = typeof BodyMetrics !== 'undefined' && (await BodyMetrics.isEnabled());
    const latestWeight = weightEnabled ? await BodyMetrics.latest() : null;

    const fitCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.fitness(), style: 'width:14px;height:14px' }), 'Fitness']),
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(streak)), App.el('div', { class: 'lbl' }, 'Tage-Streak')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(workoutsThisWeek)), App.el('div', { class: 'lbl' }, 'Workouts/Woche')]),
        weightEnabled ? App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, latestWeight ? String(latestWeight.weight) : '–'), App.el('div', { class: 'lbl' }, 'Gewicht (kg)')]) : null,
      ]),
      App.el('button', { class: 'btn', style: 'margin-top:12px', onclick: () => { FitnessHub.activeTab = 'uebersicht'; App.navigate('fitness'); } }, [
        'Zum Fitness-Bereich', App.el('span', { html: Icons.arrowRight(), style: 'width:16px;height:16px' }),
      ]),
    ]);
    wrap.appendChild(fitCard);

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
      App.el('button', { class: 'btn secondary', style: 'margin-top:12px', onclick: () => { PlanenHub.activeTab = 'focus'; App.navigate('planen'); } }, [
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
