const WorkoutSessionView = {
  state: {
    active: false,
    sessionId: null,
    workoutId: null,
    workoutName: '',
    workoutTag: '',
    exercises: [],
    currentExerciseIndex: 0,
    phase: 'active',
    restSecondsLeft: 0,
    restTotal: 90,
    intervalId: null,
    startedAt: null,
    elapsedSeconds: 0,
    finishedSummary: null,
    settings: { showRIR: false, trackWarmupSets: false },
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

  async _readSettings() {
    const [rir, warm] = await Promise.all([DB.get('settings', 'showRIR'), DB.get('settings', 'trackWarmupSets')]);
    return { showRIR: rir ? !!rir.value : false, trackWarmupSets: warm ? !!warm.value : false };
  },

  async start(workout) {
    const sessionId = DB.uid();
    const sessSettings = await this._readSettings();
    const exercises = [];
    for (const entry of workout.exercises) {
      const ex = await Exercises.byId(entry.exerciseId);
      const history = await this.lastPerformance(entry.exerciseId, sessionId);
      const sets = entry.sets.map((planned, i) => {
        const prev = history && history[i];
        const baseReps = prev ? prev.reps : planned.reps;
        const baseWeight = prev ? prev.weight : planned.weight;
        return {
          targetReps: baseReps, targetWeight: baseWeight,
          reps: baseReps, weight: baseWeight,
          rir: null, warmup: planned.warmup || false,
          completed: false,
        };
      });
      exercises.push({ exerciseId: entry.exerciseId, exerciseName: ex ? ex.name : '(gelöschte Übung)', restSeconds: entry.restSeconds || 90, sets });
    }
    this._begin(sessionId, workout.id, workout.name, exercises, workout.tag || '', sessSettings);
  },

  async startAdhoc() {
    const sessSettings = await this._readSettings();
    this._begin(DB.uid(), null, 'Ad-hoc-Workout', [], '', sessSettings);
  },

  _begin(sessionId, workoutId, workoutName, exercises, workoutTag, sessSettings) {
    clearInterval(this.state.intervalId);
    this.state = {
      active: true, sessionId, workoutId, workoutName, workoutTag: workoutTag || '', exercises,
      currentExerciseIndex: 0, phase: 'active', restSecondsLeft: 0, restTotal: 90,
      intervalId: setInterval(() => this.tick(), 1000),
      startedAt: Date.now(), elapsedSeconds: 0, finishedSummary: null,
      settings: sessSettings || { showRIR: false, trackWarmupSets: false },
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
    let totalSets = 0, doneSets = 0, volume = 0, reps = 0;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        totalSets++;
        if (set.completed) {
          doneSets++;
          if (!set.warmup) { volume += (set.reps || 0) * (set.weight || 0); reps += (set.reps || 0); }
        }
      }
    }
    return { totalSets, doneSets, volume, reps };
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
    const tabSlot = App.el('div');

    const rerenderList = async () => {
      listBox.innerHTML = '';
      const all = await Exercises.all();
      const q = query.trim().toLowerCase();
      const items = all.filter((ex) => (muscle === 'all' || ex.primaryMuscle === muscle) && (!q || ex.name.toLowerCase().includes(q)));
      const LIMIT = 60;
      for (const ex of items.slice(0, LIMIT)) {
        const thumb = ex.images && ex.images[0]
          ? App.el('img', { src: ex.images[0], style: 'width:40px;height:40px;object-fit:cover;border-radius:9px;flex-shrink:0;background:var(--surface-2)' })
          : null;
        listBox.appendChild(App.el('div', { class: 'item', style: 'cursor:pointer', onclick: () => {
          this.state.exercises.push({ exerciseId: ex.id, exerciseName: ex.name, restSeconds: 90, sets: [
            { targetReps: 10, targetWeight: 0, reps: 10, weight: 0, rir: null, warmup: false, completed: false },
            { targetReps: 10, targetWeight: 0, reps: 10, weight: 0, rir: null, warmup: false, completed: false },
            { targetReps: 10, targetWeight: 0, reps: 10, weight: 0, rir: null, warmup: false, completed: false },
          ] });
          this.state.currentExerciseIndex = this.state.exercises.length - 1;
          App.closeModal();
          App.refresh();
        } }, [
          thumb,
          App.el('div', { style: 'flex:1;min-width:0' }, [App.el('div', { class: 'item-title' }, ex.name), App.el('div', { class: 'item-meta' }, ex.primaryMuscle)]),
          App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px;color:var(--accent);flex-shrink:0' }),
        ]));
      }
      if (items.length > LIMIT) {
        listBox.appendChild(App.el('div', { class: 'empty', style: 'padding:12px 10px' }, `${LIMIT} von ${items.length} angezeigt — Suche verfeinern.`));
      }
    };

    const renderTabs = () => {
      tabSlot.innerHTML = '';
      tabSlot.appendChild(App.tabBar([{ key: 'all', label: 'Alle' }, ...MUSCLE_GROUPS.map((m) => ({ key: m, label: m }))], muscle, (key) => { muscle = key; renderTabs(); rerenderList(); }));
    };

    const search = App.el('input', { type: 'text', placeholder: 'Übung suchen…', oninput: (e) => { query = e.target.value; rerenderList(); } });

    modalContent.appendChild(App.el('h3', {}, 'Übung hinzufügen'));
    modalContent.appendChild(App.el('div', { class: 'field' }, [search]));
    renderTabs();
    modalContent.appendChild(tabSlot);
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

    const { doneSets, volume, reps } = this.stats();
    const prs = [];
    const sessions = await DB.getAll('workoutSessions');
    const pastCompleted = sessions.filter((x) => x.finishedAt);

    for (const ex of s.exercises) {
      let bestHistoric = 0;
      for (const past of pastCompleted) {
        const match = past.exercises.find((e) => e.exerciseId === ex.exerciseId);
        if (!match) continue;
        for (const set of match.sets) {
          if (!set.completed || set.warmup) continue;
          bestHistoric = Math.max(bestHistoric, Calc.estimatedOneRepMax(set.weight, set.reps));
        }
      }
      let bestNow = 0, bestSet = null;
      for (const set of ex.sets) {
        if (!set.completed || set.warmup) continue;
        const e1rm = Calc.estimatedOneRepMax(set.weight, set.reps);
        if (e1rm > bestNow) { bestNow = e1rm; bestSet = set; }
      }
      if (bestSet && bestNow > bestHistoric && bestHistoric > 0) {
        prs.push({ name: ex.exerciseName, weight: bestSet.weight, reps: bestSet.reps, e1rm: bestNow });
      }
    }

    let prevStats = null;
    if (s.workoutId) {
      const prevSession = pastCompleted.filter((x) => x.workoutId === s.workoutId).sort((a, b) => b.finishedAt - a.finishedAt)[0];
      if (prevSession) {
        prevStats = {
          volume: prevSession.totalVolume || 0,
          sets: prevSession.totalSets != null ? prevSession.totalSets : prevSession.exercises.reduce((sum2, e) => sum2 + e.sets.filter((st) => st.completed).length, 0),
          reps: prevSession.totalReps != null ? prevSession.totalReps : prevSession.exercises.reduce((sum2, e) => sum2 + e.sets.filter((st) => st.completed && !st.warmup).reduce((s2, st) => s2 + (st.reps || 0), 0), 0),
          exercises: prevSession.exerciseCount != null ? prevSession.exerciseCount : prevSession.exercises.length,
        };
      }
    }

    const record = {
      id: s.sessionId, workoutId: s.workoutId, workoutName: s.workoutName, workoutTag: s.workoutTag || '',
      startedAt: s.startedAt, finishedAt: Date.now(),
      exercises: s.exercises.map((ex) => ({ exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, sets: ex.sets })),
      totalVolume: volume, totalReps: reps, totalSets: doneSets, exerciseCount: s.exercises.length,
    };
    await DB.put('workoutSessions', record);

    s.finishedSummary = { duration: s.elapsedSeconds, volume, reps, doneSets, exerciseCount: s.exercises.length, prs, prevStats };
    App.refresh();
  },

  async render() {
    const s = this.state;
    if (s.phase === 'finished') return this.renderSummary();

    const wrap = App.el('div');
    const { totalSets, doneSets, volume } = this.stats();

    wrap.appendChild(App.el('div', { class: 'card hero' }, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:2px' }, [
        App.el('h2', { style: 'margin:0' }, s.workoutName),
        s.workoutTag ? App.el('span', { class: 'pill', style: 'background:rgba(255,255,255,.22);color:#fff' }, s.workoutTag) : null,
      ]),
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
    const updateDelta = (span, diff) => {
      span.innerHTML = '';
      const d = App.delta(diff);
      if (d) span.appendChild(d);
    };
    const showRIR = !!(this.state.settings && this.state.settings.showRIR);
    const trackWarmup = !!(this.state.settings && this.state.settings.trackWarmupSets);

    ex.sets.forEach((set, si) => {
      const repsInput = App.el('input', { type: 'number', value: set.reps, style: 'text-align:center', disabled: set.completed });
      const repsDelta = App.el('span', { style: 'display:inline-block;min-width:26px' });
      updateDelta(repsDelta, set.reps - set.targetReps);
      repsInput.addEventListener('input', (e) => { set.reps = Number(e.target.value) || 0; updateDelta(repsDelta, set.reps - set.targetReps); });

      const weightInput = App.el('input', { type: 'number', value: set.weight, step: '0.5', style: 'text-align:center', disabled: set.completed });
      const weightDelta = App.el('span', { style: 'display:inline-block;min-width:32px' });
      updateDelta(weightDelta, set.weight - set.targetWeight);
      weightInput.addEventListener('input', (e) => { set.weight = Number(e.target.value) || 0; updateDelta(weightDelta, set.weight - set.targetWeight); });

      const row = [
        App.el('button', {
          class: 'checkbox' + (set.completed ? ' checked' : ''), html: Icons.check(),
          onclick: (e) => {
            if (set.completed) { this.uncompleteSet(exIndex, si); return; }
            e.currentTarget.classList.add('pop');
            this.completeSet(exIndex, si);
          },
        }),
        App.el('span', { class: 'tag', style: 'width:44px' }, `Satz ${si + 1}`),
        weightInput, weightDelta, App.el('span', { class: 'tag' }, 'kg'),
        repsInput, repsDelta, App.el('span', { class: 'tag' }, 'Wdh'),
      ];
      if (showRIR) {
        const rirInput = App.el('input', { type: 'number', value: set.rir ?? '', placeholder: '–', style: 'text-align:center;width:48px', disabled: set.completed });
        rirInput.addEventListener('input', (e) => { set.rir = e.target.value === '' ? null : Number(e.target.value); });
        row.push(rirInput, App.el('span', { class: 'tag' }, 'RIR'));
      }
      if (trackWarmup) {
        row.push(App.el('button', {
          class: 'icon-btn' + (set.warmup ? ' active-warmup' : ''), title: 'Aufwärmsatz',
          html: Icons.flame(), onclick: () => { set.warmup = !set.warmup; App.refresh(); },
        }));
      }

      list.appendChild(App.el('div', { class: 'item' + (set.completed ? ' done' : '') + (set.warmup ? ' is-warmup' : ''), style: 'flex-wrap:wrap' }, row));
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
    ]));

    const mkStat = (id, label) => App.el('div', { class: 'stat' }, [
      App.el('div', { class: 'num' }, App.el('span', { id }, '0')),
      App.el('div', { class: 'lbl' }, label),
    ]);
    const statCard = App.el('div', { class: 'card' }, [
      App.el('div', { class: 'stat-row' }, [
        mkStat('sumExercises', 'Übungen'), mkStat('sumSets', 'Sätze'), mkStat('sumReps', 'Wdh.'), mkStat('sumVolume', 'Volumen (kg)'),
      ]),
    ]);
    wrap.appendChild(statCard);

    setTimeout(() => {
      App.animateCounter(document.getElementById('sumVolume'), Math.round(sum.volume));
      App.animateCounter(document.getElementById('sumSets'), sum.doneSets);
      App.animateCounter(document.getElementById('sumExercises'), sum.exerciseCount);
      App.animateCounter(document.getElementById('sumReps'), sum.reps);
      if (sum.prevStats) {
        const addDelta = (id, diff) => {
          const el = document.getElementById(id);
          const d = el && App.delta(diff);
          if (d) el.parentElement.appendChild(d);
        };
        addDelta('sumExercises', sum.exerciseCount - sum.prevStats.exercises);
        addDelta('sumSets', sum.doneSets - sum.prevStats.sets);
        addDelta('sumReps', sum.reps - sum.prevStats.reps);
        addDelta('sumVolume', Math.round(sum.volume - sum.prevStats.volume));
      }
    }, 50);

    if (sum.prs.length > 0) {
      const card = App.el('div', { class: 'card pr-glow' }, [App.el('h2', {}, [App.el('span', { html: Icons.trophy(), style: 'width:14px;height:14px' }), 'Neue persönliche Rekorde'])]);
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
