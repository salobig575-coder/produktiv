const BodyMetrics = {
  async isEnabled() {
    const row = await DB.get('settings', 'weightTrackingEnabled');
    return row ? row.value !== false : true;
  },

  async targetWeightKg() {
    const row = await DB.get('settings', 'targetWeightKg');
    return row ? row.value : '';
  },

  async setTargetWeightKg(value) {
    await DB.put('settings', { key: 'targetWeightKg', value });
  },

  async all() {
    const rows = await DB.getAll('bodyMetrics');
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  },

  async forDate(dateStr) {
    const rows = await this.all();
    return rows.find((r) => r.date === dateStr) || null;
  },

  async latest() {
    const rows = await this.all();
    return rows.length ? rows[rows.length - 1] : null;
  },

  async log(dateStr, weightKg) {
    await DB.put('bodyMetrics', { id: `bm-${dateStr}`, date: dateStr, weight: Number(weightKg) });
  },

  async card(selectedDate) {
    if (!(await this.isEnabled())) return null;
    const latest = await this.latest();
    const target = await this.targetWeightKg();
    const rows = await this.all();
    const prevIdx = latest ? rows.findIndex((r) => r.id === latest.id) - 1 : -1;
    const prev = prevIdx >= 0 ? rows[prevIdx] : null;
    const diff = latest && prev ? Math.round((latest.weight - prev.weight) * 10) / 10 : 0;

    const card = App.el('div', { class: 'card' }, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [
        App.el('h2', { style: 'margin:0' }, [App.el('span', { html: Icons.weight(), style: 'width:14px;height:14px' }), 'Gewicht']),
        App.el('span', { class: 'pill' + (latest ? '' : ' overdue') }, latest ? App.formatDate(latest.date) : 'Nicht erfasst'),
      ]),
      App.el('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-end' }, [
        App.el('div', { style: 'font-size:30px;font-weight:800;letter-spacing:-.02em' }, [
          latest ? `${latest.weight} kg` : '–', diff ? App.delta(diff, { suffix: ' kg' }) : null,
        ]),
        target ? App.el('div', { style: 'text-align:right' }, [
          App.el('div', { style: 'font-size:14px;font-weight:700;color:var(--accent)' }, `${target} kg`),
          App.el('div', { class: 'tag' }, 'Ziel'),
        ]) : null,
      ]),
      App.el('button', { class: 'btn secondary', style: 'margin-top:12px', onclick: () => this.openQuickEntry(selectedDate) }, 'Gewicht erfassen'),
    ]);
    return card;
  },

  openQuickEntry(dateStr) {
    const existing = null;
    const weightInput = App.el('input', { type: 'number', step: '0.1', inputmode: 'decimal', placeholder: 'z.B. 76.5' });
    const targetInput = App.el('input', { type: 'number', step: '0.1', inputmode: 'decimal', placeholder: 'optional' });

    (async () => {
      const today = await this.forDate(dateStr || App.todayStr());
      if (today) weightInput.value = today.weight;
      const target = await this.targetWeightKg();
      if (target) targetInput.value = target;
    })();

    const content = App.el('div', {}, [
      App.el('h3', {}, 'Gewicht erfassen'),
      App.el('div', { class: 'field' }, [App.el('label', {}, `Gewicht am ${App.formatDate(dateStr || App.todayStr())} (kg)`), weightInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Zielgewicht (kg, optional)'), targetInput]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            if (weightInput.value) await this.log(dateStr || App.todayStr(), weightInput.value);
            if (targetInput.value) await this.setTargetWeightKg(Number(targetInput.value));
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => weightInput.focus(), 50);
  },
};
