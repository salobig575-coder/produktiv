const WorkoutsView = {
  async render() {
    const wrap = App.el('div');
    const workouts = await DB.getAll('workouts');
    workouts.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.openEditor() }, [
      App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px' }), 'Neues Workout',
    ]));
    if (typeof WorkoutSessionView !== 'undefined') {
      wrap.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: () => WorkoutSessionView.startAdhoc() }, [
        App.el('span', { html: Icons.bolt(), style: 'width:16px;height:16px' }), 'Ad-hoc-Workout starten',
      ]));
    }
    wrap.appendChild(App.el('div', { style: 'height:14px' }));

    if (workouts.length === 0) {
      wrap.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.fitness() }),
        'Noch keine Workouts angelegt.',
      ]));
      return wrap;
    }

    const list = App.el('div', { class: 'list' });
    for (const w of workouts) {
      list.appendChild(App.el('div', { class: 'item' }, [
        App.el('div', { style: 'flex:1;cursor:pointer', onclick: () => this.openEditor(w) }, [
          App.el('div', { class: 'item-title' }, w.name || '(ohne Namen)'),
          App.el('div', { class: 'item-meta' }, `${w.exercises.length} Übung${w.exercises.length === 1 ? '' : 'en'}`),
        ]),
        typeof WorkoutSessionView !== 'undefined' ? App.el('button', { class: 'icon-btn', html: Icons.bolt(), title: 'Starten', onclick: () => WorkoutSessionView.start(w) }) : null,
        App.el('button', { class: 'icon-btn', html: Icons.copy(), title: 'Duplizieren', onclick: () => this.duplicate(w) }),
        App.el('button', { class: 'icon-btn', html: Icons.trash(), onclick: (e) => this.remove(w, e) }),
      ]));
    }
    wrap.appendChild(list);
    return wrap;
  },

  async duplicate(w) {
    const copy = JSON.parse(JSON.stringify(w));
    copy.id = DB.uid();
    copy.name = (w.name || 'Workout') + ' (Kopie)';
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    await DB.put('workouts', copy);
    App.refresh();
  },

  async remove(w, e) {
    const el = e.currentTarget.closest('.item');
    if (el) el.classList.add('removing');
    setTimeout(async () => {
      await DB.delete('workouts', w.id);
      App.refresh();
    }, 220);
  },

  openEditor(workout) {
    const isNew = !workout;
    const w = workout ? JSON.parse(JSON.stringify(workout)) : { id: DB.uid(), name: '', notes: '', exercises: [], createdAt: Date.now() };
    let mode = 'edit';
    let exAll = null;
    let pickQuery = '';
    let pickMuscle = 'all';
    const expanded = new Set();

    const container = App.el('div');
    const modal = App.showModal(App.el('div', {}, [container]));

    const renderBody = async () => {
      container.innerHTML = '';
      container.appendChild(mode === 'edit' ? await renderEdit() : await renderPick());
    };

    const renderEdit = async () => {
      const nameInput = App.el('input', { type: 'text', value: w.name, placeholder: 'Workout-Name, z.B. Push Day' });
      nameInput.addEventListener('input', (e) => { w.name = e.target.value; });

      const exList = App.el('div', { class: 'list', style: 'margin-bottom:14px' });
      for (let i = 0; i < w.exercises.length; i++) {
        exList.appendChild(await this.renderExerciseRow(w, i, expanded, renderBody));
      }
      if (w.exercises.length === 0) {
        exList.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Noch keine Übungen hinzugefügt.'));
      }

      return App.el('div', {}, [
        App.el('h3', {}, isNew ? 'Neues Workout' : 'Workout bearbeiten'),
        App.el('div', { class: 'field' }, [App.el('label', {}, 'Name'), nameInput]),
        exList,
        App.el('button', { class: 'btn secondary', style: 'margin-bottom:14px', onclick: () => { mode = 'pick'; renderBody(); } }, [
          App.el('span', { html: Icons.plus(), style: 'width:16px;height:16px' }), 'Übung hinzufügen',
        ]),
        App.el('div', { class: 'row' }, [
          App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
          App.el('button', {
            class: 'btn', onclick: async () => {
              if (!w.name.trim()) { nameInput.focus(); return; }
              w.updatedAt = Date.now();
              await DB.put('workouts', w);
              App.closeModal();
              App.refresh();
            },
          }, 'Speichern'),
        ]),
      ]);
    };

    const renderPick = async () => {
      if (!exAll) exAll = await Exercises.all();
      const q = pickQuery.trim().toLowerCase();
      const items = exAll.filter((ex) => (pickMuscle === 'all' || ex.primaryMuscle === pickMuscle) && (!q || ex.name.toLowerCase().includes(q)));

      const search = App.el('input', { type: 'text', placeholder: 'Übung suchen…', value: pickQuery, oninput: (e) => { pickQuery = e.target.value; renderBody(); } });
      const muscleTabs = App.tabBar([{ key: 'all', label: 'Alle' }, ...MUSCLE_GROUPS.map((m) => ({ key: m, label: m }))], pickMuscle, (key) => { pickMuscle = key; renderBody(); });

      const list = App.el('div', { class: 'list' });
      if (items.length === 0) {
        list.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Keine Übungen gefunden.'));
      }
      const PICK_LIMIT = 60;
      for (const ex of items.slice(0, PICK_LIMIT)) {
        const thumb = ex.images && ex.images[0]
          ? App.el('img', { src: ex.images[0], style: 'width:40px;height:40px;object-fit:cover;border-radius:9px;flex-shrink:0;background:var(--surface-2)' })
          : null;
        list.appendChild(App.el('div', { class: 'item', style: 'cursor:pointer', onclick: () => {
          w.exercises.push({ exerciseId: ex.id, sets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }], restSeconds: 90, notes: '' });
          mode = 'edit';
          renderBody();
        } }, [
          thumb,
          App.el('div', { style: 'flex:1;min-width:0' }, [
            App.el('div', { class: 'item-title' }, ex.name),
            App.el('div', { class: 'item-meta' }, `${ex.primaryMuscle} · ${ex.equipment}`),
          ]),
          App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px;color:var(--accent);flex-shrink:0' }),
        ]));
      }
      if (items.length > PICK_LIMIT) {
        list.appendChild(App.el('div', { class: 'empty', style: 'padding:12px 10px' }, `${PICK_LIMIT} von ${items.length} angezeigt — Suche verfeinern.`));
      }

      return App.el('div', {}, [
        App.el('h3', {}, 'Übung auswählen'),
        App.el('div', { class: 'field' }, [search]),
        muscleTabs,
        list,
        App.el('button', { class: 'btn secondary', style: 'margin-top:10px', onclick: () => { mode = 'edit'; renderBody(); } }, 'Zurück'),
      ]);
    };

    renderBody();
  },

  async renderExerciseRow(w, i, expanded, renderBody) {
    const entry = w.exercises[i];
    const ex = await Exercises.byId(entry.exerciseId);
    const isOpen = expanded.has(i);

    const header = App.el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { if (isOpen) expanded.delete(i); else expanded.add(i); renderBody(); } }, [
      App.el('span', { class: 'tag', style: 'width:20px;flex-shrink:0' }, String(i + 1)),
      App.el('div', { style: 'flex:1;min-width:0' }, [
        App.el('div', { class: 'item-title' }, ex ? ex.name : '(gelöschte Übung)'),
        App.el('div', { class: 'item-meta' }, `${entry.sets.length} Sätze`),
      ]),
      App.el('span', { html: isOpen ? Icons.chevronUp() : Icons.chevronDown(), style: 'width:18px;height:18px;color:var(--text-dim);flex-shrink:0' }),
    ]);

    const item = App.el('div', { class: 'item', style: 'flex-direction:column;align-items:stretch;gap:8px' }, [header]);

    if (isOpen) {
      const controls = App.el('div', { class: 'row', style: 'gap:6px;padding-top:4px;border-top:1px solid var(--border)' }, [
        App.el('button', { class: 'btn secondary', style: 'flex:1;padding:8px', onclick: () => { if (i > 0) { [w.exercises[i - 1], w.exercises[i]] = [w.exercises[i], w.exercises[i - 1]]; renderBody(); } } }, [App.el('span', { html: Icons.chevronUp(), style: 'width:16px;height:16px' }), 'Hoch']),
        App.el('button', { class: 'btn secondary', style: 'flex:1;padding:8px', onclick: () => { if (i < w.exercises.length - 1) { [w.exercises[i + 1], w.exercises[i]] = [w.exercises[i], w.exercises[i + 1]]; renderBody(); } } }, [App.el('span', { html: Icons.chevronDown(), style: 'width:16px;height:16px' }), 'Runter']),
        App.el('button', { class: 'icon-btn', html: Icons.trash(), onclick: () => { w.exercises.splice(i, 1); expanded.delete(i); renderBody(); } }),
      ]);
      item.appendChild(controls);
      const setsBox = App.el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
      entry.sets.forEach((set, si) => {
        const repsInput = App.el('input', { type: 'number', value: set.reps, style: 'text-align:center', inputmode: 'numeric' });
        repsInput.addEventListener('input', (e) => { set.reps = Number(e.target.value) || 0; });
        const weightInput = App.el('input', { type: 'number', value: set.weight, step: '0.5', style: 'text-align:center', inputmode: 'decimal' });
        weightInput.addEventListener('input', (e) => { set.weight = Number(e.target.value) || 0; });
        setsBox.appendChild(App.el('div', { class: 'row', style: 'gap:8px' }, [
          App.el('span', { class: 'tag', style: 'width:44px' }, `Satz ${si + 1}`),
          repsInput, App.el('span', { class: 'tag' }, 'Wdh'),
          weightInput, App.el('span', { class: 'tag' }, 'kg'),
          App.el('button', { class: 'icon-btn', html: Icons.trash(), onclick: () => { entry.sets.splice(si, 1); renderBody(); } }),
        ]));
      });
      item.appendChild(setsBox);
      item.appendChild(App.el('button', { class: 'btn secondary', onclick: () => { entry.sets.push({ reps: 10, weight: entry.sets.at(-1)?.weight || 0 }); renderBody(); } }, '+ Satz'));

      const restInput = App.el('input', { type: 'number', value: entry.restSeconds ?? 90, style: 'width:80px;text-align:center' });
      restInput.addEventListener('input', (e) => { entry.restSeconds = Number(e.target.value) || 0; });
      item.appendChild(App.el('div', { class: 'row', style: 'gap:8px;margin-top:4px' }, [App.el('span', { class: 'tag' }, 'Pause (Sek.)'), restInput]));

      const notesInput = App.el('textarea', { placeholder: 'Notizen zur Übung (optional)', style: 'min-height:50px' }, entry.notes || '');
      notesInput.addEventListener('input', (e) => { entry.notes = e.target.value; });
      item.appendChild(notesInput);
    }

    return item;
  },
};
