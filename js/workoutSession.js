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
    settings: { recordIntensity: false, intensityLabel: 'RIR', trackWarmupSets: false, unilateralRestSeconds: 20 },
  },

  async lastPerformance(exerciseId, excludeSessionId) {
    const sessions = await DB.getAll('workoutSessions');
    const past = sessions
      .filter((s) => s.id !== excludeSessionId && s.finishedAt)
      .sort((a, b) => b.finishedAt - a.finishedAt);
    for (const s of past) {
      const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
      if (!ex) continue;
      const working = ex.sets.filter((set) => set.completed && !set.warmup);
      if (working.length) return working;
    }
    return null;
  },

  async _readSettings() {
    const [intensity, metric, warm, uniRest] = await Promise.all([
      DB.get('settings', 'recordIntensity'), DB.get('settings', 'intensityMetric'),
      DB.get('settings', 'trackWarmupSets'), DB.get('settings', 'unilateralRestSeconds'),
    ]);
    return {
      recordIntensity: intensity ? !!intensity.value : false,
      intensityLabel: (metric ? metric.value : 'rir') === 'rpe' ? 'RPE' : 'RIR',
      trackWarmupSets: warm ? !!warm.value : false,
      unilateralRestSeconds: uniRest ? uniRest.value : 20,
    };
  },

  // Shared by start() and addExerciseToSession() so both produce identical L/R set structures.
  buildSets(plannedSets, history, unilateral, alternating) {
    if (!unilateral) {
      return plannedSets.map((planned, i) => {
        const prev = history && history[i];
        const baseReps = prev ? prev.reps : planned.reps;
        const baseWeight = prev ? prev.weight : planned.weight;
        const baseRir = prev && prev.rir != null ? prev.rir : null;
        return {
          targetReps: baseReps, targetWeight: baseWeight, targetRir: baseRir,
          reps: null, weight: null,
          rir: null, warmup: planned.warmup || false,
          completed: false,
        };
      });
    }
    const histL = (history || []).filter((set) => set.side === 'L');
    const histR = (history || []).filter((set) => set.side === 'R');
    const buildSide = (side) => plannedSets.map((planned, i) => {
      const prev = (side === 'L' ? histL : histR)[i];
      const baseReps = prev ? prev.reps : planned.reps;
      const baseWeight = prev ? prev.weight : planned.weight;
      const baseRir = prev && prev.rir != null ? prev.rir : null;
      return {
        side, round: i + 1,
        targetReps: baseReps, targetWeight: baseWeight, targetRir: baseRir,
        reps: null, weight: null, rir: null, warmup: planned.warmup || false,
        completed: false,
      };
    });
    const leftSets = buildSide('L');
    const rightSets = buildSide('R');
    return alternating
      ? leftSets.flatMap((l, i) => [l, rightSets[i]])
      : [...leftSets, ...rightSets];
  },

  async start(workout) {
    const sessionId = DB.uid();
    const sessSettings = await this._readSettings();
    const exercises = [];
    for (const entry of workout.exercises) {
      const ex = await Exercises.byId(entry.exerciseId);
      const history = await this.lastPerformance(entry.exerciseId, sessionId);
      const unilateral = !!entry.unilateral;
      const alternating = entry.alternating !== false;
      const sets = this.buildSets(entry.sets, history, unilateral, alternating);
      exercises.push({
        exerciseId: entry.exerciseId, exerciseName: ex ? ex.name : '(gelöschte Übung)',
        restSeconds: entry.restSeconds || 90, unilateral, alternating,
        unilateralRestSeconds: entry.unilateralRestSeconds != null ? entry.unilateralRestSeconds : sessSettings.unilateralRestSeconds,
        trackBodyweight: !!entry.trackBodyweight,
        sets,
      });
    }
    const bodyweight = await this._readBodyweight();
    this._begin(sessionId, workout.id, workout.name, exercises, workout.tag || '', sessSettings, bodyweight);
  },

  async startAdhoc() {
    const sessSettings = await this._readSettings();
    const bodyweight = await this._readBodyweight();
    this._begin(DB.uid(), null, 'Ad-hoc-Workout', [], '', sessSettings, bodyweight);
  },

  async _readBodyweight() {
    if (typeof BodyMetrics === 'undefined') return 0;
    const latest = await BodyMetrics.latest();
    return latest ? latest.weight : 0;
  },

  _begin(sessionId, workoutId, workoutName, exercises, workoutTag, sessSettings, bodyweight) {
    clearInterval(this.state.intervalId);
    this.state = {
      active: true, sessionId, workoutId, workoutName, workoutTag: workoutTag || '', exercises,
      currentExerciseIndex: 0, phase: 'active', restSecondsLeft: 0, restTotal: 90,
      intervalId: setInterval(() => this.tick(), 1000),
      startedAt: Date.now(), elapsedSeconds: 0, finishedSummary: null, bodyweight: bodyweight || 0,
      settings: sessSettings || { recordIntensity: false, intensityLabel: 'RIR', trackWarmupSets: false },
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
      const extra = ex.trackBodyweight ? (s.bodyweight || 0) : 0;
      for (const set of ex.sets) {
        totalSets++;
        if (set.completed) {
          doneSets++;
          if (!set.warmup) { volume += (set.reps || 0) * ((set.weight || 0) + extra); reps += (set.reps || 0); }
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
    const ex = s.exercises[exIndex];
    const set = ex.sets[setIndex];
    if (set.reps == null) set.reps = set.targetReps ?? 0;
    if (set.weight == null) set.weight = set.targetWeight ?? 0;
    set.completed = true;

    if (this.allDone()) { await this.finish(); return; }

    let restSeconds = ex.restSeconds || 90;
    if (ex.unilateral && ex.alternating !== false && set.side === 'L') {
      restSeconds = ex.unilateralRestSeconds != null ? ex.unilateralRestSeconds : 20;
    }
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
        listBox.appendChild(App.el('div', { class: 'item', style: 'cursor:pointer', onclick: async () => {
          const history = await this.lastPerformance(ex.id, this.state.sessionId);
          const unilateral = !!ex.unilateral;
          const alternating = ex.alternating !== false;
          const planned = [0, 1, 2].map(() => ({ reps: 10, weight: 0 }));
          const sets = this.buildSets(planned, history, unilateral, alternating);
          this.state.exercises.push({
            exerciseId: ex.id, exerciseName: ex.name, restSeconds: 90, unilateral, alternating,
            unilateralRestSeconds: this.state.settings ? this.state.settings.unilateralRestSeconds : 20,
            trackBodyweight: !!ex.trackBodyweight,
            sets,
          });
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
    const unit = ex.unilateral ? 2 : 1;
    const totalUnits = ex.sets.length / unit;
    const doneCount = ex.sets.filter((s) => s.completed).length;
    const currentUnit = Math.min(Math.floor(doneCount / unit) + 1, totalUnits);
    box.appendChild(App.el('h2', {}, `Satz ${currentUnit} von ${totalUnits}`));

    const recordIntensity = !!(this.state.settings && this.state.settings.recordIntensity);
    const intensityLabel = (this.state.settings && this.state.settings.intensityLabel) || 'RIR';
    const trackWarmup = !!(this.state.settings && this.state.settings.trackWarmupSets);
    const cols = ['30px', '52px', '1fr', '1fr'];
    if (recordIntensity) cols.push('56px');
    if (trackWarmup) cols.push('30px');
    const gridStyle = `display:grid;grid-template-columns:${cols.join(' ')};gap:8px;align-items:center;`;

    const header = App.el('div', { class: 'set-row-header', style: gridStyle }, [
      App.el('span', {}, ''), App.el('span', {}, ''),
      App.el('span', {}, 'Gewicht'), App.el('span', {}, 'Wdh.'),
      recordIntensity ? App.el('span', {}, intensityLabel) : null,
      trackWarmup ? App.el('span', {}, '') : null,
    ]);

    const list = App.el('div', { class: 'list' }, [header]);
    const updateDelta = (span, actual, target) => {
      span.innerHTML = '';
      if (actual == null) return;
      const d = App.delta(actual - target);
      if (d) span.appendChild(d);
    };

    ex.sets.forEach((set, si) => {
      const weightInput = App.el('input', {
        type: 'number', class: 'set-input', value: set.weight ?? '', step: '0.5', style: 'text-align:center',
        placeholder: set.targetWeight != null ? String(set.targetWeight) : '', disabled: set.completed,
      });
      const weightDelta = App.el('span', { style: 'display:inline-block;min-width:32px' });
      updateDelta(weightDelta, set.weight, set.targetWeight);
      weightInput.addEventListener('input', (e) => {
        set.weight = e.target.value === '' ? null : Number(e.target.value);
        updateDelta(weightDelta, set.weight, set.targetWeight);
      });

      const repsInput = App.el('input', {
        type: 'number', class: 'set-input', value: set.reps ?? '', style: 'text-align:center',
        placeholder: set.targetReps != null ? String(set.targetReps) : '', disabled: set.completed,
      });
      const repsDelta = App.el('span', { style: 'display:inline-block;min-width:26px' });
      updateDelta(repsDelta, set.reps, set.targetReps);
      repsInput.addEventListener('input', (e) => {
        set.reps = e.target.value === '' ? null : Number(e.target.value);
        updateDelta(repsDelta, set.reps, set.targetReps);
      });

      const cells = [
        App.el('button', {
          class: 'checkbox' + (set.completed ? ' checked' : ''), html: Icons.check(),
          onclick: (e) => {
            if (set.completed) { this.uncompleteSet(exIndex, si); return; }
            e.currentTarget.classList.add('pop');
            this.completeSet(exIndex, si);
          },
        }),
        App.el('div', { class: 'set-label' }, ex.unilateral ? `${set.side}${set.round}` : `Satz ${si + 1}`),
        App.el('div', { style: 'display:flex;align-items:center;gap:4px' }, [weightInput, weightDelta]),
        App.el('div', { style: 'display:flex;align-items:center;gap:4px' }, [repsInput, repsDelta]),
      ];
      if (recordIntensity) {
        const rirInput = App.el('input', {
          type: 'number', class: 'set-input', value: set.rir ?? '', style: 'text-align:center',
          placeholder: set.targetRir != null ? String(set.targetRir) : '–', disabled: set.completed,
        });
        rirInput.addEventListener('input', (e) => { set.rir = e.target.value === '' ? null : Number(e.target.value); });
        cells.push(rirInput);
      }
      if (trackWarmup) {
        cells.push(App.el('button', {
          class: 'icon-btn' + (set.warmup ? ' active-warmup' : ''), title: 'Aufwärmsatz',
          html: Icons.flame(), onclick: () => { set.warmup = !set.warmup; App.refresh(); },
        }));
      }

      list.appendChild(App.el('div', { class: 'set-row' + (set.completed ? ' done' : '') + (set.warmup ? ' is-warmup' : ''), style: gridStyle }, cells));
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

    if (typeof Gyms !== 'undefined') {
      wrap.appendChild(App.el('div', { style: 'text-align:center;margin-bottom:2px' }, [
        App.el('a', { href: '#', onclick: (e) => { e.preventDefault(); Gyms.pickForSession(this.state.sessionId); } }, 'Gym hinzufügen'),
      ]));
    }

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
