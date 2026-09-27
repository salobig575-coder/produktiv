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
          t.dueDate ? App.el('span', { class: 'pill' + (overdue ? ' overdue' : '') }, App.formatDate(t.dueDate)) : null,
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
    const notesInput = App.el('textarea', { placeholder: 'Notizen (optional)' }, t.notes || '');

    const content = App.el('div', {}, [
      App.el('h3', {}, isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Titel'), titleInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Fällig am'), dueInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Priorität'), prioSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Notizen'), notesInput]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            t.title = titleInput.value.trim();
            if (!t.title) { titleInput.focus(); return; }
            t.dueDate = dueInput.value || '';
            t.priority = prioSelect.value;
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
