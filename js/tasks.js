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

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.openEditor() }, '+ Neue Aufgabe'));
    wrap.appendChild(App.el('div', { style: 'height:12px' }));

    let visible = tasks;
    if (this.filter === 'open') visible = tasks.filter((t) => !t.done);
    if (this.filter === 'done') visible = tasks.filter((t) => t.done);

    const list = App.el('div', { class: 'list' });
    if (visible.length === 0) {
      list.appendChild(App.el('div', { class: 'empty' }, 'Keine Aufgaben hier.'));
    }
    const today = App.todayStr();
    for (const t of visible) {
      const overdue = t.dueDate && t.dueDate < today && !t.done;
      const item = App.el('div', { class: 'item' + (t.done ? ' done' : '') }, [
        App.el('button', {
          class: 'checkbox' + (t.done ? ' checked' : ''),
          onclick: () => this.toggleDone(t),
        }, t.done ? '✓' : ''),
        App.el('div', { style: 'flex:1;cursor:pointer', onclick: () => this.openEditor(t) }, [
          App.el('div', { class: 'item-title' }, t.title),
          t.dueDate ? App.el('span', { class: 'pill' + (overdue ? ' overdue' : '') }, App.formatDate(t.dueDate)) : null,
        ]),
        App.el('button', { class: 'icon-btn', onclick: () => this.remove(t) }, '🗑️'),
      ]);
      list.appendChild(item);
    }
    wrap.appendChild(list);
    return wrap;
  },

  filterBtn(key, label) {
    return App.el('button', {
      class: 'btn secondary',
      style: this.filter === key ? 'outline:2px solid var(--accent)' : '',
      onclick: () => { this.filter = key; App.refresh(); },
    }, label);
  },

  async toggleDone(t) {
    t.done = !t.done;
    t.updatedAt = Date.now();
    await DB.put('tasks', t);
    App.refresh();
  },

  async remove(t) {
    await DB.delete('tasks', t.id);
    App.refresh();
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
