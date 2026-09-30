const HabitsView = {
  // Eigene Reihenfolge (per Ziehen); neue Gewohnheiten ohne Wert landen hinten.
  orderOf(h) { return h.order != null ? h.order : h.createdAt; },

  async render() {
    const wrap = App.el('div');
    const habits = await DB.getAll('habits');
    habits.sort((a, b) => this.orderOf(a) - this.orderOf(b));
    const logs = await DB.getAll('habitLogs');

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.openEditor() }, [
      App.el('span', { html: Icons.plus(), style: 'width:18px;height:18px' }), 'Neue Gewohnheit',
    ]));
    wrap.appendChild(App.el('div', { style: 'height:14px' }));

    if (habits.length === 0) {
      wrap.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.habits() }),
        'Noch keine Gewohnheiten angelegt.',
      ]));
      return wrap;
    }

    const days = this.lastNDays(7);
    const card = App.el('div', { class: 'card' });
    const grid = App.el('div', { class: 'habit-grid' });

    grid.appendChild(App.el('div', {}));
    for (const d of days) {
      grid.appendChild(App.el('div', { class: 'head' }, d.label));
    }

    for (const h of habits) {
      const nameCell = App.el('div', { class: 'habit-name', style: 'cursor:pointer', onclick: () => this.openEditor(h) }, h.name);
      grid.appendChild(nameCell);
      for (const d of days) {
        const logged = logs.some((l) => l.habitId === h.id && l.date === d.iso);
        grid.appendChild(App.el('button', {
          class: 'dot' + (logged ? ' on' : ''),
          onclick: (e) => this.toggleLog(h.id, d.iso, e.currentTarget),
        }));
      }
    }
    card.appendChild(grid);
    wrap.appendChild(card);

    const list = App.el('div', { class: 'list' });
    for (const h of habits) {
      const streak = this.streak(logs, h.id);
      list.appendChild(App.el('div', { class: 'item', 'data-id': h.id }, [
        App.el('button', { class: 'grip', html: Icons.grip(), title: 'Reihenfolge ändern' }),
        App.el('span', { html: Icons.habits(), style: `width:20px;height:20px;flex-shrink:0;color:${streak > 0 ? 'var(--warn)' : 'var(--text-dim)'}` }),
        App.el('div', { style: 'flex:1;cursor:pointer', onclick: () => this.openEditor(h) }, [
          App.el('div', { class: 'item-title' }, h.name),
          App.el('div', { class: 'item-meta' }, (streak > 0 ? `${streak} ${streak === 1 ? "Tag" : "Tage"} in Folge` : 'Noch keine Serie') + (h.window ? ` · ${Planner.fmt(h.window.from)}–${Planner.fmt(h.window.to)}` : '')),
        ]),
        App.el('button', { class: 'icon-btn', title: 'Löschen', html: Icons.trash(), onclick: (e) => this.remove(h, e) }),
      ]));
    }
    wrap.appendChild(list);
    if (habits.length > 1) this.makeSortable(list, habits);

    return wrap;
  },

  // Reihenfolge durch Ziehen am Griff ändern
  makeSortable(list, habits) {
    list.querySelectorAll('.item[data-id]').forEach((item) => {
      const grip = item.querySelector('.grip');
      grip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);
        const items = [...list.querySelectorAll('.item[data-id]')];
        const idx = items.indexOf(item);
        const rects = items.map((el) => el.getBoundingClientRect());
        const centers = rects.map((r) => r.top + r.height / 2);
        const shift = rects[idx].height + 8;
        const y0 = e.clientY;
        let target = idx;
        item.classList.add('dragging-row');
        const move = (ev) => {
          const dy = ev.clientY - y0;
          item.style.transform = `translateY(${dy}px)`;
          const cur = centers[idx] + dy;
          target = centers.filter((c, j) => j !== idx && c < cur).length;
          items.forEach((el, j) => {
            if (j === idx) return;
            let t = 0;
            if (idx < target && j > idx && j <= target) t = -shift;
            if (idx > target && j < idx && j >= target) t = shift;
            el.style.transform = t ? `translateY(${t}px)` : '';
          });
        };
        const up = async (ev) => {
          grip.removeEventListener('pointermove', move);
          grip.removeEventListener('pointerup', up);
          grip.removeEventListener('pointercancel', up);
          if (ev.type === 'pointercancel' || target === idx) { App.refresh(); return; }
          const order = habits.slice();
          order.splice(target, 0, order.splice(idx, 1)[0]);
          for (let i = 0; i < order.length; i++) { order[i].order = i; await DB.put('habits', order[i]); }
          App.refresh();
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
        grip.addEventListener('pointercancel', up);
      });
    });
  },

  lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ iso: App.todayStr(d), label: d.toLocaleDateString('de-DE', { weekday: 'narrow' }) });
    }
    return out;
  },

  streak(logs, habitId) {
    let count = 0;
    let d = new Date();
    while (true) {
      const iso = App.todayStr(d);
      if (logs.some((l) => l.habitId === habitId && l.date === iso)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return count;
  },

  async toggleLog(habitId, dateIso, btn) {
    if (btn) btn.classList.add('pop');
    const logs = await DB.getAll('habitLogs');
    const existing = logs.find((l) => l.habitId === habitId && l.date === dateIso);
    if (existing) {
      await DB.delete('habitLogs', existing.id);
    } else {
      await DB.put('habitLogs', { id: DB.uid(), habitId, date: dateIso });
    }
    setTimeout(() => App.refresh(), 180);
  },

  async remove(h, e) {
    const el = e.currentTarget.closest('.item');
    if (el) el.classList.add('removing');
    setTimeout(async () => {
      await DB.delete('habits', h.id);
      const logs = await DB.getAll('habitLogs');
      for (const l of logs.filter((x) => x.habitId === h.id)) {
        await DB.delete('habitLogs', l.id);
      }
      App.refresh();
    }, 220);
  },

  openEditor(habit) {
    const isNew = !habit;
    const h = habit ? { ...habit } : { id: DB.uid(), name: '', createdAt: Date.now() };
    const nameInput = App.el('input', { type: 'text', value: h.name, placeholder: 'z.B. Lesen, Sport, Meditieren' });

    const fromInput = App.el('input', { type: 'time', value: Planner.fmt(h.window ? h.window.from : 12 * 60) });
    const toInput = App.el('input', { type: 'time', value: Planner.fmt(h.window ? h.window.to : 14 * 60) });
    const durSelect = App.el('select', {}, [10, 15, 20, 30, 45, 60, 90].map((m) => App.el('option', { value: m }, Planner.fmtDur(m))));
    durSelect.value = String(h.dur || 30);
    const days = new Set(h.days || []);
    const dayBtns = [1, 2, 3, 4, 5, 6, 0].map((d) => App.el('button', {
      class: 'btn secondary' + (days.has(d) ? ' selected' : ''), style: 'width:auto;padding:8px 0;flex:1;min-width:0',
      onclick: (e) => { days.has(d) ? days.delete(d) : days.add(d); e.currentTarget.classList.toggle('selected', days.has(d)); },
    }, ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d]));
    const windowFields = App.el('div', { style: h.window ? '' : 'display:none' }, [
      App.el('div', { class: 'row' }, [
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Frühestens'), fromInput]),
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Spätestens'), toInput]),
      ]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Dauer'), durSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Tage (leer = täglich)'), App.el('div', { class: 'fab-row', style: 'flex-wrap:nowrap;gap:4px;margin-bottom:0' }, dayBtns)]),
    ]);
    let useWindow = !!h.window;

    const content = App.el('div', {}, [
      App.el('h3', {}, isNew ? 'Neue Gewohnheit' : 'Gewohnheit bearbeiten'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Name'), nameInput]),
      App.switchRow('Automatisch im Kalender einplanen', 'Die Gewohnheit sucht sich selbst freie Zeit im Zeitfenster – um Termine herum.', useWindow, (v) => { useWindow = v; windowFields.style.display = v ? '' : 'none'; }),
      windowFields,
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            h.name = nameInput.value.trim();
            if (!h.name) { nameInput.focus(); return; }
            if (useWindow) {
              const from = Planner.parseTime(fromInput.value), to = Planner.parseTime(toInput.value);
              h.window = { from, to: Math.max(to, from + 15) };
              h.dur = Number(durSelect.value);
              h.days = [...days];
            } else { h.window = null; }
            await DB.put('habits', h);
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => nameInput.focus(), 50);
  },
};
