const StepsTracking = {
  async forDate(date) {
    const all = await DB.getAll('stepLogs');
    return all.find((s) => s.date === date) || null;
  },

  async log(date, steps) {
    const existing = await this.forDate(date);
    const rec = existing || { id: DB.uid(), date };
    rec.steps = steps;
    await DB.put('stepLogs', rec);
    return rec;
  },

  async goal() {
    const row = await DB.get('settings', 'stepGoal');
    return row ? row.value : 8000;
  },

  async card(selectedDate) {
    const entry = await this.forDate(selectedDate);
    const goal = await this.goal();
    const steps = entry ? entry.steps : 0;
    const pct = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0;
    return App.el('div', { class: 'card' }, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:6px' }, [
        App.el('h2', { style: 'margin:0' }, 'Schritte'),
        App.el('span', { class: 'tag' }, entry ? `${pct}%` : 'NICHT ERFASST'),
      ]),
      App.el('div', { style: 'font-size:26px;font-weight:800;margin-bottom:10px' }, `${steps.toLocaleString('de-DE')} / ${goal.toLocaleString('de-DE')}`),
      App.el('button', { class: 'btn secondary', onclick: () => this.openEntry(selectedDate) }, 'Schritte erfassen'),
    ]);
  },

  openEntry(date) {
    const input = App.el('input', { type: 'number', inputmode: 'numeric', placeholder: 'z.B. 6500' });
    const content = App.el('div', {}, [
      App.el('h3', {}, 'Schritte erfassen'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Schritte'), input]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            if (!input.value) { input.focus(); return; }
            await StepsTracking.log(date, Number(input.value));
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => input.focus(), 50);
  },
};

const SleepTracking = {
  async forDate(date) {
    const all = await DB.getAll('sleepLogs');
    return all.find((s) => s.date === date) || null;
  },

  async log(date, hours) {
    const existing = await this.forDate(date);
    const rec = existing || { id: DB.uid(), date };
    rec.hours = hours;
    await DB.put('sleepLogs', rec);
    return rec;
  },

  async sevenDayAvg(beforeDate) {
    const all = await DB.getAll('sleepLogs');
    const end = new Date(beforeDate + 'T00:00:00');
    const cutoff = new Date(end);
    cutoff.setDate(cutoff.getDate() - 6);
    const inRange = all.filter((s) => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= cutoff && d <= end;
    });
    if (!inRange.length) return null;
    return inRange.reduce((sum, s) => sum + s.hours, 0) / inRange.length;
  },

  async card(selectedDate) {
    const entry = await this.forDate(selectedDate);
    const avg = await this.sevenDayAvg(selectedDate);
    return App.el('div', { class: 'card' }, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:6px' }, [
        App.el('h2', { style: 'margin:0' }, 'Schlaf'),
        App.el('span', { class: 'tag' }, entry ? App.formatDate(selectedDate) : 'NICHT ERFASST'),
      ]),
      App.el('div', { style: 'font-size:26px;font-weight:800;margin-bottom:2px' }, entry ? `${entry.hours} h` : '--'),
      App.el('div', { class: 'tag', style: 'margin-bottom:10px' }, `7-Tage-Durchschnitt ${avg != null ? avg.toFixed(1) + ' h' : '--'}`),
      App.el('button', { class: 'btn secondary', onclick: () => this.openEntry(selectedDate) }, 'Schlaf eintragen'),
    ]);
  },

  openEntry(date) {
    const input = App.el('input', { type: 'number', step: '0.1', inputmode: 'decimal', placeholder: 'z.B. 7.5' });
    const content = App.el('div', {}, [
      App.el('h3', {}, 'Schlaf eintragen'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Stunden'), input]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            if (!input.value) { input.focus(); return; }
            await SleepTracking.log(date, Number(input.value));
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => input.focus(), 50);
  },
};

const ProgressPhotos = {
  async forDate(date) {
    const all = await DB.getAll('progressPhotos');
    return all.filter((p) => p.date === date);
  },

  async card(selectedDate) {
    const photos = await this.forDate(selectedDate);
    const fileInput = App.el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      await DB.put('progressPhotos', { id: DB.uid(), date: selectedDate, blob: file, createdAt: Date.now() });
      App.refresh();
    });
    const thumbs = photos.map((p) => App.el('img', {
      src: URL.createObjectURL(p.blob), style: 'width:64px;height:64px;object-fit:cover;border-radius:10px;cursor:pointer;flex-shrink:0',
      onclick: () => this.openViewer(p),
    }));
    return App.el('div', { class: 'card' }, [
      App.el('h2', {}, 'Physis'),
      App.el('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' }, [
        ...thumbs,
        App.el('button', { class: 'icon-btn', style: 'width:64px;height:64px;flex-shrink:0', html: Icons.plus(), title: 'Foto hinzufügen', onclick: () => fileInput.click() }),
      ]),
      fileInput,
    ]);
  },

  openViewer(photo) {
    const content = App.el('div', {}, [
      App.el('h3', {}, App.formatDate(photo.date)),
      App.el('img', { src: URL.createObjectURL(photo.blob), style: 'width:100%;border-radius:12px;margin-bottom:14px' }),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Schließen'),
        App.el('button', {
          class: 'btn danger', onclick: async () => { await DB.delete('progressPhotos', photo.id); App.closeModal(); App.refresh(); },
        }, 'Löschen'),
      ]),
    ]);
    App.showModal(content);
  },
};

