const CalendarView = {
  selectedDate: null,
  mode: 'day',
  PX_PER_HOUR: 56,
  _scrolled: false,

  today() { return App.todayStr(); },

  async render() {
    if (!this.selectedDate) this.selectedDate = this.today();
    Planner.startReminders();
    const wrap = App.el('div');
    const data = await Planner.load();
    const s = await Planner.settings();

    wrap.appendChild(this.renderHeader());
    wrap.appendChild(this.renderQuickAdd());

    if (this.mode === 'week') {
      wrap.appendChild(this.renderWeek(data, s));
      return wrap;
    }

    wrap.appendChild(this.renderDateStrip(data));
    const items = Planner.dayItems(this.selectedDate, data);
    this.renderMissed(wrap, data);
    wrap.appendChild(this.renderSummary(items, s, data));
    wrap.appendChild(this.renderTimeline(items, s));
    wrap.appendChild(this.renderInbox(data));

    let x0 = 0, y0 = 0;
    wrap.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    wrap.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) { this.selectedDate = Planner.addDays(this.selectedDate, dx < 0 ? 1 : -1); App.refresh(); }
    }, { passive: true });
    return wrap;
  },

  // ---------- Kopf, Schnelleingabe ----------
  renderHeader() {
    const d = new Date(this.selectedDate + 'T00:00:00');
    const isToday = this.selectedDate === this.today();
    return App.el('div', { style: 'margin-bottom:12px' }, [
      App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [
        App.el('div', {}, [
          App.el('div', { style: 'font-size:19px;font-weight:800' }, isToday ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'long' })),
          App.el('div', { class: 'tag' }, d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })),
        ]),
        App.el('div', { class: 'row', style: 'gap:6px' }, [
          !isToday ? App.el('button', { class: 'btn secondary', style: 'width:auto;padding:8px 14px', onclick: () => { this.selectedDate = this.today(); App.refresh(); } }, 'Heute') : null,
          App.el('button', { class: 'icon-btn', html: Icons.planen(), title: 'Monat', onclick: () => this.openMonth() }),
        ]),
      ]),
      App.el('div', { class: 'fab-row', style: 'margin-bottom:0' }, [
        this.modeBtn('day', 'Tag'),
        this.modeBtn('week', 'Woche'),
      ]),
    ]);
  },

  modeBtn(key, label) {
    return App.el('button', { class: 'btn secondary' + (this.mode === key ? ' selected' : ''), onclick: () => { this.mode = key; this._scrolled = false; App.refresh(); } }, label);
  },

  renderQuickAdd() {
    const input = App.el('input', { type: 'text', placeholder: 'Neu: „Zahnarzt Do 15 Uhr 1h“', enterkeyhint: 'done' });
    const hint = App.el('div', { class: 'tag', style: 'margin:6px 2px 0;min-height:16px' });
    const submit = async () => {
      const p = Planner.parseQuick(input.value);
      if (!p.title) return;
      await this.addParsed(p);
    };
    input.addEventListener('input', () => {
      const p = Planner.parseQuick(input.value);
      hint.textContent = p.title ? Planner.describeQuick(p) : '';
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    return App.el('div', { style: 'margin-bottom:14px' }, [
      App.el('div', { class: 'row' }, [
        App.el('div', { style: 'flex:1' }, [input]),
        App.el('button', { class: 'icon-btn', style: 'color:var(--accent)', html: Icons.plus(), title: 'Hinzufügen', onclick: submit }),
      ]),
      hint,
    ]);
  },

  async addParsed(p) {
    const s = await Planner.settings();
    if (p.kind === 'event') {
      const date = p.date || this.today();
      await DB.put('events', {
        id: DB.uid(), title: p.title, date, start: p.start, dur: p.dur || 60, kind: 'event',
        repeat: p.repeat, remind: s.reminders ? 10 : null, skip: [], createdAt: Date.now(),
      });
      this.selectedDate = date;
    } else {
      await DB.put('tasks', {
        id: DB.uid(), title: p.title, dueDate: p.date || '', priority: p.priority, notes: '', done: false,
        duration: p.dur || null, repeat: p.repeat, createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
    App.refresh();
  },

  // ---------- Datum ----------
  renderDateStrip(data) {
    const cells = [];
    for (let i = -3; i <= 3; i++) {
      const dateStr = Planner.addDays(this.selectedDate, i);
      const d = new Date(dateStr + 'T00:00:00');
      const count = Planner.dayItems(dateStr, data).length;
      cells.push(App.el('div', {
        class: 'date-cell' + (dateStr === this.selectedDate ? ' active' : '') + (dateStr === this.today() ? ' today' : ''),
        onclick: () => { this.selectedDate = dateStr; App.refresh(); },
      }, [
        App.el('div', { class: 'date-cell-dow' }, d.toLocaleDateString('de-DE', { weekday: 'narrow' })),
        App.el('div', { class: 'date-cell-num' }, String(d.getDate())),
        App.el('div', { class: 'date-cell-tag' }, count ? '•'.repeat(Math.min(count, 3)) : ''),
      ]));
    }
    return App.el('div', { class: 'date-strip' }, cells);
  },

  openMonth() {
    const view = new Date(this.selectedDate + 'T00:00:00');
    view.setDate(1);
    const container = App.el('div');
    App.showModal(App.el('div', {}, [container]));

    const draw = async () => {
      const data = await Planner.load();
      const year = view.getFullYear(), month = view.getMonth();
      const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const grid = App.el('div', { class: 'cal-grid' });
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((d) => grid.appendChild(App.el('div', { class: 'cal-dow' }, d)));
      for (let i = 0; i < startOffset; i++) grid.appendChild(App.el('div', { class: 'cal-day empty' }));
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = App.todayStr(new Date(year, month, day));
        const busy = Planner.dayItems(dateStr, data).length > 0;
        grid.appendChild(App.el('div', {
          class: 'cal-day' + (dateStr === this.selectedDate ? ' selected' : '') + (dateStr === this.today() ? ' today' : ''),
          onclick: () => { this.selectedDate = dateStr; App.closeModal(); App.refresh(); },
        }, [App.el('span', {}, String(day)), busy ? App.el('span', { class: 'cal-dot' }) : null]));
      }
      container.innerHTML = '';
      container.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:16px' }, [
        App.el('h3', { style: 'margin:0' }, 'Datum wählen'),
        App.el('button', { class: 'icon-btn', html: Icons.close(), onclick: () => App.closeModal() }),
      ]));
      container.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, [
        App.el('button', { class: 'icon-btn', style: 'transform:scaleX(-1)', html: Icons.arrowRight(), onclick: () => { view.setMonth(view.getMonth() - 1); draw(); } }),
        App.el('div', { style: 'font-weight:800' }, view.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
        App.el('button', { class: 'icon-btn', html: Icons.arrowRight(), onclick: () => { view.setMonth(view.getMonth() + 1); draw(); } }),
      ]));
      container.appendChild(grid);
    };
    draw();
  },

  // ---------- Hinweise ----------
  renderMissed(wrap, data) {
    const missed = Planner.missed(data.tasks);
    if (missed.length === 0) return;
    wrap.appendChild(App.el('div', { class: 'card', style: 'padding:12px 14px' }, [
      App.el('div', { class: 'row', style: 'justify-content:space-between' }, [
        App.el('div', {}, [
          App.el('div', { style: 'font-weight:800' }, `${missed.length} verpasst`),
          App.el('div', { class: 'tag' }, 'Nicht erledigte Blöcke neu einplanen.'),
        ]),
        App.el('button', { class: 'btn', style: 'width:auto;padding:9px 16px', onclick: async () => {
          await Planner.unscheduleMissed();
          this.selectedDate = this.today();
          this.openSuggestion(await Planner.suggest(this.today()));
        } }, 'Neu planen'),
      ]),
    ]));
  },

  renderSummary(items, s, data) {
    const load = Planner.loadMinutes(items);
    const free = Planner.freeMinutes(items, s, this.selectedDate);
    const capacity = s.end - s.start;
    const over = load > capacity;
    const inboxCount = Planner.inbox(data.tasks).length;
    return App.el('div', { class: 'row', style: 'justify-content:space-between;margin:0 2px 10px' }, [
      App.el('div', { class: 'tag' }, items.length === 0 ? 'Nichts geplant' : `${Planner.fmtDur(load)} geplant · ${Planner.fmtDur(free)} frei`),
      over
        ? App.el('span', { class: 'pill overdue' }, 'Überlastet')
        : App.el('button', {
          class: 'btn secondary', style: 'width:auto;padding:7px 12px;font-size:13px',
          onclick: async () => this.openSuggestion(await Planner.suggest(this.selectedDate)),
        }, [App.el('span', { html: Icons.sparkles(), style: 'width:14px;height:14px' }), inboxCount ? `Tag planen (${inboxCount})` : 'Tag planen']),
    ]);
  },

  // ---------- Timeline ----------
  renderTimeline(items, s) {
    const PX = this.PX_PER_HOUR / 60;
    const startH = Math.min(6, Math.floor(Math.min(s.start, ...items.map((i) => i.start)) / 60));
    const endH = Math.max(22, Math.ceil(Math.max(s.end, ...items.map((i) => i.end)) / 60));
    const top = (min) => (min - startH * 60) * PX;

    const tl = App.el('div', { class: 'timeline', style: `height:${(endH - startH) * this.PX_PER_HOUR}px` });
    for (let h = startH; h <= endH; h++) {
      tl.appendChild(App.el('div', { class: 'tl-hour', style: `top:${top(h * 60)}px` }, [App.el('span', {}, `${String(h).padStart(2, '0')}:00`)]));
    }
    // Arbeitsfenster dezent hervorheben
    tl.appendChild(App.el('div', { class: 'tl-window', style: `top:${top(s.start)}px;height:${(s.end - s.start) * PX}px` }));

    const surface = App.el('div', { class: 'tl-surface' });
    surface.addEventListener('click', (e) => {
      if (e.target !== surface) return;
      const y = e.clientY - surface.getBoundingClientRect().top;
      const min = Math.round((y / PX + startH * 60) / 15) * 15;
      this.openEventEditor(null, Math.max(0, Math.min(min, 1380)));
    });

    // Überlappungen in Spalten legen
    let cols = [], cluster = [], clusterEnd = 0;
    const flush = () => { const n = Math.max(1, ...cluster.map((i) => i.col + 1)); cluster.forEach((i) => { i.cols = n; }); cluster = []; };
    for (const it of items) {
      if (cluster.length && it.start >= clusterEnd) { flush(); cols = []; clusterEnd = 0; }
      let c = 0;
      while (cols[c] != null && cols[c] > it.start) c++;
      cols[c] = it.end; it.col = c;
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.end);
    }
    flush();

    for (const it of items) {
      const h = Math.max(24, (it.end - it.start) * PX - 2);
      const cls = 'tl-block ' + it.kind + (it.done ? ' done' : '') + (it.priority === 'high' ? ' high' : '');
      const block = App.el('div', {
        class: cls,
        style: `top:${top(it.start)}px;height:${h}px;left:calc(${(it.col / it.cols) * 100}% + 2px);width:calc(${100 / it.cols}% - 4px)`,
        onclick: (e) => { e.stopPropagation(); it.type === 'task' ? TasksView.openEditor(it.ref) : this.openEventEditor(it.ref); },
      }, [
        it.type === 'task' ? App.el('button', {
          class: 'checkbox' + (it.done ? ' checked' : ''), html: Icons.check(),
          onclick: async (e) => { e.stopPropagation(); await TasksView.toggleDone(it.ref, e.currentTarget); },
        }) : null,
        App.el('div', { class: 'tl-text' }, [
          App.el('div', { class: 'tl-title' }, it.title),
          h >= 40 ? App.el('div', { class: 'tl-time' }, `${Planner.fmt(it.start)}–${Planner.fmt(it.end)}`) : null,
        ]),
      ]);
      surface.appendChild(block);
    }
    tl.appendChild(surface);

    let nowLine = null;
    if (this.selectedDate === this.today()) {
      const n = Planner.nowMin();
      if (n >= startH * 60 && n <= endH * 60) {
        nowLine = App.el('div', { class: 'tl-now', style: `top:${top(n)}px` });
        tl.appendChild(nowLine);
      }
    }

    const card = App.el('div', { class: 'card', style: 'padding:12px 12px 12px 8px;overflow:hidden' }, [tl]);
    if (!this._scrolled) {
      this._scrolled = true;
      const anchor = nowLine || surface.querySelector('.tl-block');
      if (anchor) setTimeout(() => anchor.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350);
    }
    return card;
  },

  // ---------- Inbox ----------
  renderInbox(data) {
    const tasks = Planner.inbox(data.tasks).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (b.createdAt || 0) - (a.createdAt || 0));
    const card = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.tasks(), style: 'width:14px;height:14px' }), 'Inbox']),
    ]);
    if (tasks.length === 0) {
      card.appendChild(App.el('div', { class: 'empty', style: 'padding:16px 10px' }, 'Alles eingeplant oder erledigt.'));
      return card;
    }
    const today = this.today();
    const list = App.el('div', { class: 'list' });
    for (const t of tasks.slice(0, 8)) {
      const overdue = t.dueDate && t.dueDate < today;
      list.appendChild(App.el('div', { class: 'item' }, [
        App.el('div', { style: 'flex:1;cursor:pointer;min-width:0', onclick: () => TasksView.openEditor(t) }, [
          App.el('div', { class: 'item-title' }, t.title),
          App.el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [
            t.dueDate ? App.el('span', { class: 'pill' + (overdue ? ' overdue' : '') }, App.formatDate(t.dueDate)) : null,
            App.el('span', { class: 'pill' }, Planner.fmtDur(t.duration || 30)),
          ]),
        ]),
        App.el('button', {
          class: 'icon-btn', style: 'color:var(--accent)', html: Icons.planen(), title: 'Einplanen',
          onclick: async () => {
            const ok = await Planner.scheduleTask(t, this.selectedDate);
            if (!ok) Planner.toast('Kein freier Platz an diesem Tag.');
            this._scrolled = false;
            App.refresh();
          },
        }),
      ]));
    }
    card.appendChild(list);
    if (tasks.length > 8) card.appendChild(App.el('div', { class: 'tag', style: 'margin-top:8px' }, `+ ${tasks.length - 8} weitere im Tab „Aufgaben“`));
    return card;
  },

  // ---------- Vorschlag ----------
  openSuggestion(plan) {
    const rows = plan.placed.map((p) => App.el('div', { class: 'item' }, [
      App.el('div', { class: 'pill active' }, Planner.fmt(p.start)),
      App.el('div', { style: 'flex:1;min-width:0' }, [
        App.el('div', { class: 'item-title' }, p.task.title),
        App.el('div', { class: 'tag' }, Planner.fmtDur(p.dur)),
      ]),
    ]));
    const d = new Date(plan.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const content = App.el('div', {}, [
      App.el('h3', { style: 'margin-bottom:4px' }, 'Vorschlag für den Tag'),
      App.el('div', { class: 'tag', style: 'margin-bottom:14px' }, d),
    ]);
    if (rows.length === 0) {
      content.appendChild(App.el('div', { class: 'empty', style: 'padding:16px 10px' }, plan.unplaced.length ? 'Nichts passt mehr in diesen Tag.' : 'Keine offenen Aufgaben zum Einplanen.'));
    } else {
      content.appendChild(App.el('div', { class: 'list', style: 'margin-bottom:12px' }, rows));
    }
    if (plan.unplaced.length) {
      content.appendChild(App.el('div', { class: 'tag', style: 'margin-bottom:14px' }, `${plan.unplaced.length} bleiben in der Inbox. Der Tag wird bewusst nicht komplett gefüllt.`));
    }
    content.appendChild(App.el('div', { class: 'row' }, [
      App.el('button', { class: 'btn secondary', onclick: () => { App.closeModal(); App.refresh(); } }, rows.length ? 'Verwerfen' : 'Schließen'),
      rows.length ? App.el('button', { class: 'btn', onclick: async () => {
        await Planner.apply(plan);
        App.closeModal();
        this.selectedDate = plan.date;
        this._scrolled = false;
        App.refresh();
      } }, 'Übernehmen') : null,
    ]));
    App.showModal(content);
  },

  // ---------- Woche ----------
  renderWeek(data, s) {
    const start = Planner.weekStart(this.selectedDate);
    const wrap = App.el('div');
    const last = Planner.addDays(start, 6);
    const fmtShort = (ds) => new Date(ds + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    wrap.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:12px' }, [
      App.el('button', { class: 'icon-btn', style: 'transform:scaleX(-1)', html: Icons.arrowRight(), onclick: () => { this.selectedDate = Planner.addDays(start, -7); App.refresh(); } }),
      App.el('div', { style: 'font-weight:800' }, `${fmtShort(start)} – ${fmtShort(last)}`),
      App.el('button', { class: 'icon-btn', html: Icons.arrowRight(), onclick: () => { this.selectedDate = Planner.addDays(start, 7); App.refresh(); } }),
    ]));
    const capacity = s.end - s.start;
    for (let i = 0; i < 7; i++) {
      const ds = Planner.addDays(start, i);
      const d = new Date(ds + 'T00:00:00');
      const items = Planner.dayItems(ds, data);
      const load = Planner.loadMinutes(items);
      const pct = Math.min(100, Math.round((load / capacity) * 100));
      const isToday = ds === this.today();
      const card = App.el('div', {
        class: 'card week-day' + (isToday ? ' today' : ''),
        style: 'cursor:pointer;padding:12px 14px',
        onclick: () => { this.selectedDate = ds; this.mode = 'day'; this._scrolled = false; App.refresh(); },
      }, [
        App.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, [
          App.el('div', { style: 'font-weight:800' }, d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })),
          load > capacity ? App.el('span', { class: 'pill overdue' }, 'Überlastet') : App.el('span', { class: 'tag' }, load ? Planner.fmtDur(load) : ''),
        ]),
        App.el('div', { class: 'load-bar' }, [App.el('div', { class: 'load-fill' + (load > capacity ? ' over' : ''), style: `width:${pct}%` })]),
      ]);
      if (items.length) {
        const list = App.el('div', { style: 'margin-top:10px;display:flex;flex-direction:column;gap:4px' });
        items.slice(0, 4).forEach((it) => list.appendChild(App.el('div', { class: 'week-item' + (it.done ? ' done' : '') }, [
          App.el('span', { class: 'week-time' }, Planner.fmt(it.start)),
          App.el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, it.title),
        ])));
        if (items.length > 4) list.appendChild(App.el('div', { class: 'tag' }, `+ ${items.length - 4} weitere`));
        card.appendChild(list);
      }
      wrap.appendChild(card);
    }
    return wrap;
  },

  // ---------- Termin-Editor ----------
  openEventEditor(ev, presetStart) {
    const isNew = !ev;
    const e = ev ? { ...ev } : {
      id: DB.uid(), title: '', date: this.selectedDate, start: presetStart != null ? presetStart : 9 * 60, dur: 60,
      kind: 'event', repeat: 'none', remind: null, skip: [], createdAt: Date.now(),
    };
    const titleInput = App.el('input', { type: 'text', value: e.title, placeholder: 'Titel' });
    const dateInput = App.el('input', { type: 'date', value: e.date });
    const timeInput = App.el('input', { type: 'time', value: Planner.fmt(e.start) });
    const durSelect = App.el('select', {}, [15, 30, 45, 60, 90, 120, 180, 240].map((m) => App.el('option', { value: m }, Planner.fmtDur(m))));
    if (![15, 30, 45, 60, 90, 120, 180, 240].includes(e.dur)) durSelect.appendChild(App.el('option', { value: e.dur }, Planner.fmtDur(e.dur)));
    durSelect.value = String(e.dur);
    const kindSelect = App.el('select', {}, [App.el('option', { value: 'event' }, 'Termin'), App.el('option', { value: 'focus' }, 'Fokus-Block')]);
    kindSelect.value = e.kind || 'event';
    const repeatSelect = App.el('select', {}, Object.entries(Planner.REPEAT_LABEL).map(([k, l]) => App.el('option', { value: k }, l)));
    repeatSelect.value = e.repeat || 'none';
    const remindSelect = App.el('select', {}, [
      App.el('option', { value: '' }, 'Keine'), App.el('option', { value: '0' }, 'Zum Beginn'),
      App.el('option', { value: '10' }, '10 Minuten vorher'), App.el('option', { value: '30' }, '30 Minuten vorher'), App.el('option', { value: '60' }, '1 Stunde vorher'),
    ]);
    remindSelect.value = e.remind == null ? '' : String(e.remind);

    const save = async () => {
      e.title = titleInput.value.trim();
      if (!e.title) { titleInput.focus(); return; }
      e.date = dateInput.value || this.selectedDate;
      e.start = Planner.parseTime(timeInput.value);
      e.dur = Number(durSelect.value);
      e.kind = kindSelect.value;
      e.repeat = repeatSelect.value;
      e.remind = remindSelect.value === '' ? null : Number(remindSelect.value);
      if (e.start + e.dur > 1440) e.dur = 1440 - e.start;
      await DB.put('events', e);
      this.selectedDate = e.date;
      App.closeModal();
      App.refresh();
    };

    const buttons = [App.el('div', { class: 'row' }, [
      App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
      App.el('button', { class: 'btn', onclick: save }, 'Speichern'),
    ])];
    if (!isNew) {
      const recurring = (e.repeat || 'none') !== 'none';
      const del = async (onlyThisDay) => {
        if (onlyThisDay) { e.skip = [...(e.skip || []), this.selectedDate]; await DB.put('events', e); }
        else await DB.delete('events', e.id);
        App.closeModal();
        App.refresh();
      };
      const extra = [];
      if (e.kind === 'focus') {
        extra.push(App.el('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: () => {
          if (!FocusView.state.running) { FocusView.state.focusMin = e.dur; FocusView.state.mode = 'focus'; FocusView.state.remaining = e.dur * 60; }
          PlanenHub.activeTab = 'focus';
          App.closeModal();
          App.navigate('planen');
        } }, [App.el('span', { html: Icons.focus(), style: 'width:16px;height:16px' }), 'Fokus jetzt starten']));
      }
      if (recurring) extra.push(App.el('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: () => del(true) }, 'Nur diesen Tag löschen'));
      extra.push(App.el('button', { class: 'btn danger', style: 'margin-top:8px', onclick: () => del(false) }, recurring ? 'Serie löschen' : 'Löschen'));
      buttons.push(...extra);
    }

    App.showModal(App.el('div', {}, [
      App.el('h3', {}, isNew ? 'Neuer Termin' : 'Termin bearbeiten'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Titel'), titleInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Art'), kindSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Datum'), dateInput]),
      App.el('div', { class: 'row' }, [
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Beginn'), timeInput]),
        App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Dauer'), durSelect]),
      ]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Wiederholung'), repeatSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Erinnerung'), remindSelect]),
      ...buttons,
    ]));
    if (isNew) setTimeout(() => titleInput.focus(), 50);
  },
};
