const FitnessDashboardView = {
  selectedDate: null,

  today() { return App.todayStr(); },

  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return App.todayStr(d);
  },

  async render() {
    if (!this.selectedDate) this.selectedDate = this.today();
    const wrap = App.el('div');

    const sessions = (await DB.getAll('workoutSessions')).filter((s) => s.finishedAt);
    const byDate = new Map();
    for (const s of sessions) {
      const d = App.todayStr(new Date(s.finishedAt));
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(s);
    }

    wrap.appendChild(this.renderHeader());
    wrap.appendChild(this.renderDateStrip(byDate));
    wrap.appendChild(await this.renderTrainingCard(byDate));

    const weightCard = typeof BodyMetrics !== 'undefined' ? await BodyMetrics.card(this.selectedDate) : null;
    if (weightCard) wrap.appendChild(weightCard);

    wrap.appendChild(await this.renderGoalsCard());
    wrap.appendChild(await this.renderCardioCard());
    if (typeof StepsTracking !== 'undefined') wrap.appendChild(await StepsTracking.card(this.selectedDate));
    if (typeof SleepTracking !== 'undefined') wrap.appendChild(await SleepTracking.card(this.selectedDate));
    if (typeof ProgressPhotos !== 'undefined') wrap.appendChild(await ProgressPhotos.card(this.selectedDate));

    return wrap;
  },

  renderHeader() {
    const isToday = this.selectedDate === this.today();
    const d = new Date(this.selectedDate + 'T00:00:00');
    const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    return App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [
      App.el('div', { style: 'font-weight:800;font-size:15px' }, label),
      App.el('div', { class: 'row', style: 'gap:6px' }, [
        App.el('button', { class: 'icon-btn', html: Icons.planen(), title: 'Kalender', onclick: () => this.openCalendar() }),
        !isToday ? App.el('button', { class: 'btn secondary', style: 'width:auto;padding:8px 14px', onclick: () => { this.selectedDate = this.today(); App.refresh(); } }, 'Heute') : null,
      ]),
    ]);
  },

  renderDateStrip(byDate) {
    const center = this.selectedDate;
    const cells = [];
    for (let i = -3; i <= 3; i++) {
      const dateStr = this.addDays(center, i);
      const d = new Date(dateStr + 'T00:00:00');
      const isSelected = dateStr === this.selectedDate;
      const isToday = dateStr === this.today();
      const daySessions = byDate.get(dateStr);
      const label = daySessions && daySessions[0] ? (daySessions[0].workoutTag || daySessions[0].workoutName || '').toUpperCase() : '';
      cells.push(App.el('div', {
        class: 'date-cell' + (isSelected ? ' active' : '') + (isToday ? ' today' : ''),
        onclick: () => { this.selectedDate = dateStr; App.refresh(); },
      }, [
        App.el('div', { class: 'date-cell-dow' }, d.toLocaleDateString('de-DE', { weekday: 'narrow' })),
        App.el('div', { class: 'date-cell-num' }, String(d.getDate())),
        App.el('div', { class: 'date-cell-tag' }, label ? label.slice(0, 6) : ''),
      ]));
    }
    return App.el('div', { class: 'date-strip' }, cells);
  },

  async renderTrainingCard(byDate) {
    const daySessions = byDate.get(this.selectedDate);
    const card = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.fitness(), style: 'width:14px;height:14px' }), 'Training']),
    ]);

    if (daySessions && daySessions.length) {
      const list = App.el('div', { class: 'list' });
      for (const s of daySessions) {
        list.appendChild(App.el('div', {
          class: 'item', style: 'cursor:pointer',
          onclick: () => WorkoutSessionView.showSessionDetail(s),
        }, [
          App.el('span', { html: Icons.check(), style: 'width:20px;height:20px;color:var(--success);flex-shrink:0' }),
          App.el('div', { style: 'flex:1;min-width:0' }, [
            App.el('div', { class: 'item-title' }, s.workoutName),
            App.el('div', { class: 'item-meta' }, `${s.exerciseCount ?? s.exercises.length} Übungen · ${Math.round(s.totalVolume || 0)} kg Volumen`),
          ]),
          s.workoutTag ? App.el('span', { class: 'pill' }, s.workoutTag) : null,
        ]));
      }
      card.appendChild(list);
      return card;
    }

    if (this.selectedDate === this.today()) {
      if (typeof WorkoutSessionView !== 'undefined' && WorkoutSessionView.state.active && WorkoutSessionView.state.phase !== 'finished') {
        const sState = WorkoutSessionView.state;
        card.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;cursor:pointer', onclick: () => { FitnessHub.activeTab = 'workouts'; App.navigate('fitness'); } }, [
          App.el('div', {}, [
            App.el('div', { style: 'font-weight:700' }, `${sState.workoutName} läuft`),
            App.el('div', { class: 'tag' }, WorkoutSessionView.fmtTime(sState.elapsedSeconds)),
          ]),
          App.el('span', { html: Icons.arrowRight(), style: 'width:18px;height:18px' }),
        ]));
        return card;
      }
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:10px' }, 'Noch kein Workout heute protokolliert.'));
      card.appendChild(App.el('button', { class: 'btn', style: 'margin-top:8px', onclick: () => WorkoutsView.openStartPicker() }, 'Workout wählen'));
      return card;
    }

    card.appendChild(App.el('div', { class: 'empty', style: 'padding:10px' }, 'Kein Workout protokolliert.'));
    return card;
  },

  async renderGoalsCard() {
    const goals = await DB.getAll('goals');
    goals.sort((a, b) => a.createdAt - b.createdAt);
    const done = goals.filter((g) => g.done).length;
    const card = App.el('div', { class: 'card' }, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [
        App.el('h2', { style: 'margin:0' }, [App.el('span', { html: Icons.trophy(), style: 'width:14px;height:14px' }), 'Ziele']),
        App.el('span', { class: 'tag' }, `${done}/${goals.length}`),
      ]),
    ]);
    const list = App.el('div', { class: 'list' });
    for (const g of goals) {
      list.appendChild(App.el('div', { class: 'item' + (g.done ? ' done' : '') }, [
        App.el('button', {
          class: 'checkbox' + (g.done ? ' checked' : ''), html: Icons.check(),
          onclick: async (e) => { e.currentTarget.classList.add('pop'); g.done = !g.done; await DB.put('goals', g); setTimeout(() => App.refresh(), 200); },
        }),
        App.el('div', { class: 'item-title' }, g.text),
        App.el('button', { class: 'icon-btn', title: 'Löschen', html: Icons.trash(), onclick: async () => { await DB.delete('goals', g.id); App.refresh(); } }),
      ]));
    }
    if (goals.length === 0) list.appendChild(App.el('div', { class: 'empty', style: 'padding:10px' }, 'Noch keine Ziele.'));
    card.appendChild(list);

    const addInput = App.el('input', { type: 'text', placeholder: 'Neues Ziel, z.B. 3x Training/Woche', style: 'margin-top:10px' });
    addInput.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || !addInput.value.trim()) return;
      await DB.put('goals', { id: DB.uid(), text: addInput.value.trim(), done: false, createdAt: Date.now() });
      App.refresh();
    });
    card.appendChild(addInput);
    return card;
  },

  async renderCardioCard() {
    const entries = (await DB.getAll('cardioSessions')).sort((a, b) => b.createdAt - a.createdAt);
    const weekAgo = Date.now() - 6 * 86400000;
    const weekMin = entries.filter((c) => c.createdAt >= weekAgo).reduce((sum, c) => sum + (c.durationMin || 0), 0);
    const card = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.bolt(), style: 'width:14px;height:14px' }), 'Cardio']),
    ]);
    if (entries.length === 0) {
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:10px' }, 'Noch kein Cardio protokolliert.'));
    } else {
      const latest = entries[0];
      card.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between' }, [
        App.el('div', {}, [
          App.el('div', { style: 'font-weight:700' }, `${latest.type} · ${latest.durationMin} Min${latest.distanceKm ? ` · ${latest.distanceKm} km` : ''}`),
          App.el('div', { class: 'tag' }, App.formatDate(latest.date)),
        ]),
        App.el('div', { style: 'text-align:right' }, [
          App.el('div', { style: 'font-weight:800' }, `${weekMin} Min`),
          App.el('div', { class: 'tag' }, 'diese Woche'),
        ]),
      ]));
    }
    card.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-top:10px', onclick: () => this.openCardioEntry() }, 'Cardio protokollieren'));
    return card;
  },

  openCardioEntry() {
    const typeSelect = App.el('select', {}, ['Laufen', 'Rad', 'Rudern', 'Schwimmen', 'Sonstiges'].map((t) => App.el('option', { value: t }, t)));
    const durationInput = App.el('input', { type: 'number', placeholder: 'z.B. 30', inputmode: 'numeric' });
    const distanceInput = App.el('input', { type: 'number', step: '0.1', placeholder: 'optional', inputmode: 'decimal' });
    const content = App.el('div', {}, [
      App.el('h3', {}, 'Cardio protokollieren'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Art'), typeSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Dauer (Min.)'), durationInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Distanz (km, optional)'), distanceInput]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            if (!durationInput.value) { durationInput.focus(); return; }
            await DB.put('cardioSessions', {
              id: DB.uid(), date: this.selectedDate, type: typeSelect.value,
              durationMin: Number(durationInput.value), distanceKm: distanceInput.value ? Number(distanceInput.value) : 0,
              createdAt: Date.now(),
            });
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => durationInput.focus(), 50);
  },

  openCalendar() {
    const view = new Date(this.selectedDate + 'T00:00:00');
    view.setDate(1);
    const container = App.el('div');
    App.showModal(App.el('div', {}, [container]));

    const renderCal = async () => {
      const sessions = (await DB.getAll('workoutSessions')).filter((s) => s.finishedAt);
      const loggedDates = new Set(sessions.map((s) => App.todayStr(new Date(s.finishedAt))));

      const year = view.getFullYear(), month = view.getMonth();
      const first = new Date(year, month, 1);
      const startOffset = (first.getDay() + 6) % 7; // Monday-first
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const grid = App.el('div', { class: 'cal-grid' });
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((d) => grid.appendChild(App.el('div', { class: 'cal-dow' }, d)));
      for (let i = 0; i < startOffset; i++) grid.appendChild(App.el('div', { class: 'cal-day empty' }));
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = App.todayStr(new Date(year, month, day));
        const isSelected = dateStr === this.selectedDate;
        const isToday = dateStr === this.today();
        grid.appendChild(App.el('div', {
          class: 'cal-day' + (isSelected ? ' selected' : '') + (isToday ? ' today' : ''),
          onclick: () => { this.selectedDate = dateStr; App.closeModal(); App.refresh(); },
        }, [
          App.el('span', {}, String(day)),
          loggedDates.has(dateStr) ? App.el('span', { class: 'cal-dot' }) : null,
        ]));
      }

      const selD = new Date(this.selectedDate + 'T00:00:00');
      container.innerHTML = '';
      container.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start;margin-bottom:16px' }, [
        App.el('div', {}, [
          App.el('h3', { style: 'margin:0' }, 'Datum wählen'),
          App.el('div', { class: 'tag', style: 'margin-top:2px' }, selD.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })),
        ]),
        App.el('button', { class: 'icon-btn', title: 'Schließen', html: Icons.close(), onclick: () => App.closeModal() }),
      ]));
      container.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, [
        App.el('button', { class: 'icon-btn', html: Icons.chevronUp(), style: 'transform:rotate(-90deg)', onclick: () => { view.setMonth(view.getMonth() - 1); renderCal(); } }),
        App.el('div', { style: 'font-weight:700' }, view.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
        App.el('button', { class: 'icon-btn', html: Icons.chevronUp(), style: 'transform:rotate(90deg)', onclick: () => { view.setMonth(view.getMonth() + 1); renderCal(); } }),
      ]));
      container.appendChild(grid);
      container.appendChild(App.el('div', { class: 'row', style: 'margin-top:14px;gap:6px' }, [
        App.el('span', { class: 'cal-dot' }), App.el('span', { class: 'tag' }, 'Protokolliert'),
      ]));
    };
    renderCal();
  },
};
