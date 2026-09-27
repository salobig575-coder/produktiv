const WorkoutSessionView = {
  state: {
    active: false,
    sessionId: null,
    workoutId: null,
    workoutName: '',
    exercises: [],
    currentExerciseIndex: 0,
    phase: 'active',
    restSecondsLeft: 0,
    restTotal: 90,
    intervalId: null,
    startedAt: null,
    elapsedSeconds: 0,
    finishedSummary: null,
  },

  async lastPerformance(exerciseId, excludeSessionId) {
    const sessions = await DB.getAll('workoutSessions');
    const past = sessions
      .filter((s) => s.id !== excludeSessionId && s.finishedAt)
      .sort((a, b) => b.finishedAt - a.finishedAt);
    for (const s of past) {
      const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
      if (ex && ex.sets.some((set) => set.completed)) return ex.sets.filter((set) => set.completed);
    }
    return null;
  },

  async start(workout) {
    const s = this.state;
    const sessionId = DB.uid();
    const exercises = [];
    for (const entry of workout.exercises) {
      const ex = await Exercises.byId(entry.exerciseId);
      const history = await this.lastPerformance(entry.exerciseId, sessionId);
      const sets = entry.sets.map((planned, i) => {
        const prev = history && history[i];
        return {
          targetReps: planned.reps, targetWeight: planned.weight,
          reps: prev ? prev.reps : planned.reps,
          weight: prev ? prev.weight : planned.weight,
          completed: false,
        };
      });
      exercises.push({ exerciseId: entry.exerciseId, exerciseName: ex ? ex.name : '(gelöschte Übung)', restSeconds: entry.restSeconds || 90, sets });
    }
    this._begin(sessionId, workout.id, workout.name, exercises);
  },

  async startAdhoc() {
    this._begin(DB.uid(), null, 'Ad-hoc-Workout', []);
  },

  _begin(sessionId, workoutId, workoutName, exercises) {
    clearInterval(this.state.intervalId);
    this.state = {
      active: true, sessionId, workoutId, workoutName, exercises,
      currentExerciseIndex: 0, phase: 'active', restSecondsLeft: 0, restTotal: 90,
      intervalId: setInterval(() => this.tick(), 1000),
      startedAt: Date.now(), elapsedSeconds: 0, finishedSummary: null,
    };
    App.refresh();
  },

  tick() {
    const s = this.state;
    if (!s.active || s.phase === 'finished') return;
    s.elapsedSeconds++;
    let phaseChanged = false;
    if (s.phase === 'resting') {
      s.restSecondsLeft--;
      if (s.restSecondsLeft <= 0) {
        s.phase = 'active';
        phaseChanged = true;
        if (navigator.vibrate) navigator.vibrate(120);
      }
    }
    const elEl = document.getElementById('sessElapsed');
    if (elEl) elEl.textContent = this.fmtTime(s.elapsedSeconds);
    const restEl = document.getElementById('sessRestLeft');
    if (restEl && s.phase === 'resting') restEl.textContent = this.fmtTime(Math.max(0, s.restSecondsLeft));
    if (phaseChanged && App.current === 'fitness' && FitnessHub.activeTab === 'workouts') App.refresh();
  },

  fmtTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const sc = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${sc}`;
  },

  stats() {
    const s = this.state;
    let totalSets = 0, doneSets = 0, volume = 0;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        totalSets++;
        if (set.completed) { doneSets++; volume += (set.reps || 0) * (set.weight || 0); }
      }
    }
    return { totalSets, doneSets, volume };
  },

  allDone() {
    const s = this.state;
    return s.exercises.length > 0 && s.exercises.every((ex) => ex.sets.every((set) => set.completed));
  },

  async completeSet(exIndex, setIndex) {
    const s = this.state;
    const set = s.exercises[exIndex].sets[setIndex];
    set.completed = true;

    if (this.allDone()) { await this.finish(); return; }

    const restSeconds = s.exercises[exIndex].restSeconds || 90;
    s.phase = 'resting';
    s.restSecondsLeft = restSeconds;
    s.restTotal = restSeconds;

    const curEx = s.exercises[exIndex];
    if (curEx.sets.every((set2) => set2.completed)) {
      const next = s.exercises.findIndex((ex, i) => i > exIndex && ex.sets.some((set2) => !set2.completed));
      if (next !== -1) s.currentExerciseIndex = next;
    }
    App.refresh();
  },

  uncompleteSet(exIndex, setIndex) {
    this.state.exercises[exIndex].sets[setIndex].completed = false;
    App.refresh();
  },

  skipRest() {
    this.state.phase = 'active';
    this.state.restSecondsLeft = 0;
    App.refresh();
  },

  addExerciseToSession() {
    const modalContent = App.el('div');
    let query = '';
    let muscle = 'all';
    const listBox = App.el('div', { class: 'list' });

    const rerenderList = async () => {
      listBox.innerHTML = '';
      const all = await Exercises.all();
      const q = query.trim().toLowerCase();
      const items = all.filter((ex) => (muscle === 'all' || ex.primaryMuscle === muscle) && (!q || ex.name.toLowerCase().includes(q)));
      for (const ex of items) {
        listBox.appendChild(App.el('div', { class: 'item', style: 'cursor:pointer', onclick: () => {
          this.state.exercises.push({ exerciseId: ex.id, exerciseName: ex.name, restSeconds: 90, sets: [
            { targetReps: 10, targetWeight: 0, reps: 10, weight: 0, completed: false },
            { targetReps: 10, targetWeight: 0, reps: 10, weight: 0, completed: false },
            { targetReps: 10, targetWeight: 0, reps: 10, weight: 0, completed: false },
          ] });
          this.state.currentExerciseIndex = this.state.exercises.length - 1;
          App.closeModal();
          App.refresh();
        } }, [
          App.el('div', { style: 'flex:1' }, [App.el('div', { class: 'item-title' }, ex.name), App.el('div', { class: 'item-meta' }, ex.primaryMuscle)]),
          App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px;color:var(--accent-fit)' }),
        ]));
      }
    };

    const search = App.el('input', { type: 'text', placeholder: 'Übung suchen…', oninput: (e) => { query = e.target.value; rerenderList(); } });
    const tabs = App.tabBar([{ key: 'all', label: 'Alle' }, ...MUSCLE_GROUPS.map((m) => ({ key: m, label: m }))], muscle, (key) => { muscle = key; rerenderList(); });

    modalContent.appendChild(App.el('h3', {}, 'Übung hinzufügen'));
    modalContent.appendChild(App.el('div', { class: 'field' }, [search]));
    modalContent.appendChild(tabs);
    modalContent.appendChild(listBox);
    App.showModal(modalContent);
    rerenderList();
  },

  cancel() {
    if (!confirm('Workout wirklich abbrechen? Der Fortschritt geht verloren.')) return;
    clearInterval(this.state.intervalId);
    this.state.active = false;
    App.refresh();
  },

  async finish() {
    const s = this.state;
    clearInterval(s.intervalId);
    s.phase = 'finished';

    const { totalSets, doneSets, volume } = this.stats();
    const prs = [];
    const sessions = await DB.getAll('workoutSessions');
    const pastCompleted = sessions.filter((x) => x.finishedAt);

    for (const ex of s.exercises) {
      let bestHistoric = 0;
      for (const past of pastCompleted) {
        const match = past.exercises.find((e) => e.exerciseId === ex.exerciseId);
        if (!match) continue;
        for (const set of match.sets) {
          if (!set.completed) continue;
          bestHistoric = Math.max(bestHistoric, Calc.estimatedOneRepMax(set.weight, set.reps));
        }
      }
      let bestNow = 0, bestSet = null;
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const e1rm = Calc.estimatedOneRepMax(set.weight, set.reps);
        if (e1rm > bestNow) { bestNow = e1rm; bestSet = set; }
      }
      if (bestSet && bestNow > bestHistoric && bestHistoric > 0) {
        prs.push({ name: ex.exerciseName, weight: bestSet.weight, reps: bestSet.reps, e1rm: bestNow });
      }
    }

    let previousVolume = null;
    if (s.workoutId) {
      const prevSession = pastCompleted.filter((x) => x.workoutId === s.workoutId).sort((a, b) => b.finishedAt - a.finishedAt)[0];
      if (prevSession) previousVolume = prevSession.totalVolume;
    }

    const record = {
      id: s.sessionId, workoutId: s.workoutId, workoutName: s.workoutName,
      startedAt: s.startedAt, finishedAt: Date.now(),
      exercises: s.exercises.map((ex) => ({ exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, sets: ex.sets })),
      totalVolume: volume,
    };
    await DB.put('workoutSessions', record);

    s.finishedSummary = { duration: s.elapsedSeconds, volume, totalSets, doneSets, exerciseCount: s.exercises.length, prs, previousVolume };
    App.refresh();
  },

  async render() {
    const s = this.state;
    if (s.phase === 'finished') return this.renderSummary();

    const wrap = App.el('div');
    const { totalSets, doneSets, volume } = this.stats();

    wrap.appendChild(App.el('div', { class: 'card hero' }, [
      App.el('h2', {}, s.workoutName),
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num', id: 'sessElapsed' }, this.fmtTime(s.elapsedSeconds)), App.el('div', { class: 'lbl' }, 'Zeit')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, `${doneSets}/${totalSets}`), App.el('div', { class: 'lbl' }, 'Sätze')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(Math.round(volume))), App.el('div', { class: 'lbl' }, 'Volumen (kg)')]),
      ]),
    ]));

    if (s.phase === 'resting') {
      wrap.appendChild(this.renderRest());
    }

    if (s.exercises.length > 0) {
      const chips = s.exercises.map((ex, i) => ({ key: String(i), label: (ex.sets.every((set) => set.completed) ? '✓ ' : '') + ex.exerciseName }));
      wrap.appendChild(App.tabBar(chips, String(s.currentExerciseIndex), (key) => { s.currentExerciseIndex = Number(key); App.refresh(); }));
      wrap.appendChild(this.renderExercise(s.exercises[s.currentExerciseIndex], s.currentExerciseIndex));
    } else {
      wrap.appendChild(App.el('div', { class: 'empty' }, [App.el('div', { class: 'empty-icon', html: Icons.fitness() }), 'Füge deine erste Übung hinzu.']));
    }

    wrap.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-top:4px', onclick: () => this.addExerciseToSession() }, [
      App.el('span', { html: Icons.plus(), style: 'width:16px;height:16px' }), 'Übung hinzufügen',
    ]));
    wrap.appendChild(App.el('div', { class: 'row', style: 'margin-top:10px;gap:10px' }, [
      App.el('button', { class: 'btn secondary', onclick: () => this.cancel() }, 'Abbrechen'),
      App.el('button', { class: 'btn', onclick: () => this.finish() }, 'Workout beenden'),
    ]));

    return wrap;
  },

  renderRest() {
    const s = this.state;
    const circumference = 2 * Math.PI * 42;
    const frac = s.restTotal > 0 ? s.restSecondsLeft / s.restTotal : 0;
    return App.el('div', { class: 'card', style: 'text-align:center' }, [
      App.el('h2', {}, 'Pause'),
      App.el('div', { class: 'timer-ring-wrap running', style: 'width:140px;height:140px' }, [
        App.el('div', {
          html: `<svg viewBox="0 0 100 100"><circle class="timer-ring-bg" cx="50" cy="50" r="42"/><circle class="timer-ring-progress" cx="50" cy="50" r="42" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - frac)}"/></svg>`,
        }),
        App.el('div', { class: 'timer-center' }, [App.el('div', { class: 'timer-display', id: 'sessRestLeft', style: 'font-size:28px' }, this.fmtTime(s.restSecondsLeft))]),
      ]),
      App.el('button', { class: 'btn secondary', style: 'margin-top:12px', onclick: () => this.skipRest() }, 'Pause überspringen'),
    ]);
  },

  renderExercise(ex, exIndex) {
    const box = App.el('div', { class: 'card' });
    box.appendChild(App.el('h2', {}, `Satz ${ex.sets.filter((s) => s.completed).length + 1 <= ex.sets.length ? ex.sets.filter((s) => s.completed).length + 1 : ex.sets.length} von ${ex.sets.length}`));

    const list = App.el('div', { class: 'list' });
    ex.sets.forEach((set, si) => {
      const repsInput = App.el('input', { type: 'number', value: set.reps, style: 'text-align:center', disabled: set.completed });
      repsInput.addEventListener('input', (e) => { set.reps = Number(e.target.value) || 0; });
      const weightInput = App.el('input', { type: 'number', value: set.weight, step: '0.5', style: 'text-align:center', disabled: set.completed });
      weightInput.addEventListener('input', (e) => { set.weight = Number(e.target.value) || 0; });
      list.appendChild(App.el('div', { class: 'item' + (set.completed ? ' done' : '') }, [
        App.el('button', {
          class: 'checkbox' + (set.completed ? ' checked' : ''), html: Icons.check(),
          onclick: (e) => {
            if (set.completed) { this.uncompleteSet(exIndex, si); return; }
            e.currentTarget.classList.add('pop');
            this.completeSet(exIndex, si);
          },
        }),
        App.el('span', { class: 'tag', style: 'width:44px' }, `Satz ${si + 1}`),
        repsInput, App.el('span', { class: 'tag' }, 'Wdh'),
        weightInput, App.el('span', { class: 'tag' }, 'kg'),
      ]));
    });
    box.appendChild(list);
    return box;
  },

  renderSummary() {
    const sum = this.state.finishedSummary;
    const wrap = App.el('div');

    wrap.appendChild(App.el('div', { class: 'card hero', style: 'text-align:center' }, [
      App.el('div', { style: 'font-size:15px;font-weight:700;opacity:.85' }, '🎉 Workout abgeschlossen'),
      App.el('div', { style: 'font-size:36px;font-weight:800;margin:8px 0' }, this.fmtTime(sum.duration)),
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(Math.round(sum.volume))), App.el('div', { class: 'lbl' }, 'kg Volumen')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(sum.doneSets)), App.el('div', { class: 'lbl' }, 'Sätze')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(sum.exerciseCount)), App.el('div', { class: 'lbl' }, 'Übungen')]),
      ]),
    ]));

    if (sum.previousVolume != null) {
      const diff = Math.round(sum.volume - sum.previousVolume);
      wrap.appendChild(App.el('div', { class: 'card' }, [
        App.el('h2', {}, 'Im Vergleich zum letzten Mal'),
        App.el('div', { style: `font-size:20px;font-weight:800;color:${diff >= 0 ? 'var(--success)' : 'var(--danger)'}` }, `${diff >= 0 ? '+' : ''}${diff} kg Volumen`),
      ]));
    }

    if (sum.prs.length > 0) {
      const card = App.el('div', { class: 'card' }, [App.el('h2', {}, [App.el('span', { html: Icons.trophy(), style: 'width:14px;height:14px' }), 'Neue persönliche Rekorde'])]);
      const list = App.el('div', { class: 'list' });
      for (const pr of sum.prs) {
        list.appendChild(App.el('div', { class: 'item' }, [
          App.el('span', { html: Icons.trophy(), style: 'width:20px;height:20px;color:var(--warn)' }),
          App.el('div', { style: 'flex:1' }, [App.el('div', { class: 'item-title' }, pr.name), App.el('div', { class: 'item-meta' }, `${pr.weight} kg × ${pr.reps} Wdh`)]),
        ]));
      }
      card.appendChild(list);
      wrap.appendChild(card);
    }

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => { this.state.active = false; App.refresh(); } }, 'Fertig'));
    return wrap;
  },
};
