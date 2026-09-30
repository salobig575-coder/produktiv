const NotesView = {
  query: '',

  async render() {
    const wrap = App.el('div');
    let notes = await DB.getAll('notes');
    notes.sort((a, b) => b.updatedAt - a.updatedAt);

    const search = App.el('input', {
      type: 'text', placeholder: 'Notizen durchsuchen…', value: this.query,
      oninput: (e) => { this.query = e.target.value; this.rerenderList(list, notes); },
    });
    const searchWrap = App.el('div', { class: 'field', style: 'position:relative' }, [
      App.el('span', { html: Icons.search(), style: 'position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-dim)' }),
      search,
    ]);
    search.style.paddingLeft = '38px';
    wrap.appendChild(searchWrap);
    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.openEditor() }, [
      App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px' }), 'Neue Notiz',
    ]));
    wrap.appendChild(App.el('div', { style: 'height:14px' }));

    const list = App.el('div', { class: 'list' });
    wrap.appendChild(list);
    this.rerenderList(list, notes);
    return wrap;
  },

  rerenderList(list, notes) {
    list.innerHTML = '';
    const q = this.query.toLowerCase();
    const filtered = q ? notes.filter((n) => (n.title + ' ' + n.content).toLowerCase().includes(q)) : notes;
    if (filtered.length === 0) {
      list.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.notes() }),
        'Keine Notizen gefunden.',
      ]));
      return;
    }
    filtered.forEach((n, i) => {
      const preview = (n.content || '').slice(0, 80);
      list.appendChild(App.el('div', { class: 'item', style: `align-items:flex-start;cursor:pointer;animation-delay:${i * 30}ms`, onclick: () => this.openEditor(n) }, [
        App.el('span', { html: Icons.notes(), style: 'width:20px;height:20px;color:var(--accent);flex-shrink:0;margin-top:2px' }),
        App.el('div', { style: 'flex:1' }, [
          App.el('div', { class: 'item-title' }, n.title || '(ohne Titel)'),
          App.el('div', { class: 'item-meta' }, preview),
        ]),
        App.el('button', { class: 'icon-btn', title: 'Löschen', html: Icons.trash(), onclick: (e) => { e.stopPropagation(); this.remove(n, e); } }),
      ]));
    });
  },

  async remove(n, e) {
    const el = e.currentTarget.closest('.item');
    if (el) el.classList.add('removing');
    setTimeout(async () => {
      await DB.delete('notes', n.id);
      App.refresh();
    }, 220);
  },

  openEditor(note) {
    const isNew = !note;
    const n = note ? { ...note } : { id: DB.uid(), title: '', content: '', createdAt: Date.now() };

    const titleInput = App.el('input', { type: 'text', value: n.title, placeholder: 'Titel' });
    const contentInput = App.el('textarea', { placeholder: 'Deine Notiz…', style: 'min-height:200px' }, n.content || '');

    const content = App.el('div', {}, [
      App.el('h3', {}, isNew ? 'Neue Notiz' : 'Notiz bearbeiten'),
      App.el('div', { class: 'field' }, [titleInput]),
      App.el('div', { class: 'field' }, [contentInput]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            n.title = titleInput.value.trim();
            n.content = contentInput.value;
            n.updatedAt = Date.now();
            await DB.put('notes', n);
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
