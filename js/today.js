const TodayView = {
  // Leichte Listenzeile statt eigener Box – hält den Tab ruhig.
  line({ check, checked, onCheck, title, meta, right, onClick, swipe, menu }) {
    const row = App.el('div', { class: 'line' }, [
      check ? App.el('button', { class: 'checkbox' + (checked ? ' checked' : ''), html: Icons.check(), onclick: (e) => { e.currentTarget.classList.add('checked', 'pop'); App.confetti(e.currentTarget, 10); onCheck(); } }) : App.el('span', { class: 'line-dot' }),
      App.el('div', { class: 'line-main', style: onClick ? 'cursor:pointer' : '', onclick: onClick }, [
        App.el('div', { class: 'item-title' }, title),
        meta ? App.el('div', { class: 'tag' }, meta) : null,
      ]),
      right ? App.el('div', { class: 'line-right' }, right) : null,
    ]);
    if (menu) Gestures.longPress(row, menu);
    return swipe ? Gestures.swipeable(row, swipe) : row;
  },

  async render() {
    const wrap = App.el('div');
    const today = App.todayStr();
    const data = await Planner.load();
    const now = Planner.nowMin();
    const openCount = data.tasks.filter((t) => !t.done).length;

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

    // Begrüßung ohne Karte
    const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.appendChild(App.el('div', { class: 'today-head' }, [
      App.el('div', { class: 'today-greet' }, `${App.greeting()} 👋`),
      App.el('div', { class: 'tag' }, `${dateLabel} · ${openCount} offen`),
    ]));

    wrap.appendChild(await this.nowCard(today, data));
    const trainingCard = await this.trainingCard(today);
    if (trainingCard) wrap.appendChild(trainingCard);

    // Eine Karte für alles, was heute noch ansteht: Blöcke, fällige Aufgaben, Gewohnheiten
    const items = Planner.dayItems(today, data).filter((i) => !i.done && i.end > now && !(i.start <= now));
    const planned = new Set(Planner.dayItems(today, data).filter((i) => i.type === 'task').map((i) => i.id));
    const due = data.tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today && !planned.has(t.id)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const looseHabits = data.habits.filter((h) => !h.window).sort((a, b) => HabitsView.orderOf(a) - HabitsView.orderOf(b));
    const todayCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.tasks(), style: 'width:14px;height:14px' }), 'Heute noch']),
    ]);
    const list = App.el('div', { class: 'line-list' });
    for (const it of items.slice(0, 4)) {
      const time = App.el('span', { class: 'pill' }, Planner.fmt(it.start));
      if (it.type === 'task') list.appendChild(this.line({ check: true, onCheck: async () => { it.ref.done = true; it.ref.updatedAt = Date.now(); await DB.put('tasks', it.ref); await Planner.spawnNext(it.ref); setTimeout(() => App.refresh(), 200); }, title: it.title, meta: Planner.fmtDur(it.dur), right: time, onClick: () => TasksView.openEditor(it.ref), swipe: TasksView.swipeCfg(it.ref), menu: () => Gestures.actionSheet(it.title, TasksView.actionsFor(it.ref)) }));
      else if (it.type === 'habit') list.appendChild(this.line({ check: true, onCheck: async () => { await HabitsView.toggleLog(it.id, today); }, title: it.title, meta: Planner.fmtDur(it.dur), right: time, swipe: { right: { label: '✓ Abhaken', color: '#16a34a', fn: () => HabitsView.toggleLog(it.id, today) } } }));
      else list.appendChild(this.line({ title: it.title, meta: Planner.fmtDur(it.dur), right: time, onClick: () => { PlanenHub.activeTab = 'calendar'; CalendarView.selectedDate = today; App.navigate('planen'); } }));
    }
    for (const t of due.slice(0, 3)) {
      list.appendChild(this.line({
        check: true, onCheck: async () => { t.done = true; t.updatedAt = Date.now(); await DB.put('tasks', t); await Planner.spawnNext(t); setTimeout(() => App.refresh(), 200); },
        title: t.title, right: App.el('span', { class: 'pill' + (t.dueDate < today ? ' overdue' : '') }, t.dueDate < today ? 'überfällig' : 'fällig'), onClick: () => TasksView.openEditor(t), swipe: TasksView.swipeCfg(t), menu: () => Gestures.actionSheet(t.title, TasksView.actionsFor(t)),
      }));
    }
    if (list.childNodes.length === 0 && looseHabits.length === 0) {
      todayCard.appendChild(App.el('div', { class: 'empty', style: 'padding:14px 10px' }, 'Nichts mehr offen 🎉'));
    } else if (list.childNodes.length) {
      todayCard.appendChild(list);
    }
    if (looseHabits.length) {
      const chips = App.el('div', { class: 'chip-row' });
      for (const h of looseHabits) {
        const done = data.logs.some((l) => l.habitId === h.id && l.date === today);
        chips.appendChild(App.el('button', { class: 'chip' + (done ? ' on' : ''), onclick: async () => { await HabitsView.toggleLog(h.id, today); } }, [
          App.el('span', { class: 'chip-dot' }), App.el('span', { class: 'chip-text' }, h.name),
        ]));
      }
      todayCard.appendChild(App.el('div', { class: 'tag', style: 'margin:' + (list.childNodes.length ? '14px' : '0') + ' 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em' }, 'Gewohnheiten'));
      todayCard.appendChild(chips);
    }
    todayCard.appendChild(App.el('button', { class: 'link-btn', onclick: () => { PlanenHub.activeTab = 'calendar'; CalendarView.selectedDate = today; CalendarView.mode = 'day'; App.navigate('planen'); } }, [
      'Kalender öffnen', App.el('span', { html: Icons.arrowRight(), style: 'width:14px;height:14px' }),
    ]));
    wrap.appendChild(todayCard);

    // Fitness und Fokus in einer kompakten Karte
    const fitSessions = (await DB.getAll('workoutSessions')).filter((s) => s.finishedAt);
    const streak = typeof ProgressView !== 'undefined' ? ProgressView.trainingStreak(fitSessions) : 0;
    const workoutsThisWeek = fitSessions.filter((s) => s.finishedAt >= Date.now() - 6 * 86400000).length;
    const weightEnabled = typeof BodyMetrics !== 'undefined' && (await BodyMetrics.isEnabled());
    const latestWeight = weightEnabled ? await BodyMetrics.latest() : null;
    const sessions = await DB.getAll('focusSessions');
    const focusMin = Math.round(sessions.filter((x) => App.todayStr(new Date(x.startedAt)) === today).reduce((sum, x) => sum + x.duration, 0) / 60);
    const mini = (n, l) => {
      const num = App.el('div', { class: 'mini-num' }, String(n));
      if (typeof n === 'number' && n > 0) requestAnimationFrame(() => App.animateCounter(num, n, { from: 0, duration: 700 }));
      return App.el('div', { class: 'mini' }, [num, App.el('div', { class: 'mini-lbl' }, l)]);
    };
    const stepEntry = await StepsTracking.forDate(today);
    const stepGoal = await StepsTracking.goal();
    const steps = stepEntry ? stepEntry.steps : 0;
    const stepPct = stepGoal > 0 ? Math.min(100, Math.round((steps / stepGoal) * 100)) : 0;
    const pr = this.recentPR(fitSessions);
    wrap.appendChild(App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.bolt(), style: 'width:14px;height:14px' }), 'Fortschritt']),
      App.el('div', { class: 'mini-row' }, [
        mini(streak, 'Tage-Streak'), mini(workoutsThisWeek, 'Workouts'), mini(focusMin, 'Fokus-Min'),
        weightEnabled ? mini(latestWeight ? latestWeight.weight : '–', 'kg') : null,
      ]),
      // Schritte heute
      App.el('div', { style: 'margin-top:14px' }, [
        App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:6px' }, [
          App.el('div', { style: 'font-weight:800' }, [`${steps.toLocaleString('de-DE')}`, App.el('span', { class: 'tag', style: 'font-weight:600' }, ` / ${stepGoal.toLocaleString('de-DE')} Schritte`)]),
          App.el('span', { class: 'tag' }, stepEntry ? `${stepPct} %` : 'nicht erfasst'),
        ]),
        App.el('div', { class: 'load-bar' }, [App.el('div', { class: 'load-fill', style: `width:${stepPct}%` })]),
        App.el('div', { class: 'row', style: 'margin-top:10px' }, [
          App.el('button', { class: 'btn secondary', style: 'flex:1;margin:0;padding:9px 12px', onclick: async () => { await StepsTracking.log(today, steps + 1000); App.refresh(); } }, '+ 1.000'),
          App.el('button', { class: 'btn secondary', style: 'flex:1;margin:0;padding:9px 12px', onclick: () => StepsTracking.openEntry(today) }, 'Eintragen'),
        ]),
      ]),
      // Letzter Rekord
      pr ? App.el('div', { class: 'pr-strip', onclick: () => Exercises.showPersonalRecords(pr.id, pr.name) }, [
        App.el('span', { html: Icons.trophy(), style: 'width:20px;height:20px;flex:none;color:var(--warn)' }),
        App.el('div', { style: 'min-width:0;flex:1' }, [
          App.el('div', { style: 'font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, `Neuer Rekord: ${pr.name}`),
          App.el('div', { class: 'tag' }, `${String(pr.weight).replace('.', ',')} kg × ${pr.reps} · ${this.ago(pr.at)}`),
        ]),
      ]) : null,
      App.el('div', { class: 'row', style: 'margin-top:14px' }, [
        App.el('button', { class: 'btn secondary', style: 'flex:1;margin:0', onclick: () => { FitnessHub.activeTab = 'uebersicht'; App.navigate('fitness'); } }, 'Fitness'),
        App.el('button', { class: 'btn secondary', style: 'flex:1;margin:0', onclick: () => { PlanenHub.activeTab = 'focus'; App.navigate('planen'); } }, 'Fokus-Timer'),
      ]),
    ]));

    const notes = await DB.getAll('notes');
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    if (notes.length > 0) {
      const noteList = App.el('div', { class: 'line-list' });
      for (const n of notes.slice(0, 3)) {
        noteList.appendChild(this.line({ title: n.title || '(ohne Titel)', meta: (n.content || '').slice(0, 50), onClick: () => NotesView.openEditor(n) }));
      }
      wrap.appendChild(App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.notes(), style: 'width:14px;height:14px' }), 'Zuletzt bearbeitet']),
        noteList,
      ]));
    }

    return wrap;
  },

  ago(ts) {
    const d = Math.round((new Date(App.todayStr()).getTime() - new Date(App.todayStr(new Date(ts))).getTime()) / 86400000);
    return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`;
  },

  // Jüngster Rekord der letzten 14 Tage (geschätztes 1RM höher als alles Bisherige der Übung)
  recentPR(sessions) {
    const cutoff = Date.now() - 14 * 86400000;
    const best = {};
    let latest = null;
    for (const sess of sessions.slice().sort((a, b) => a.finishedAt - b.finishedAt)) {
      for (const ex of sess.exercises || []) {
        let bestNow = 0, bestSet = null;
        for (const set of ex.sets || []) {
          if (!set.completed || set.warmup) continue;
          const e = Calc.estimatedOneRepMax(set.weight, set.reps);
          if (e > bestNow) { bestNow = e; bestSet = set; }
        }
        const hist = best[ex.exerciseId] || 0;
        if (bestSet && hist > 0 && bestNow > hist && sess.finishedAt >= cutoff) {
          latest = { id: ex.exerciseId, name: ex.exerciseName, weight: bestSet.weight, reps: bestSet.reps, at: sess.finishedAt };
        }
        if (bestNow > hist) best[ex.exerciseId] = bestNow;
      }
    }
    return latest;
  },

  // Training heute: erledigtes Workout oder Vorschlag (am längsten nicht gemacht) mit Startknopf
  async trainingCard(today) {
    if (typeof WorkoutSessionView !== 'undefined' && WorkoutSessionView.state.active && WorkoutSessionView.state.phase !== 'finished') return null; // läuft bereits (Karte oben)
    const [sessions, workouts] = await Promise.all([DB.getAll('workoutSessions'), DB.getAll('workouts')]);
    const done = sessions.filter((x) => x.finishedAt);
    const todays = done.filter((x) => App.todayStr(new Date(x.finishedAt)) === today);
    const card = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.fitness(), style: 'width:14px;height:14px' }), 'Training heute']),
    ]);
    const openFitness = () => { FitnessHub.activeTab = 'workouts'; App.navigate('fitness', { animate: true }); };

    if (todays.length) {
      card.appendChild(App.el('div', { class: 'line-list' }, todays.map((x) => this.line({
        title: x.workoutName, meta: `${x.exerciseCount != null ? x.exerciseCount : x.exercises.length} Übungen · ${Math.round(x.totalVolume || 0)} kg Volumen`,
        right: App.el('span', { html: Icons.check(), style: 'width:20px;height:20px;color:var(--success);display:block' }),
        onClick: () => WorkoutSessionView.showSessionDetail(x),
      }))));
      return card;
    }

    if (!workouts.length) {
      card.appendChild(App.el('div', { class: 'tag', style: 'margin-bottom:12px' }, 'Noch kein Workout angelegt.'));
      card.appendChild(App.el('button', { class: 'btn secondary', style: 'margin:0', onclick: openFitness }, 'Workout erstellen'));
      return card;
    }

    // Vorschlag: das Workout, das am längsten nicht dran war (nie gemacht = zuerst)
    const last = {};
    for (const x of done) if (x.workoutId && (!last[x.workoutId] || x.finishedAt > last[x.workoutId])) last[x.workoutId] = x.finishedAt;
    const pick = workouts.slice().sort((a, b) => (last[a.id] || 0) - (last[b.id] || 0) || (a.createdAt || 0) - (b.createdAt || 0))[0];
    card.appendChild(App.el('div', { style: 'font-size:17px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, pick.name));
    card.appendChild(App.el('div', { class: 'tag', style: 'margin:2px 0 12px' }, [
      `${pick.exercises.length} Übungen`, last[pick.id] ? ` · zuletzt ${this.ago(last[pick.id])}` : ' · noch nie gemacht',
    ].join('')));
    card.appendChild(App.el('div', { class: 'row' }, [
      App.el('button', { class: 'btn', style: 'flex:1;margin:0', onclick: async () => { await WorkoutSessionView.start(pick); openFitness(); } }, 'Starten'),
      App.el('button', { class: 'btn secondary', style: 'flex:1;margin:0', onclick: () => WorkoutsView.openStartPicker() }, 'Anderes wählen'),
    ]));
    return card;
  },

  // „Was jetzt?“: aktueller Block, sonst der nächste – mit passender Aktion oder einem Vorschlag für freie Zeit.
  async nowCard(today, data) {
    const now = Planner.nowMin();
    const items = Planner.dayItems(today, data);
    const current = items.find((i) => !i.done && i.start <= now && now < i.end);
    const next = items.find((i) => !i.done && i.start > now);
    const card = App.el('div', { class: 'card', style: 'border-color:var(--accent)' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.bolt(), style: 'width:14px;height:14px' }), 'Jetzt']),
    ]);
    const goFocus = (opts) => {
      if (!FocusView.prepare(opts)) { Planner.toast('Es läuft bereits ein Fokus.'); return; }
      PlanenHub.activeTab = 'focus';
      App.navigate('planen');
    };
    const btn = (label, fn, secondary) => App.el('button', { class: 'btn' + (secondary ? ' secondary' : ''), style: 'flex:1;margin:0', onclick: (e) => fn(e) }, label);
    const actions = (nodes) => card.appendChild(App.el('div', { class: 'row', style: 'margin-top:12px' }, nodes));

    if (current) {
      const pct = Math.round(((now - current.start) / (current.end - current.start)) * 100);
      card.appendChild(App.el('div', { style: 'font-size:19px;font-weight:800' }, current.title));
      card.appendChild(App.el('div', { class: 'tag', style: 'margin:2px 0 10px' }, `${Planner.fmt(current.start)}–${Planner.fmt(current.end)} · noch ${Planner.fmtDur(current.end - now)}`));
      card.appendChild(App.el('div', { class: 'load-bar' }, [App.el('div', { class: 'load-fill live', style: `width:${pct}%` })]));
      if (current.type === 'task') {
        actions([
          btn('Erledigt', async (e) => { App.confetti(e.currentTarget, 22); current.ref.done = true; current.ref.updatedAt = Date.now(); await DB.put('tasks', current.ref); await Planner.spawnNext(current.ref); setTimeout(() => App.refresh(), 450); }, true),
          btn('Fokus starten', () => goFocus({ minutes: Math.min(current.end - now, 120), intention: current.title, taskId: current.id })),
        ]);
      } else if (current.type === 'habit') {
        actions([btn('Abhaken', async () => { await HabitsView.toggleLog(current.id, today); })]);
      } else if (current.kind === 'focus') {
        actions([btn('Fokus starten', () => goFocus({ minutes: Math.min(current.end - now, 180), level: current.ref.level || 'normal', intention: current.title }))]);
      }
    } else {
      const gap = (next ? next.start : data.s.end) - now;
      const rank = { high: 0, normal: 1, low: 2 };
      const pick = Planner.inbox(data.tasks)
        .filter((t) => (t.duration || 30) <= gap)
        .sort((a, b) =>
          ((a.dueDate && a.dueDate <= today) ? 0 : 1) - ((b.dueDate && b.dueDate <= today) ? 0 : 1) ||
          rank[a.priority || 'normal'] - rank[b.priority || 'normal'] ||
          (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))[0];
      if (next) {
        card.appendChild(App.el('div', { class: 'tag' }, `Als Nächstes in ${Planner.fmtDur(next.start - now)}`));
        card.appendChild(App.el('div', { style: 'font-size:19px;font-weight:800;margin:2px 0' }, next.title));
        card.appendChild(App.el('div', { class: 'tag' }, `${Planner.fmt(next.start)}–${Planner.fmt(next.end)}`));
      } else if (items.length || data.tasks.some((t) => t.done)) {
        card.appendChild(App.el('div', { style: 'font-size:17px;font-weight:800' }, now >= data.s.end ? 'Feierabend 🎉' : 'Für heute ist alles Geplante erledigt 🎉'));
      } else {
        card.appendChild(App.el('div', { class: 'tag' }, 'Noch nichts geplant.'));
      }
      if (pick) {
        const dur = pick.duration || 30;
        card.appendChild(App.el('div', { style: 'margin-top:14px;padding-top:12px;border-top:1px solid var(--border)' }, [
          App.el('div', { class: 'tag' }, `Freie Zeit: ${Planner.fmtDur(gap)} – Vorschlag`),
          App.el('div', { class: 'item-title', style: 'margin-top:2px' }, pick.title),
        ]));
        actions([btn(`Jetzt starten (${Planner.fmtDur(dur)})`, async () => {
          pick.planDate = today;
          pick.planStart = Math.floor(now / 5) * 5;
          pick.duration = dur;
          pick.updatedAt = Date.now();
          await DB.put('tasks', pick);
          goFocus({ minutes: dur, intention: pick.title, taskId: pick.id });
        })]);
      } else if (!next && !items.length) {
        actions([btn('Zum Kalender', () => { PlanenHub.activeTab = 'calendar'; CalendarView.selectedDate = today; App.navigate('planen'); }, true)]);
      }
    }
    return card;
  },
};
