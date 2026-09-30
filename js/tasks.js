const TasksView = {
  filter: 'open',

  async render() {
    const wrap = App.el('div');
    const tasks = await DB.getAll('tasks');
    tasks.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.createdAt - a.createdAt);

    const filterRow = App.el('div', { class: 'fab-row' }, [
      this.filterBtn('open', 'Offen'),
      this.filterBtn('done', 'Erledigt'),
      this.filterBtn('all', 'Alle'),
    ]);
    wrap.appendChild(filterRow);

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.openEditor() }, [
      App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px' }), 'Neue Aufgabe',
    ]));
    wrap.appendChild(App.el('div', { style: 'height:14px' }));

    let visible = tasks;
    if (this.filter === 'open') visible = tasks.filter((t) => !t.done);
    if (this.filter === 'done') visible = tasks.filter((t) => t.done);

    const list = App.el('div', { class: 'list' });
    if (visible.length === 0) {
      list.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.tasks() }),
        'Keine Aufgaben hier.',
      ]));
    }
    const today = App.todayStr();
    visible.forEach((t, i) => {
      const overdue = t.dueDate && t.dueDate < today && !t.done;
      const item = App.el('div', { class: 'item' + (t.done ? ' done' : ''), style: `animation-delay:${i * 30}ms` }, [
        App.el('button', {
          class: 'checkbox' + (t.done ? ' checked' : ''),
          html: Icons.check(),
          onclick: (e) => this.toggleDone(t, e.currentTarget),
        }),
        App.el('div', { style: 'flex:1;cursor:pointer', onclick: () => this.openEditor(t) }, [
          App.el('div', { class: 'item-title' }, t.title),
          App.el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [
            t.dueDate ? App.el('span', { class: 'pill' + (overdue ? ' overdue' : '') }, App.formatDate(t.dueDate)) : null,
            t.planStart != null && !t.done ? App.el('span', { class: 'pill active' }, `${App.formatDate(t.planDate).slice(0, 6)} ${Planner.fmt(t.planStart)}`) : null,
            t.duration ? App.el('span', { class: 'pill' }, Planner.fmtDur(t.duration)) : null,
            t.repeat && t.repeat !== 'none' ? App.el('span', { class: 'pill' }, Planner.REPEAT_LABEL[t.repeat]) : null,
          ]),
        ]),
        App.el('button', { class: 'icon-btn', html: Icons.trash(), onclick: (e) => this.remove(t, e) }),
      ]);
      list.appendChild(item);
    });
    wrap.appendChild(list);
    return wrap;
  },

  filterBtn(key, label) {
    return App.el('button', {
      class: 'btn secondary' + (this.filter === key ? ' selected' : ''),
      onclick: () => { this.filter = key; App.refresh(); },
    }, label);
  },

  async toggleDone(t, btn) {
    t.done = !t.done;
    t.updatedAt = Date.now();
    if (btn) btn.classList.add('pop');
    await DB.put('tasks', t);
    if (t.done) await Planner.spawnNext(t);
    setTimeout(() => App.refresh(), t.done ? 220 : 0);
  },

  async remove(t, e) {
    const el = e.currentTarget.closest('.item');
    if (el) el.classList.add('removing');
    setTimeout(async () => {
      await DB.delete('tasks', t.id);
      App.refresh();
    }, 220);
  },

  openEditor(task) {
    const isNew = !task;
    const t = task ? { ...task } : { id: DB.uid(), title: '', dueDate: '', priority: 'normal', notes: '', done: false, createdAt: Date.now() };

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
      t.planStart != null ? App.el('button', { class: 'btn secondary', style: 'margin-bottom:12px', onclick: async () => {
        t.planDate = null; t.planStart = null; t.updatedAt = Date.now();
        await DB.put('tasks', t); App.closeModal(); App.refresh();
      } }, `Aus Plan nehmen (${App.formatDate(t.planDate).slice(0, 6)} ${Planner.fmt(t.planStart)})`) : null,
      !isNew ? App.el('button', { class: 'btn secondary', style: 'margin-bottom:12px', onclick: () => {
        if (FocusView.prepare({ minutes: Math.min(t.duration || 25, 120), intention: t.title, taskId: t.id })) {
          PlanenHub.activeTab = 'focus'; App.closeModal(); App.navigate('planen');
        } else Planner.toast('Es läuft bereits ein Fokus.');
      } }, [App.el('span', { html: Icons.focus(), style: 'width:16px;height:16px' }), 'Fokus dazu starten']) : null,
      t.actual ? App.el('p', { class: 'tag', style: 'margin:0 0 12px' }, `Tatsächlich ${Planner.fmtDur(t.actual)} gearbeitet${t.duration ? ` (geplant ${Planner.fmtDur(t.duration)})` : ''}.`) : null,
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
            t.notes = notesInput.value;
            t.updatedAt = Date.now();
            await DB.put('tasks', t);
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => titleInput.focus(), 50);
  },
};
