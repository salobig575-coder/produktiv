const WorkoutCategories = {
  DEFAULTS: ['Oberkörper', 'Unterkörper', 'Ganzkörper', 'Push', 'Pull', 'Sonstiges'],

  async all() {
    const row = await DB.get('settings', 'workoutCategories');
    if (row && Array.isArray(row.value)) return row.value;
    await DB.put('settings', { key: 'workoutCategories', value: this.DEFAULTS });
    return this.DEFAULTS.slice();
  },

  async add(name) {
    const cats = await this.all();
    if (name && !cats.includes(name)) {
      cats.push(name);
      await DB.put('settings', { key: 'workoutCategories', value: cats });
    }
    return cats;
  },

  async remove(name) {
    const cats = (await this.all()).filter((c) => c !== name);
    await DB.put('settings', { key: 'workoutCategories', value: cats });
    return cats;
  },

  // Opens a small management modal (add/delete). Calls onChange() after any change so callers can re-render.
  manage(onChange) {
    const container = App.el('div');
    App.showModal(App.el('div', {}, [container]));

    const renderBody = async () => {
      const cats = await this.all();
      const list = App.el('div', { class: 'list' });
      if (cats.length === 0) {
        list.appendChild(App.el('div', { class: 'empty', style: 'padding:14px 10px' }, 'Keine Kategorien angelegt.'));
      }
      for (const cat of cats) {
        list.appendChild(App.el('div', { class: 'item' }, [
          App.el('div', { style: 'flex:1' }, cat),
          App.el('button', { class: 'icon-btn', title: 'Löschen', html: Icons.trash(), onclick: async () => { await this.remove(cat); onChange(); renderBody(); } }),
        ]));
      }
      const nameInput = App.el('input', { type: 'text', placeholder: 'Neue Kategorie, z.B. Beine' });
      container.innerHTML = '';
      container.appendChild(App.el('h3', {}, 'Kategorien verwalten'));
      container.appendChild(list);
      container.appendChild(App.el('div', { class: 'field' }, [nameInput]));
      container.appendChild(App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Fertig'),
        App.el('button', { class: 'btn', onclick: async () => {
          const name = nameInput.value.trim();
          if (!name) return;
          await this.add(name);
          onChange();
          renderBody();
        } }, [App.el('span', { html: Icons.plus(), style: 'width:16px;height:16px' }), 'Hinzufügen']),
      ]));
    };
    renderBody();
  },
};

