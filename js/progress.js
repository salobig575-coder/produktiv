const ProgressView = {
  selectedExercise: null,

  async render() {
    const wrap = App.el('div');
    const sessions = (await DB.getAll('workoutSessions')).filter((s) => s.finishedAt).sort((a, b) => a.finishedAt - b.finishedAt);
    const bodyMetrics = (await DB.getAll('bodyMetrics')).sort((a, b) => a.date.localeCompare(b.date));

    wrap.appendChild(this.renderTrainingStats(sessions));
    const weightCard = await this.renderWeightCard(bodyMetrics);
    if (weightCard) wrap.appendChild(weightCard);
    wrap.appendChild(this.renderVolumeCard(sessions));
    wrap.appendChild(await this.renderStrengthCard(sessions));
    wrap.appendChild(this.renderPRList(sessions));

    return wrap;
  },

  trainingStreak(sessions) {
    const days = new Set(sessions.map((s) => App.todayStr(new Date(s.finishedAt))));
    let count = 0;
    let d = new Date();
    if (!days.has(App.todayStr(d))) d.setDate(d.getDate() - 1);
    while (days.has(App.todayStr(d))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  },

  renderTrainingStats(sessions) {
    const now = new Date();
    const weekAgo = now.getTime() - 6 * 86400000;
    const monthAgo = now.getTime() - 29 * 86400000;
    const thisWeek = sessions.filter((s) => s.finishedAt >= weekAgo).length;
    const thisMonth = sessions.filter((s) => s.finishedAt >= monthAgo).length;
    const streak = this.trainingStreak(sessions);

    return App.el('div', { class: 'card hero' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.trophy(), style: 'width:14px;height:14px' }), 'Trainingsübersicht']),
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(streak)), App.el('div', { class: 'lbl' }, 'Tage-Streak')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(thisWeek)), App.el('div', { class: 'lbl' }, 'Diese Woche')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(sessions.length)), App.el('div', { class: 'lbl' }, 'Insgesamt')]),
      ]),
    ]);
  },

  async renderWeightCard(bodyMetrics) {
    if (!(await BodyMetrics.isEnabled())) return null;
    const card = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.weight(), style: 'width:14px;height:14px' }), 'Gewichtsverlauf']),
    ]);
    if (bodyMetrics.length < 2) {
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Trag dein Gewicht ein paar Mal ein, um hier einen Verlauf zu sehen.'));
      return card;
    }
    const points = bodyMetrics.map((b) => ({ label: App.formatDate(b.date).slice(0, 5), value: b.weight }));
    const first = bodyMetrics[0].weight;
    const current = bodyMetrics.at(-1).weight;
    const delta = Math.round((current - first) * 10) / 10;
    const target = await BodyMetrics.targetWeightKg();

    const summary = App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [
      App.el('div', {}, [
        App.el('div', { style: 'font-size:28px;font-weight:800' }, [`${current} kg`, App.delta(delta, { suffix: ' kg' })]),
        App.el('div', { class: 'tag' }, 'seit Start'),
      ]),
      target ? App.el('div', { style: 'text-align:right' }, [
        App.el('div', { style: 'font-size:16px;font-weight:700;color:var(--accent)' }, `${target} kg`),
        App.el('div', { class: 'tag' }, 'Ziel'),
      ]) : null,
    ]);
    card.appendChild(summary);
    card.appendChild(Charts.line(points));
    return card;
  },

  renderVolumeCard(sessions) {
    const card = App.el('div', { class: 'card' }, [App.el('h2', {}, 'Wöchentliches Volumen')]);
    if (sessions.length === 0) {
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Noch keine abgeschlossenen Workouts.'));
      return card;
    }
    const weeks = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now); end.setDate(end.getDate() - i * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      const vol = sessions.filter((s) => s.finishedAt >= start.setHours(0, 0, 0, 0) && s.finishedAt <= end.setHours(23, 59, 59, 999)).reduce((sum, s) => sum + (s.totalVolume || 0), 0);
      weeks.push({ label: `${end.getDate()}.${end.getMonth() + 1}.`, value: vol });
    }
    card.appendChild(Charts.bar(weeks, { formatValue: (v) => v >= 1000 ? Math.round(v / 100) / 10 + 't' : String(Math.round(v)) }));
    return card;
  },

  async renderStrengthCard(sessions) {
    const exerciseIds = [...new Set(sessions.flatMap((s) => s.exercises.filter((e) => e.sets.some((set) => set.completed && !set.warmup)).map((e) => e.exerciseId)))];
    const card = App.el('div', { class: 'card' }, [App.el('h2', {}, [App.el('span', { html: Icons.bolt(), style: 'width:14px;height:14px' }), 'Kraftfortschritt'])]);

    if (exerciseIds.length === 0) {
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Schließ ein paar Workouts ab, um deinen Kraftfortschritt pro Übung zu sehen.'));
      return card;
    }
    if (!this.selectedExercise || !exerciseIds.includes(this.selectedExercise)) this.selectedExercise = exerciseIds[0];

    const options = [];
    for (const id of exerciseIds) {
      const ex = await Exercises.byId(id);
      options.push({ id, name: ex ? ex.name : id });
    }
    const select = App.el('select', {}, options.map((o) => App.el('option', { value: o.id }, o.name)));
    select.value = this.selectedExercise;
    select.addEventListener('change', (e) => { this.selectedExercise = e.target.value; App.navigate('fitness'); });
    card.appendChild(App.el('div', { class: 'field' }, [select]));

    const points = [];
    for (const s of sessions) {
      const ex = s.exercises.find((e) => e.exerciseId === this.selectedExercise);
      if (!ex) continue;
      const best = Math.max(0, ...ex.sets.filter((set) => set.completed && !set.warmup).map((set) => Calc.estimatedOneRepMax(set.weight, set.reps)));
      if (best > 0) points.push({ label: App.formatDate(App.todayStr(new Date(s.finishedAt))).slice(0, 5), value: best });
    }
    if (points.length < 2) {
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:12px 10px' }, 'Noch zu wenig Daten für diese Übung — mach sie noch einmal.'));
    } else {
      card.appendChild(App.el('div', { class: 'tag', style: 'margin-bottom:6px' }, 'Geschätztes 1RM pro Workout'));
      card.appendChild(Charts.line(points));
    }
    return card;
  },

  renderPRList(sessions) {
    const best = {};
    for (const s of sessions) {
      for (const ex of s.exercises) {
        for (const set of ex.sets) {
          if (!set.completed || set.warmup) continue;
          const e1rm = Calc.estimatedOneRepMax(set.weight, set.reps);
          if (!best[ex.exerciseId] || e1rm > best[ex.exerciseId].e1rm) {
            best[ex.exerciseId] = { e1rm, weight: set.weight, reps: set.reps, name: ex.exerciseName };
          }
        }
      }
    }
    const list = Object.values(best).sort((a, b) => b.e1rm - a.e1rm);
    const card = App.el('div', { class: 'card' }, [App.el('h2', {}, [App.el('span', { html: Icons.trophy(), style: 'width:14px;height:14px' }), 'Persönliche Rekorde'])]);
    if (list.length === 0) {
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Noch keine Rekorde — leg los!'));
      return card;
    }
    const rows = App.el('div', { class: 'list' });
    for (const pr of list.slice(0, 10)) {
      rows.appendChild(App.el('div', { class: 'item' }, [
        App.el('span', { html: Icons.trophy(), style: 'width:18px;height:18px;color:var(--warn)' }),
        App.el('div', { style: 'flex:1' }, [App.el('div', { class: 'item-title' }, pr.name), App.el('div', { class: 'item-meta' }, `${pr.weight} kg × ${pr.reps} Wdh`)]),
        App.el('span', { class: 'pill' }, `~${pr.e1rm} kg 1RM`),
      ]));
    }
    card.appendChild(rows);
    return card;
  },
};