const Gyms = {
  async all() {
    return DB.getAll('gyms');
  },

  async add(name) {
    const gym = { id: DB.uid(), name, equipment: [], createdAt: Date.now() };
    await DB.put('gyms', gym);
    return gym;
  },

  async remove(id) {
    await DB.delete('gyms', id);
  },

  async addEquipment(gymId, item) {
    const gym = await DB.get('gyms', gymId);
    if (!gym) return;
    gym.equipment = gym.equipment || [];
    if (!gym.equipment.includes(item)) gym.equipment.push(item);
    await DB.put('gyms', gym);
  },

  async removeEquipment(gymId, item) {
    const gym = await DB.get('gyms', gymId);
    if (!gym) return;
    gym.equipment = (gym.equipment || []).filter((e) => e !== item);
    await DB.put('gyms', gym);
  },

  manage() {
    const container = App.el('div');
    App.showModal(App.el('div', {}, [container]));

    const renderBody = async () => {
      const gyms = await this.all();
      const list = App.el('div', { class: 'list' });
      if (gyms.length === 0) {
        list.appendChild(App.el('div', { class: 'empty', style: 'padding:14px 10px' }, 'Noch keine Fitnessstudios angelegt.'));
      }
      for (const gym of gyms) {
        const eqInput = App.el('input', { type: 'text', placeholder: 'Ausrüstung hinzufügen, z.B. Langhantel' });
        eqInput.addEventListener('keydown', async (e) => {
          if (e.key !== 'Enter' || !eqInput.value.trim()) return;
          await this.addEquipment(gym.id, eqInput.value.trim());
          renderBody();
        });
        list.appendChild(App.el('div', { class: 'item', style: 'flex-direction:column;align-items:stretch;gap:8px' }, [
          App.el('div', { class: 'row', style: 'justify-content:space-between' }, [
            App.el('div', { class: 'item-title' }, gym.name),
            App.el('button', { class: 'icon-btn', html: Icons.trash(), onclick: async () => { await this.remove(gym.id); renderBody(); } }),
          ]),
          App.el('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' }, (gym.equipment || []).map((eq) =>
            App.el('span', { class: 'pill', style: 'cursor:pointer', title: 'Entfernen', onclick: async () => { await this.removeEquipment(gym.id, eq); renderBody(); } }, eq + ' ×'))),
          eqInput,
        ]));
      }
      const nameInput = App.el('input', { type: 'text', placeholder: 'Neues Fitnessstudio, z.B. McFit' });
      container.innerHTML = '';
      container.appendChild(App.el('h3', {}, 'Fitnessstudios & Ausrüstung'));
      container.appendChild(list);
      container.appendChild(App.el('div', { class: 'field' }, [nameInput]));
      container.appendChild(App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Fertig'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            const name = nameInput.value.trim();
            if (!name) return;
            await this.add(name);
            renderBody();
          },
        }, [App.el('span', { html: Icons.plus(), style: 'width:16px;height:16px' }), 'Hinzufügen']),
      ]));
    };
    renderBody();
  },

  async pickForSession(sessionId) {
    const gyms = await this.all();
    const nameInput = App.el('input', { type: 'text', placeholder: 'Neues Fitnessstudio anlegen…' });
    const assign = async (gym) => {
      const s = await DB.get('workoutSessions', sessionId);
      if (s) { s.gymId = gym.id; s.gymName = gym.name; await DB.put('workoutSessions', s); }
      App.closeModal();
      App.refresh();
    };
    const list = App.el('div', { class: 'list' }, gyms.map((gym) =>
      App.el('div', { class: 'item', style: 'cursor:pointer', onclick: () => assign(gym) }, [
        App.el('div', { class: 'item-title' }, gym.name),
      ])));
    const content = App.el('div', {}, [
      App.el('h3', {}, 'Gym für dieses Workout'),
      gyms.length ? list : App.el('div', { class: 'empty', style: 'padding:10px' }, 'Noch keine Fitnessstudios angelegt.'),
      App.el('div', { class: 'field' }, [nameInput]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            const name = nameInput.value.trim();
            if (!name) return;
            const gym = await Gyms.add(name);
            await assign(gym);
          },
        }, 'Anlegen & übernehmen'),
      ]),
    ]);
    App.showModal(content);
  },
};