const WorkoutsView = {
  query: '',

  async render() {
    const wrap = App.el('div');
    const allWorkouts = await DB.getAll('workouts');
    allWorkouts.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

    wrap.appendChild(App.el('div', { class: 'field' }, [
      App.el('input', {
        type: 'text', placeholder: 'Workouts durchsuchen…', value: this.query,
        oninput: (e) => { this.query = e.target.value; App.refresh(); },
      }),
    ]));

    wrap.appendChild(App.el('div', { class: 'fab-row' }, [
      App.el('button', { class: 'btn', onclick: () => this.openEditor() }, [
        App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px' }), 'Neues Workout',
      ]),
      typeof WorkoutSessionView !== 'undefined' ? App.el('button', { class: 'btn secondary', onclick: () => WorkoutSessionView.startAdhoc() }, [
        App.el('span', { html: Icons.bolt(), style: 'width:16px;height:16px' }), 'Ad-hoc-Workout',
      ]) : null,
    ]));

    if (allWorkouts.length === 0) {
      wrap.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.fitness() }),
        'Noch keine Workouts angelegt.',
      ]));
      return wrap;
    }

    const q = this.query.trim().toLowerCase();
    const workouts = q ? allWorkouts.filter((w) => (w.name || '').toLowerCase().includes(q)) : allWorkouts;

    wrap.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, [
      App.el('span', { class: 'set-row-header', style: 'padding:0' }, `Meine Workouts (${workouts.length})`),
    ]));

    if (workouts.length === 0) {
      wrap.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Keine Workouts gefunden.'));
      return wrap;
    }

    const list = App.el('div', { class: 'list' });
    for (const w of workouts) {
      const setsEstimate = w.exercises.reduce((sum, e) => sum + e.sets.length, 0);
      list.appendChild(App.el('div', { class: 'item', style: 'flex-direction:column;align-items:stretch;gap:10px' }, [
        App.el('div', { class: 'row', style: 'align-items:flex-start' }, [
          App.el('div', { style: 'flex:1;min-width:0;cursor:pointer', onclick: () => this.openEditor(w) }, [
            App.el('div', { class: 'item-title' }, w.name || '(ohne Namen)'),
            App.el('div', { class: 'item-meta' }, `${w.exercises.length} Übung${w.exercises.length === 1 ? '' : 'en'} · ~${setsEstimate} Sätze`),
          ]),
          w.tag ? App.el('span', { class: 'pill' }, w.tag) : null,
          App.el('button', { class: 'icon-btn', html: Icons.copy(), title: 'Duplizieren', onclick: () => this.duplicate(w) }),
          App.el('button', { class: 'icon-btn', title: 'Löschen', html: Icons.trash(), onclick: (e) => this.remove(w, e) }),
        ]),
        typeof WorkoutSessionView !== 'undefined' ? App.el('button', { class: 'btn', onclick: () => WorkoutSessionView.start(w) }, [
          'Workout starten', App.el('span', { html: Icons.arrowRight(), style: 'width:16px;height:16px' }),
        ]) : null,
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

  // Bottom sheet before starting: title, tag, numbered exercise list, start button.
  async openPreview(w) {
    const setsEstimate = w.exercises.reduce((sum, e) => sum + e.sets.length, 0);
    const list = App.el('div', { class: 'preview-list' });
    for (let i = 0; i < w.exercises.length; i++) {
      const ex = await Exercises.byId(w.exercises[i].exerciseId);
      const n = w.exercises[i].sets.length;
      list.appendChild(App.el('div', { class: 'preview-row' }, [
        App.el('span', { class: 'num-circle' }, String(i + 1)),
        App.el('div', { class: 'preview-name' }, ex ? ex.name : '(gelöschte Übung)'),
        App.el('div', { class: 'preview-sets' }, n ? `${n} ${n === 1 ? 'Satz' : 'Sätze'}` : '— Sätze'),
      ]));
    }
    const content = App.el('div', {}, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, [
        App.el('h3', { style: 'margin:0;font-size:24px' }, w.name || '(ohne Namen)'),
        w.tag ? App.el('span', { class: 'pill' }, w.tag) : null,
      ]),
      App.el('div', { class: 'item-meta', style: 'font-size:15px;margin:6px 0 14px' }, `${w.exercises.length} Übungen • ~${setsEstimate} Sätze`),
      App.el('div', { class: 'set-row-header', style: 'border-top:1px solid var(--border);padding-top:14px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;font-size:12px' }, 'Übungen'),
      list,
      App.el('button', { class: 'btn', style: 'margin-top:10px', onclick: () => { App.closeModal(); WorkoutSessionView.start(w); } }, 'Workout starten'),
    ]);
    App.showModal(content);
  },

  // Reusable "choose a workout to start" flow — search + tag tabs + start buttons.
  openStartPicker() {
    let query = '';
    let tagFilter = 'recent';
    const container = App.el('div');
    App.showModal(App.el('div', {}, [container]));

    const renderBody = async () => {
      const workouts = await DB.getAll('workouts');
      workouts.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      const tags = [...new Set(workouts.map((w) => w.tag).filter(Boolean))];
      const tabs = [{ key: 'recent', label: 'Zuletzt' }, ...tags.map((t) => ({ key: t, label: t }))];

      const q = query.trim().toLowerCase();
      let items = workouts.filter((w) => !q || (w.name || '').toLowerCase().includes(q));
      if (tagFilter !== 'recent') items = items.filter((w) => w.tag === tagFilter);

      const list = App.el('div', { class: 'list' });
      if (items.length === 0) {
        list.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Keine Workouts gefunden.'));
      }
      for (const w of items) {
        const setsEstimate = w.exercises.reduce((sum, e) => sum + e.sets.length, 0);
        list.appendChild(App.el('div', { class: 'item', style: 'flex-direction:column;align-items:stretch;gap:8px' }, [
          App.el('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start;cursor:pointer', onclick: () => this.openPreview(w) }, [
            App.el('div', { style: 'flex:1;min-width:0' }, [
              App.el('div', { class: 'item-title' }, w.name || '(ohne Namen)'),
              App.el('div', { class: 'item-meta' }, `${w.exercises.length} Übungen · ~${setsEstimate} Sätze`),
            ]),
            w.tag ? App.el('span', { class: 'pill' }, w.tag) : null,
          ]),
          App.el('button', { class: 'btn', onclick: () => { App.closeModal(); WorkoutSessionView.start(w); } }, 'Workout starten'),
        ]));
      }

      container.innerHTML = '';
      container.appendChild(App.el('h3', {}, 'Workout wählen'));
      container.appendChild(App.el('div', { class: 'field' }, [
        App.el('input', { type: 'text', placeholder: 'Workout suchen…', value: query, oninput: (e) => { query = e.target.value; renderBody(); } }),
      ]));
      container.appendChild(App.tabBar(tabs, tagFilter, (key) => { tagFilter = key; renderBody(); }));
      container.appendChild(list);
      if (workouts.length === 0) {
        container.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-top:4px', onclick: () => { App.closeModal(); WorkoutsView.openEditor(); } }, 'Erstes Workout anlegen'));
      }
    };
    renderBody();
  },

  async openEditor(workout) {
    const isNew = !workout;
    const w = workout ? JSON.parse(JSON.stringify(workout)) : { id: DB.uid(), name: '', tag: '', notes: '', exercises: [], createdAt: Date.now() };
    let mode = 'edit';
    let exAll = null;
    let pickQuery = '';
    let pickMuscle = 'all';
    const expanded = new Set();

    const [intensityRow, metricRow, warmRow, restRow] = await Promise.all([
      DB.get('settings', 'recordIntensity'), DB.get('settings', 'intensityMetric'),
      DB.get('settings', 'trackWarmupSets'), DB.get('settings', 'defaultRestSeconds'),
    ]);
    const opts = {
      recordIntensity: intensityRow ? !!intensityRow.value : false,
      intensityLabel: (metricRow ? metricRow.value : 'rir') === 'rpe' ? 'RPE' : 'RIR',
      trackWarmupSets: warmRow ? !!warmRow.value : false,
      defaultRestSeconds: restRow ? restRow.value : 90,
    };

    const container = App.el('div');
    App.showModal(App.el('div', {}, [container]));

    const renderBody = async () => {
      container.innerHTML = '';
      container.appendChild(mode === 'edit' ? await renderEdit() : await renderPick());
    };

    const renderEdit = async () => {
      const nameInput = App.el('input', { type: 'text', value: w.name, placeholder: 'Workout-Name, z.B. Push Day' });
      nameInput.addEventListener('input', (e) => { w.name = e.target.value; });

      const categories = await WorkoutCategories.all();
      const tagSelect = App.el('select', {}, ['', ...categories].map((t) => App.el('option', { value: t }, t || '– Kategorie –')));
      tagSelect.value = categories.includes(w.tag) ? w.tag : '';
      tagSelect.addEventListener('change', (e) => { w.tag = e.target.value; });
      const manageCatBtn = App.el('button', {
        class: 'icon-btn', html: Icons.settings(), title: 'Kategorien verwalten',
        onclick: () => WorkoutCategories.manage(() => renderBody()),
      });

      const exList = App.el('div', { class: 'list', style: 'margin-bottom:14px' });
      for (let i = 0; i < w.exercises.length; i++) {
        exList.appendChild(await this.renderExerciseRow(w, i, expanded, renderBody, opts));
      }
      if (w.exercises.length === 0) {
        exList.appendChild(App.el('div', { class: 'empty', style: 'padding:20px 10px' }, 'Noch keine Übungen hinzugefügt.'));
      }

      return App.el('div', {}, [
        App.el('h3', {}, isNew ? 'Neues Workout' : 'Workout bearbeiten'),
        App.el('div', { class: 'row', style: 'gap:10px;align-items:flex-end' }, [
          App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Name'), nameInput]),
          App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Kategorie'), tagSelect]),
          manageCatBtn,
        ]),
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
          w.exercises.push({
            exerciseId: ex.id,
            sets: [
              { reps: 10, weight: 0, rir: null, warmup: false },
              { reps: 10, weight: 0, rir: null, warmup: false },
              { reps: 10, weight: 0, rir: null, warmup: false },
            ],
            restSeconds: opts.defaultRestSeconds,
            notes: '',
            unilateral: !!ex.unilateral,
            alternating: ex.alternating !== false,
            trackBodyweight: !!ex.trackBodyweight,
          });
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

  async renderExerciseRow(w, i, expanded, renderBody, opts) {
    const entry = w.exercises[i];
    const ex = await Exercises.byId(entry.exerciseId);
    const isOpen = expanded.has(i);

    const header = App.el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { if (isOpen) expanded.delete(i); else expanded.add(i); renderBody(); } }, [
      App.positionChip(i, ex ? ex.name : ''),
      App.el('div', { style: 'flex:1;min-width:0' }, [
        App.el('div', { class: 'item-title' }, ex ? ex.name : '(gelöschte Übung)'),
        App.el('div', { class: 'item-meta' }, entry.sets.length === 1 ? '1 Satz' : `${entry.sets.length} Sätze`),
      ]),
      App.el('span', { html: isOpen ? Icons.chevronUp() : Icons.chevronDown(), style: 'width:18px;height:18px;color:var(--text-dim);flex-shrink:0' }),
    ]);

    const item = App.el('div', { class: 'item', style: 'flex-direction:column;align-items:stretch;gap:8px' }, [header]);

    if (isOpen) {
      const controls = App.el('div', { class: 'row', style: 'gap:6px;padding-top:4px;border-top:1px solid var(--border)' }, [
        App.el('button', { class: 'btn secondary', style: 'flex:1;padding:8px', onclick: () => { if (i > 0) { [w.exercises[i - 1], w.exercises[i]] = [w.exercises[i], w.exercises[i - 1]]; renderBody(); } } }, [App.el('span', { html: Icons.chevronUp(), style: 'width:16px;height:16px' }), 'Hoch']),
        App.el('button', { class: 'btn secondary', style: 'flex:1;padding:8px', onclick: () => { if (i < w.exercises.length - 1) { [w.exercises[i + 1], w.exercises[i]] = [w.exercises[i], w.exercises[i + 1]]; renderBody(); } } }, [App.el('span', { html: Icons.chevronDown(), style: 'width:16px;height:16px' }), 'Runter']),
        App.el('button', { class: 'icon-btn', title: 'Löschen', html: Icons.trash(), onclick: () => { w.exercises.splice(i, 1); expanded.delete(i); renderBody(); } }),
      ]);
      item.appendChild(controls);
      item.appendChild(App.el('button', {
        class: 'gradient-border-btn',
        onclick: () => Exercises.showPersonalRecords(entry.exerciseId, ex ? ex.name : ''),
      }, 'Persönliche Rekorde'));
      const cols = ['54px', '1fr', '1fr'];
      if (opts.recordIntensity) cols.push('56px');
      if (opts.trackWarmupSets) cols.push('30px');
      cols.push('30px');
      const gridStyle = `display:grid;grid-template-columns:${cols.join(' ')};gap:8px;align-items:center;`;

      const setsBox = App.el('div', { class: 'list' }, [
        App.el('div', { class: 'set-row-header', style: gridStyle }, [
          App.el('span', {}, ''), App.el('span', {}, 'Gewicht'), App.el('span', {}, 'Wdh.'),
          opts.recordIntensity ? App.el('span', {}, opts.intensityLabel) : null,
          opts.trackWarmupSets ? App.el('span', {}, '') : null,
          App.el('span', {}, ''),
        ]),
      ]);
      entry.sets.forEach((set, si) => {
        const weightInput = App.el('input', { type: 'number', class: 'set-input', value: set.weight, step: '0.5', style: 'text-align:center', inputmode: 'decimal' });
        weightInput.addEventListener('input', (e) => { set.weight = Number(e.target.value) || 0; });
        const repsInput = App.el('input', { type: 'number', class: 'set-input', value: set.reps, style: 'text-align:center', inputmode: 'numeric' });
        repsInput.addEventListener('input', (e) => { set.reps = Number(e.target.value) || 0; });

        const row = [
          App.el('div', {}, [
            App.el('div', { class: 'set-label' }, 'Satz'),
            App.el('div', { class: 'set-label-value' }, String(si + 1).padStart(2, '0')),
          ]),
          weightInput, repsInput,
        ];
        if (opts.recordIntensity) {
          const rirInput = App.el('input', { type: 'number', class: 'set-input', value: set.rir ?? '', placeholder: '–', style: 'text-align:center', inputmode: 'numeric' });
          rirInput.addEventListener('input', (e) => { set.rir = e.target.value === '' ? null : Number(e.target.value); });
          row.push(rirInput);
        }
        if (opts.trackWarmupSets) {
          row.push(App.el('button', {
            class: 'icon-btn' + (set.warmup ? ' active-warmup' : ''), title: 'Als Aufwärmsatz markieren', html: Icons.flame(),
            onclick: () => { set.warmup = !set.warmup; renderBody(); },
          }));
        }
        row.push(App.el('button', { class: 'icon-btn', title: 'Schließen', html: Icons.close(), onclick: () => { entry.sets.splice(si, 1); renderBody(); } }));
        setsBox.appendChild(App.el('div', { class: 'set-row', style: gridStyle }, row));
      });
      item.appendChild(setsBox);
      item.appendChild(App.el('button', { class: 'btn secondary', onclick: () => { entry.sets.push({ reps: 10, weight: entry.sets.at(-1)?.weight || 0, rir: null, warmup: false }); renderBody(); } }, '+ Satz'));

      item.appendChild(App.switchRow('Einseitige Übung (unilateral)', 'Sätze werden pro Seite (L/R) einzeln erfasst, z.B. L1/R1.', !!entry.unilateral, (val) => { entry.unilateral = val; renderBody(); }));

      const restInput = App.el('input', { type: 'number', value: entry.restSeconds ?? opts.defaultRestSeconds, style: 'width:80px;text-align:center' });
      restInput.addEventListener('input', (e) => { entry.restSeconds = Number(e.target.value) || 0; });
      item.appendChild(App.el('div', { class: 'row', style: 'gap:8px;margin-top:4px' }, [App.el('span', { class: 'tag' }, 'Pause (Sek.)'), restInput]));

      const notesInput = App.el('textarea', { placeholder: 'Notizen zur Übung (optional)', style: 'min-height:50px' }, entry.notes || '');
      notesInput.addEventListener('input', (e) => { entry.notes = e.target.value; });
      item.appendChild(notesInput);
    }

    return item;
  },
};
