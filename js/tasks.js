const TasksView = {
  filter: 'open',

  async render() {
    const wrap = App.el('div');
    const tasks = await DB.getAll('tasks');
    tasks.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.createdAt - a.createdAt);
    const today = App.todayStr();

    const seg = (key, label) => App.el('button', { class: this.filter === key ? 'active' : '', onclick: () => { this.filter = key; App.refresh(); } }, label);
    wrap.appendChild(App.el('div', { class: 'cal-head' }, [
      App.el('div', { class: 'seg' }, [seg('open', 'Offen'), seg('done', 'Erledigt'), seg('all', 'Alle')]),
      App.el('button', { class: 'fab-mini', html: Icons.plus(), title: 'Neue Aufgabe', onclick: () => this.openEditor() }),
    ]));

    let visible = tasks;
    if (this.filter === 'open') visible = tasks.filter((t) => !t.done);
    if (this.filter === 'done') visible = tasks.filter((t) => t.done);

    if (visible.length === 0) {
      wrap.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.tasks() }),
        this.filter === 'done' ? 'Noch nichts erledigt.' : 'Keine Aufgaben – tippe auf +.',
      ]));
      return wrap;
    }

    // Offene Aufgaben nach Dringlichkeit gruppieren, sonst eine Liste
    const inDays = (n) => Planner.addDays(today, n);
    const groups = this.filter === 'open' ? [
      ['Überfällig', visible.filter((t) => t.dueDate && t.dueDate < today)],
      ['Heute', visible.filter((t) => t.dueDate === today)],
      ['Diese Woche', visible.filter((t) => t.dueDate > today && t.dueDate <= inDays(7))],
      ['Später', visible.filter((t) => t.dueDate > inDays(7))],
      ['Ohne Datum', visible.filter((t) => !t.dueDate)],
    ] : [[null, visible]];

    let n = 0;
    for (const [title, rows] of groups) {
      if (!rows.length) continue;
      const card = App.el('div', { class: 'card', style: 'padding:6px 16px' });
      const list = App.el('div', { class: 'line-list' });
      rows.forEach((t) => { list.appendChild(this.row(t, today, n++)); });
      card.appendChild(list);
      if (title) {
        const label = App.el('div', { class: 'section-label row' + (title === 'Überfällig' ? ' danger' : ''), style: 'justify-content:space-between' }, [`${title} · ${rows.length}`]);
        if (title === 'Überfällig') {
          label.appendChild(App.el('button', { class: 'mini-link', onclick: async () => {
            const before = rows.map((t) => ({ id: t.id, due: t.dueDate }));
            for (const t of rows) { t.dueDate = today; t.updatedAt = Date.now(); await DB.put('tasks', t); }
            App.refresh();
            Planner.toast(`${rows.length} auf heute gelegt.`, { label: 'Rückgängig', fn: async () => {
              for (const b of before) { const t = await DB.get('tasks', b.id); if (t) { t.dueDate = b.due; await DB.put('tasks', t); } }
              App.refresh();
            } });
          } }, 'Alle auf heute'));
        }
        wrap.appendChild(label);
      }
      wrap.appendChild(card);
    }
    return wrap;
  },

  row(t, today, i) {
    const overdue = t.dueDate && t.dueDate < today && !t.done;
    const pills = [
      t.planStart != null && !t.done ? App.el('span', { class: 'pill active' }, `${App.formatDate(t.planDate).slice(0, 6)} ${Planner.fmt(t.planStart)}`) : null,
      t.dueDate && this.filter !== 'open' ? App.el('span', { class: 'pill' + (overdue ? ' overdue' : '') }, App.formatDate(t.dueDate)) : null,
      t.dueDate && this.filter === 'open' && t.dueDate !== today ? App.el('span', { class: 'pill' + (overdue ? ' overdue' : '') }, App.formatDate(t.dueDate).slice(0, 6)) : null,
      t.duration ? App.el('span', { class: 'pill' }, Planner.fmtDur(t.duration)) : null,
      t.subtasks && t.subtasks.length ? App.el('span', { class: 'pill' }, `${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}`) : null,
      t.repeat && t.repeat !== 'none' ? App.el('span', { class: 'pill' }, Planner.REPEAT_LABEL[t.repeat]) : null,
      t.priority === 'high' ? App.el('span', { class: 'pill overdue' }, 'Hoch') : null,
    ].filter(Boolean);
    return App.el('div', { class: 'line' + (t.done ? ' done' : ''), style: `animation:popIn .35s var(--ease) both;animation-delay:${Math.min(i, 8) * 25}ms` }, [
      App.el('button', { class: 'checkbox' + (t.done ? ' checked' : ''), html: Icons.check(), onclick: (e) => this.toggleDone(t, e.currentTarget) }),
      App.el('div', { class: 'line-main', style: 'cursor:pointer', onclick: () => this.openEditor(t) }, [
        App.el('div', { class: 'item-title', style: 'white-space:normal' }, t.title),
        pills.length ? App.el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-top:4px' }, pills) : null,
      ]),
    ]);
  },

  filterBtn(key, label) {
    return App.el('button', {
      class: 'btn secondary' + (this.filter === key ? ' selected' : ''),
      onclick: () => { this.filter = key; App.refresh(); },
    }, label);
  },

  async deleteTask(t) {
    await DB.delete('tasks', t.id);
    App.refresh();
    Planner.toast('Aufgabe gelöscht.', { label: 'Rückgängig', fn: async () => { await DB.put('tasks', t); App.refresh(); } });
  },

  async toggleDone(t, btn) {
    t.done = !t.done;
    t.updatedAt = Date.now();
    if (btn) btn.classList.add('pop');
    if (t.done) {
      App.confetti(btn, 10);
      const row = btn && btn.closest('.line');
      if (row && this.filter === 'open') row.classList.add('leaving');
    }
    await DB.put('tasks', t);
    if (t.done) await Planner.spawnNext(t);
    setTimeout(() => App.refresh(), t.done ? 320 : 0);
  },

  async remove(t, e) {
    const el = e.currentTarget.closest('.item');
    if (el) el.classList.add('removing');
    setTimeout(async () => {
      await DB.delete('tasks', t.id);
      App.refresh();
      Planner.toast('Aufgabe gelöscht.', { label: 'Rückgängig', fn: async () => { await DB.put('tasks', t); App.refresh(); } });
    }, 220);
  },

  openEditor(task) {
    const isNew = !task;
    const t = task ? { ...task } : { id: DB.uid(), title: '', dueDate: '', priority: 'normal', notes: '', done: false, createdAt: Date.now() };
    t.subtasks = (t.subtasks || []).map((st) => ({ ...st }));
    const subsBox = App.el('div', { class: 'list', style: 'margin-bottom:8px' });
    const drawSubs = () => {
      subsBox.innerHTML = '';
      t.subtasks.forEach((st) => subsBox.appendChild(App.el('div', { class: 'item' + (st.done ? ' done' : ''), style: 'padding:8px 12px;animation:none' }, [
        App.el('button', { class: 'checkbox' + (st.done ? ' checked' : ''), html: Icons.check(), onclick: () => { st.done = !st.done; drawSubs(); } }),
        App.el('div', { class: 'item-title', style: 'flex:1;min-width:0' }, st.title),
        App.el('button', { class: 'icon-btn', title: 'Löschen', html: Icons.trash(), onclick: () => { t.subtasks = t.subtasks.filter((x) => x.id !== st.id); drawSubs(); } }),
      ])));
    };
    const subInput = App.el('input', { type: 'text', placeholder: 'Unteraufgabe hinzufügen …', enterkeyhint: 'done' });
    const addSub = () => {
      const v = subInput.value.trim();
      if (!v) return;
      t.subtasks.push({ id: DB.uid(), title: v, done: false });
      subInput.value = '';
      drawSubs();
    };
    subInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
    drawSubs();

    const titleInput = App.el('input', { type: 'text', value: t.title, placeholder: 'Was ist zu tun?' });
    const dueInput = App.el('input', { type: 'date', value: t.dueDate || '' });
    const prioSelect = App.el('select', {}, [
      App.el('option', { value: 'low' }, 'Niedrig'),
      App.el('option', { value: 'normal' }, 'Normal'),
      App.el('option', { value: 'high' }, 'Hoch'),
    ]);
    prioSelect.value = t.priority || 'normal';
    const durSelect = App.el('select', {}, [App.el('option', { value: '' }, 'Keine Angabe (30 min)')].concat([15, 30, 45, 60, 90, 120, 180, 240].map((m) => App.el('option', { value: m }, Planner.fmtDur(m)))));
    durSelect.value = t.duration ? String(t.duration) : '';
    const repeatSelect = App.el('select', {}, Object.entries(Planner.REPEAT_LABEL).map(([k, l]) => App.el('option', { value: k }, l)));
    repeatSelect.value = t.repeat || 'none';
    const untilInput = App.el('input', { type: 'date', value: t.repeatUntil || '' });
    const untilField = App.el('div', { class: 'field', style: (t.repeat || 'none') === 'none' ? 'display:none' : '' }, [App.el('label', {}, 'Wiederholen bis (optional)'), untilInput]);
    repeatSelect.addEventListener('change', () => { untilField.style.display = repeatSelect.value === 'none' ? 'none' : ''; });
    const notesInput = App.el('textarea', { placeholder: 'Notizen (optional)' }, t.notes || '');

    const content = App.el('div', {}, [
      App.el('h3', {}, isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Titel'), titleInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Fällig am'), dueInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Priorität'), prioSelect]),
      App.el('div', { class: 'row' }, [
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Dauer'), durSelect]),
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Wiederholung'), repeatSelect]),
      ]),
      untilField,
      t.planStart != null ? App.el('button', { class: 'btn secondary', style: 'margin-bottom:12px', onclick: async () => {
        t.planDate = null; t.planStart = null; t.updatedAt = Date.now();
        await DB.put('tasks', t); App.closeModal(); App.refresh();
      } }, `Aus Plan nehmen (${App.formatDate(t.planDate).slice(0, 6)} ${Planner.fmt(t.planStart)})`) : null,
      !isNew ? App.el('button', { class: 'btn secondary', style: 'margin-bottom:12px', onclick: () => {
        if (FocusView.prepare({ minutes: Math.min(t.duration || 25, 120), intention: t.title, taskId: t.id })) {
          PlanenHub.activeTab = 'focus'; App.closeModal(); App.navigate('planen');
        } else Planner.toast('Es läuft bereits ein Fokus.');
      } }, [App.el('span', { html: Icons.focus(), style: 'width:16px;height:16px' }), 'Fokus dazu starten']) : null,
      !isNew ? App.el('button', { class: 'btn secondary', style: 'margin-bottom:12px', onclick: (e) => this.aiBreakdown(t, e.currentTarget) }, [App.el('span', { html: Icons.sparkles(), style: 'width:16px;height:16px' }), 'Mit KI in Schritte zerlegen']) : null,
      t.actual ? App.el('p', { class: 'tag', style: 'margin:0 0 12px' }, `Tatsächlich ${Planner.fmtDur(t.actual)} gearbeitet${t.duration ? ` (geplant ${Planner.fmtDur(t.duration)})` : ''}.`) : null,
      App.el('div', { class: 'field' }, [
        App.el('label', {}, 'Unteraufgaben'),
        subsBox,
        App.el('div', { class: 'row' }, [
          App.el('div', { style: 'flex:1' }, [subInput]),
          App.el('button', { class: 'icon-btn', style: 'color:var(--accent)', html: Icons.plus(), onclick: addSub }),
        ]),
      ]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Notizen'), notesInput]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            t.title = titleInput.value.trim();
            if (!t.title) { titleInput.focus(); return; }
            t.dueDate = dueInput.value || '';
            t.priority = prioSelect.value;
            t.duration = durSelect.value ? Number(durSelect.value) : null;
            t.repeat = repeatSelect.value;
            t.repeatUntil = t.repeat === 'none' ? '' : untilInput.value;
            addSub();
            t.notes = notesInput.value;
            t.updatedAt = Date.now();
            await DB.put('tasks', t);
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
      !isNew ? App.el('button', { class: 'btn danger', style: 'margin:8px 0 0', onclick: () => { App.closeModal(); this.deleteTask(task); } }, 'Löschen') : null,
    ]);
    App.showModal(content);
    setTimeout(() => titleInput.focus(), 50);
  },

  async aiBreakdown(t, btn) {
    if (!(await AI.enabled())) { Planner.toast('Erst in den Einstellungen unter „KI“ einen Zugang eintragen.'); return; }
    const label = btn.lastChild.textContent;
    btn.lastChild.textContent = 'Denke nach …';
    btn.disabled = true;
    try {
      const steps = await AI.breakdown(t);
      const rows = steps.map((st) => App.el('div', { class: 'item' }, [
        App.el('div', { style: 'flex:1;min-width:0' }, [App.el('div', { class: 'item-title' }, st.title), App.el('div', { class: 'tag' }, Planner.fmtDur(st.minutes))]),
      ]));
      App.closeModal();
      setTimeout(() => App.showModal(App.el('div', {}, [
        App.el('h3', { style: 'margin-bottom:4px' }, 'Vorgeschlagene Schritte'),
        App.el('div', { class: 'tag', style: 'margin-bottom:14px' }, t.title),
        App.el('div', { class: 'list', style: 'margin-bottom:14px' }, rows),
        App.el('div', { class: 'row' }, [
          App.el('button', { class: 'btn secondary', onclick: async () => {
            const cur = (await DB.get('tasks', t.id)) || t;
            cur.subtasks = [...(cur.subtasks || []), ...steps.map((st) => ({ id: DB.uid(), title: `${st.title} (${st.minutes} min)`, done: false }))];
            cur.updatedAt = Date.now();
            await DB.put('tasks', cur);
            App.closeModal();
            App.refresh();
            Planner.toast('Als Unteraufgaben gespeichert.');
          } }, 'Als Unteraufgaben'),
          App.el('button', { class: 'btn', onclick: async () => {
            for (const st of steps) {
              await DB.put('tasks', { id: DB.uid(), title: st.title, dueDate: t.dueDate || '', priority: t.priority || 'normal', notes: `Schritt zu: ${t.title}`, done: false, duration: st.minutes, repeat: 'none', createdAt: Date.now(), updatedAt: Date.now() });
            }
            App.closeModal();
            App.refresh();
            Planner.toast(`${steps.length} Schritte in der Inbox.`);
          } }, 'Als Aufgaben'),
        ]),
      ])), 230);
    } catch (e) {
      btn.lastChild.textContent = label;
      btn.disabled = false;
      Planner.toast(e.message);
    }
  },
};
