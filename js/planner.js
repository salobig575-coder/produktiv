// Planer-Logik ohne UI: Wiederholungen, freie Zeit, Auto-Planung, Schnelleingabe, Erinnerungen.
// Zeiten sind Minuten seit Mitternacht, Daten 'YYYY-MM-DD'.
const Planner = {
  DAY_NAMES: ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'],
  DAY_SHORT: ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'],
  REPEAT_LABEL: { none: 'Einmalig', daily: 'Täglich', weekdays: 'Werktags', weekly: 'Wöchentlich', monthly: 'Monatlich' },

  async settings() {
    const keys = ['plannerStart', 'plannerEnd', 'plannerBuffer', 'remindersEnabled'];
    const rows = await Promise.all(keys.map((k) => DB.get('settings', k)));
    const v = (r, d) => (r && r.value != null ? r.value : d);
    return { start: v(rows[0], 8 * 60), end: v(rows[1], 20 * 60), buffer: v(rows[2], 0), reminders: v(rows[3], false) };
  },

  fmt(min) {
    const h = Math.floor(min / 60) % 24;
    return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  },
  fmtDur(min) {
    min = Math.round(min);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  },
  parseTime(str) {
    const [h, m] = (str || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  },
  nowMin() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return App.todayStr(d);
  },
  weekStart(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return this.addDays(dateStr, -((d.getDay() + 6) % 7));
  },

  // ---------- Wiederholungen ----------
  occursOn(ev, date) {
    if (date < ev.date) return false;
    if (ev.skip && ev.skip.includes(date)) return false;
    const r = ev.repeat || 'none';
    if (r === 'none') return ev.date === date;
    const d = new Date(date + 'T00:00:00'), s = new Date(ev.date + 'T00:00:00');
    if (r === 'daily') return true;
    if (r === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5;
    if (r === 'weekly') return d.getDay() === s.getDay();
    if (r === 'monthly') return d.getDate() === s.getDate();
    return false;
  },

  nextDue(dateStr, repeat) {
    const base = dateStr > App.todayStr() ? dateStr : App.todayStr();
    if (repeat === 'daily') return this.addDays(base, 1);
    if (repeat === 'weekly') return this.addDays(base, 7);
    if (repeat === 'weekdays') {
      let n = this.addDays(base, 1);
      while ([0, 6].includes(new Date(n + 'T00:00:00').getDay())) n = this.addDays(n, 1);
      return n;
    }
    if (repeat === 'monthly') {
      const d = new Date(base + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return App.todayStr(d);
    }
    return null;
  },

  // Wiederkehrende Aufgabe: beim Abhaken entsteht automatisch die nächste.
  async spawnNext(task) {
    if (!task.repeat || task.repeat === 'none' || task.spawned) return;
    const next = this.nextDue(task.dueDate || App.todayStr(), task.repeat);
    if (!next) return;
    task.spawned = true;
    await DB.put('tasks', task);
    await DB.put('tasks', { ...task, id: DB.uid(), done: false, spawned: false, dueDate: next, planDate: null, planStart: null, createdAt: Date.now(), updatedAt: Date.now() });
  },

  // ---------- Tagesdaten ----------
  async load() {
    const [events, tasks] = await Promise.all([DB.getAll('events'), DB.getAll('tasks')]);
    return { events, tasks };
  },

  dayItems(date, data) {
    const items = [];
    data.events.filter((e) => this.occursOn(e, date)).forEach((e) => {
      items.push({ type: 'event', kind: e.kind || 'event', id: e.id, ref: e, title: e.title, start: e.start, dur: e.dur, end: Math.min(e.start + e.dur, 1440) });
    });
    data.tasks.filter((t) => t.planDate === date && t.planStart != null).forEach((t) => {
      const dur = t.duration || 30;
      items.push({ type: 'task', kind: 'task', id: t.id, ref: t, title: t.title, start: t.planStart, dur, end: Math.min(t.planStart + dur, 1440), done: t.done, priority: t.priority });
    });
    items.sort((a, b) => a.start - b.start || a.end - b.end);
    return items;
  },

  loadMinutes(items) {
    return items.filter((i) => !i.done).reduce((s, i) => s + i.dur, 0);
  },

  freeSlots(items, s, date) {
    let lo = s.start;
    if (date === App.todayStr()) lo = Math.max(lo, Math.ceil(this.nowMin() / 5) * 5);
    const busy = items.map((i) => [i.start - s.buffer, i.end + s.buffer]).sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cur = lo;
    for (const [a, b] of busy) {
      if (b <= cur) continue;
      if (a > cur) gaps.push([cur, Math.min(a, s.end)]);
      cur = Math.max(cur, b);
      if (cur >= s.end) break;
    }
    if (cur < s.end) gaps.push([cur, s.end]);
    return gaps.filter((g) => g[1] - g[0] >= 5);
  },

  freeMinutes(items, s, date) {
    return this.freeSlots(items, s, date).reduce((sum, g) => sum + (g[1] - g[0]), 0);
  },

  // ---------- Auto-Planung ----------
  inbox(tasks) {
    return tasks.filter((t) => !t.done && t.planStart == null);
  },

  // Verpasst = eingeplant, nicht erledigt, Zeit ist vorbei.
  missed(tasks) {
    const today = App.todayStr(), now = this.nowMin();
    return tasks.filter((t) => !t.done && t.planStart != null && t.planDate &&
      (t.planDate < today || (t.planDate === today && t.planStart + (t.duration || 30) < now)));
  },

  // Schlägt eine Verteilung der Inbox auf freie Zeit vor. Schreibt nichts.
  // Reihenfolge: Fälligkeit/Überfällig -> Priorität -> Deadline -> Alter. Der Tag wird nur zu ~85 % gefüllt.
  async suggest(date) {
    const s = await this.settings();
    const data = await this.load();
    const items = this.dayItems(date, data);
    const rank = { high: 0, normal: 1, low: 2 };
    const horizon = this.addDays(date, 7);
    const candidates = this.inbox(data.tasks)
      .filter((t) => t.priority === 'high' || !t.dueDate || t.dueDate <= horizon)
      .sort((a, b) =>
        ((a.dueDate && a.dueDate <= date) ? 0 : 1) - ((b.dueDate && b.dueDate <= date) ? 0 : 1) ||
        rank[a.priority || 'normal'] - rank[b.priority || 'normal'] ||
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
        (a.createdAt || 0) - (b.createdAt || 0));

    const gaps = this.freeSlots(items, s, date);
    const capacity = Math.max(0, Math.round((s.end - s.start) * 0.85) - this.loadMinutes(items));
    let used = 0;
    const placed = [], unplaced = [];
    for (const t of candidates) {
      const dur = t.duration || 30;
      const gap = used + dur <= capacity ? gaps.find((g) => g[1] - g[0] >= dur) : null;
      if (!gap) { unplaced.push(t); continue; }
      placed.push({ task: t, start: gap[0], dur });
      gap[0] += dur + s.buffer;
      used += dur;
    }
    return { date, placed, unplaced };
  },

  async apply(plan) {
    for (const p of plan.placed) {
      p.task.planDate = plan.date;
      p.task.planStart = p.start;
      p.task.duration = p.dur;
      p.task.updatedAt = Date.now();
      await DB.put('tasks', p.task);
    }
  },

  async unscheduleMissed() {
    const data = await this.load();
    for (const t of this.missed(data.tasks)) {
      t.planDate = null;
      t.planStart = null;
      await DB.put('tasks', t);
    }
  },

  // Einzelne Aufgabe in den ersten passenden freien Slot legen.
  async scheduleTask(task, date) {
    const s = await this.settings();
    const data = await this.load();
    const items = this.dayItems(date, data);
    const dur = task.duration || 30;
    const gap = this.freeSlots(items, s, date).find((g) => g[1] - g[0] >= dur);
    if (!gap) return false;
    task.planDate = date;
    task.planStart = gap[0];
    task.duration = dur;
    task.updatedAt = Date.now();
    await DB.put('tasks', task);
    return true;
  },

  // ---------- Schnelleingabe (Deutsch) ----------
  nextWeekday(idx) {
    const today = new Date();
    return App.todayStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((idx - today.getDay() + 7) % 7)));
  },

  weekdayIndex(word) {
    word = word.toLowerCase();
    let i = this.DAY_NAMES.indexOf(word);
    if (i < 0) i = this.DAY_SHORT.indexOf(word);
    return i;
  },

  parseQuick(text) {
    let s = ` ${text.trim()} `;
    const out = { title: '', date: null, start: null, dur: null, priority: 'normal', repeat: 'none' };
    const cut = (re, fn) => {
      const m = s.match(re);
      if (!m) return false;
      s = s.replace(re, ' ');
      fn(m);
      return true;
    };
    const days = 'montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag';

    cut(/\s(?:p1|!!|dringend)(?=\s)/i, () => { out.priority = 'high'; });
    cut(/\s(?:p3|!niedrig)(?=\s)/i, () => { out.priority = 'low'; });

    cut(/\s(?:täglich|jeden\s+tag)(?=\s)/i, () => { out.repeat = 'daily'; });
    cut(/\s(?:werktags|wochentags)(?=\s)/i, () => { out.repeat = 'weekdays'; });
    cut(/\s(?:wöchentlich|jede\s+woche)(?=\s)/i, () => { out.repeat = 'weekly'; });
    cut(/\s(?:monatlich|jeden\s+monat)(?=\s)/i, () => { out.repeat = 'monthly'; });
    cut(new RegExp(`\\sjeden\\s+(${days})(?=\\s)`, 'i'), (m) => { out.repeat = 'weekly'; out.date = this.nextWeekday(this.weekdayIndex(m[1])); });

    cut(/\s(\d+)[.,](\d)\s*(?:h|std|stunden?)(?=\s)/i, (m) => { out.dur = Math.round(parseFloat(`${m[1]}.${m[2]}`) * 60); }) ||
    cut(/\s(\d+)\s*(?:h|std|stunden?)(?:\s*(\d{1,2})\s*(?:min|m)?)?(?=\s)/i, (m) => { out.dur = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0); }) ||
    cut(/\s(\d+)\s*(?:min|minuten|m)(?=\s)/i, (m) => { out.dur = Number(m[1]); });

    cut(/\s(?:am\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?=\s)/, (m) => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
      let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      if (!m[3] && App.todayStr(d) < App.todayStr()) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]));
      out.date = App.todayStr(d);
    });

    const setTime = (h, mi) => { if (h < 24 && mi < 60) out.start = h * 60 + mi; else return false; return true; };
    cut(/\s(?:um\s+)?(\d{1,2})[:.](\d{2})(?:\s*uhr)?(?=\s)/i, (m) => { setTime(Number(m[1]), Number(m[2])); }) ||
    cut(/\s(?:um\s+)?(\d{1,2})\s*uhr(?=\s)/i, (m) => { setTime(Number(m[1]), 0); }) ||
    cut(/\sum\s+(\d{1,2})(?=\s)/i, (m) => { setTime(Number(m[1]), 0); });

    cut(/\s(übermorgen)(?=\s)/i, () => { out.date = Planner.addDays(App.todayStr(), 2); });
    cut(/\s(morgen)(?=\s)/i, () => { out.date = Planner.addDays(App.todayStr(), 1); });
    cut(/\s(heute)(?=\s)/i, () => { out.date = App.todayStr(); });
    cut(new RegExp(`\\s(?:am\\s+)?(${days}|mo|di|mi|do|fr|sa)(?=\\s)`, 'i'), (m) => { out.date = this.nextWeekday(this.weekdayIndex(m[1])); });

    let title = s.replace(/\s+/g, ' ').trim().replace(/^(am|um|bis)\s+/i, '').replace(/\s+(am|um|bis)$/i, '');
    out.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
    out.kind = out.start != null ? 'event' : 'task';
    return out;
  },

  describeQuick(p) {
    const bits = [p.kind === 'event' ? 'Termin' : 'Aufgabe'];
    if (p.date) {
      const d = new Date(p.date + 'T00:00:00');
      const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      bits.push(p.kind === 'task' ? `fällig ${label}` : label);
    }
    if (p.start != null) bits.push(`${this.fmt(p.start)}–${this.fmt(p.start + (p.dur || 60))}`);
    else if (p.dur) bits.push(this.fmtDur(p.dur));
    if (p.repeat !== 'none') bits.push(this.REPEAT_LABEL[p.repeat].toLowerCase());
    if (p.priority === 'high') bits.push('hohe Priorität');
    if (p.priority === 'low') bits.push('niedrige Priorität');
    return bits.join(' · ');
  },

  // ---------- Erinnerungen (solange die App geöffnet ist) ----------
  _timer: null,
  startReminders() {
    if (this._timer) return;
    this._timer = setInterval(() => this.checkReminders(), 30000);
    this.checkReminders();
  },

  async checkReminders() {
    const s = await this.settings();
    if (!s.reminders) return;
    const today = App.todayStr(), now = this.nowMin();
    const data = await this.load();
    let fired = {};
    try { fired = JSON.parse(localStorage.getItem('plannerFired') || '{}'); } catch (e) {}
    for (const k of Object.keys(fired)) if (!k.endsWith(today)) delete fired[k];
    for (const ev of data.events) {
      if (ev.remind == null || !this.occursOn(ev, today)) continue;
      const key = `${ev.id}:${today}`;
      const at = ev.start - ev.remind;
      if (fired[key] || now < at || now >= ev.start + 1) continue;
      fired[key] = 1;
      const msg = ev.remind ? `${ev.title} startet in ${ev.remind} min (${this.fmt(ev.start)})` : `${ev.title} startet jetzt`;
      this.toast(msg);
      try {
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Produktiv', { body: msg, icon: 'icons/icon.svg' });
      } catch (e) {}
    }
    try { localStorage.setItem('plannerFired', JSON.stringify(fired)); } catch (e) {}
  },

  toast(text) {
    const t = App.el('div', { class: 'toast' }, text);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('hide'), 4200);
    setTimeout(() => t.remove(), 4700);
  },
};
