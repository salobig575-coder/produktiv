const FocusView = {
  state: {
    mode: 'focus',
    focusMin: 25,
    breakMin: 5,
    remaining: 25 * 60,
    running: false,
    intervalId: null,
    sessionStart: null,
    level: 'normal',     // normal | timeout | strict (wie Opal: Reibung beim Abbrechen)
    intention: '',
    taskId: null,
    attempts: 0,
    stopAt: null,
  },

  LEVELS: [
    { key: 'normal', label: 'Normal', desc: 'Jederzeit abbrechbar.' },
    { key: 'timeout', label: 'Timeout', desc: 'Abbrechen erst nach einer Wartezeit, die bei jedem Versuch länger wird.' },
    { key: 'strict', label: 'Strikt', desc: 'Nicht abbrechbar – der Fokus läuft bis zum Ende.' },
  ],

  // Vorbelegen aus Kalender-Block oder Aufgabe (nur wenn nichts läuft)
  prepare(opts) {
    const s = this.state;
    if (s.running) return false;
    if (opts.minutes) { s.focusMin = Math.max(1, Math.min(180, opts.minutes)); s.mode = 'focus'; s.remaining = s.focusMin * 60; }
    if (opts.level) s.level = opts.level;
    s.intention = opts.intention || '';
    s.taskId = opts.taskId || null;
    return true;
  },

  RADIUS: 42,

  async render() {
    const s = this.state;
    const wrap = App.el('div');
    const circumference = 2 * Math.PI * this.RADIUS;

    const ringWrap = App.el('div', { class: 'timer-ring-wrap' + (s.running ? ' running' : ''), id: 'ringWrap' }, [
      App.el('div', {
        html: `<svg viewBox="0 0 100 100">
          <defs>
            <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style="stop-color:var(--accent)"/>
              <stop offset="1" style="stop-color:var(--accent-2)"/>
            </linearGradient>
          </defs>
          <circle class="timer-ring-bg" cx="50" cy="50" r="${this.RADIUS}"/>
          <circle class="timer-ring-progress" id="ringProgress" cx="50" cy="50" r="${this.RADIUS}"
            stroke-dasharray="${circumference}" stroke-dashoffset="${this.offset(circumference)}"/>
        </svg>`,
      }),
      App.el('div', { class: 'timer-center' }, [
        App.el('div', { class: 'timer-display', id: 'timerDisplay' }, this.fmt(s.remaining)),
        App.el('div', { class: 'timer-mode', id: 'timerMode' }, s.mode === 'focus' ? (s.level === 'normal' ? 'Fokus' : `Fokus · ${s.level === 'strict' ? 'Strikt' : 'Timeout'}`) : 'Pause'),
      ]),
    ]);
    wrap.appendChild(ringWrap);

    if (s.intention && s.running) {
      wrap.appendChild(App.el('div', { class: 'tag', style: 'text-align:center;margin:-6px 0 12px' }, `Absicht: ${s.intention}`));
    }

    const locked = s.running && s.mode === 'focus' && s.level === 'strict';
    const controls = App.el('div', { class: 'timer-controls' }, [
      App.el('button', {
        class: 'btn', id: 'toggleBtn', disabled: locked,
        onclick: () => this.toggle(),
      }, locked ? 'Gesperrt' : (s.running ? 'Pause' : 'Start')),
      App.el('button', { class: 'btn secondary', id: 'resetBtn', disabled: locked, onclick: () => this.guarded(() => this.reset()) }, 'Zurücksetzen'),
    ]);

    if (s.running) {
      wrap.appendChild(controls);
    } else {
      // Erst einstellen, dann starten: Dauer, Absicht, Härtegrad – der Start-Knopf steht darunter.
      wrap.appendChild(App.el('div', { class: 'row', style: 'justify-content:center;gap:16px;margin-bottom:16px' }, [
        this.durationPicker('focusMin', 'Fokus (Min)'),
        this.durationPicker('breakMin', 'Pause (Min)'),
      ]));
      const intentInput = App.el('input', { type: 'text', value: s.intention, placeholder: 'Woran arbeitest du? (optional)' });
      intentInput.addEventListener('input', () => { s.intention = intentInput.value; if (s.taskId) s.taskId = null; });
      wrap.appendChild(App.el('div', { class: 'field' }, [App.el('label', {}, 'Absicht'), intentInput]));
      wrap.appendChild(App.el('div', { class: 'field' }, [
        App.el('label', {}, 'Härtegrad'),
        App.el('div', { class: 'fab-row', style: 'margin-bottom:4px' }, this.LEVELS.map((l) => App.el('button', {
          class: 'btn secondary' + (s.level === l.key ? ' selected' : ''),
          onclick: () => { s.level = l.key; App.refresh(); },
        }, l.label))),
        App.el('div', { class: 'tag' }, this.LEVELS.find((l) => l.key === s.level).desc),
      ]));
      wrap.appendChild(controls);
    }

    const today = App.todayStr();
    const sessions = await DB.getAll('focusSessions');
    const todaysSessions = sessions.filter((sess) => App.todayStr(new Date(sess.startedAt)) === today);
    const totalMin = Math.round(todaysSessions.reduce((sum, sess) => sum + sess.duration, 0) / 60);

    wrap.appendChild(App.el('div', { class: 'stat-row' }, [
      App.el('div', { class: 'stat' }, [
        App.el('div', { class: 'num' }, String(todaysSessions.length)),
        App.el('div', { class: 'lbl' }, 'Sessions heute'),
      ]),
      App.el('div', { class: 'stat' }, [
        App.el('div', { class: 'num' }, String(totalMin)),
        App.el('div', { class: 'lbl' }, 'Minuten heute'),
      ]),
    ]));

    return wrap;
  },

  offset(circumference) {
    const s = this.state;
    const total = (s.mode === 'focus' ? s.focusMin : s.breakMin) * 60;
    const frac = total > 0 ? s.remaining / total : 0;
    return circumference * (1 - frac);
  },

  durationPicker(key, label) {
    const input = App.el('input', {
      type: 'number', min: '1', max: '180', value: String(this.state[key]),
      style: 'width:70px;text-align:center',
      onchange: (e) => {
        const v = Math.max(1, parseInt(e.target.value, 10) || 1);
        this.state[key] = v;
        if (this.state.mode === (key === 'focusMin' ? 'focus' : 'break') && !this.state.running) {
          this.state.remaining = v * 60;
          App.refresh();
        }
      },
    });
    return App.el('div', { style: 'text-align:center' }, [
      App.el('div', { class: 'tag' }, label),
      input,
    ]);
  },

  fmt(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  toggle() {
    if (this.state.running) this.guarded(() => this.pause());
    else this.start();
  },

  // Härtegrad: Nur im Fokus-Modus wird das Beenden erschwert.
  guarded(action) {
    const s = this.state;
    if (!s.running || s.mode !== 'focus' || s.level === 'normal') return action();
    if (s.level === 'strict') { Planner.toast('Strikt: Der Fokus läuft bis zum Ende.'); return; }
    const now = Date.now();
    if (!s.stopAt) {
      s.attempts += 1;
      s.stopAt = now + 10000 * s.attempts;
      this.updateGuardUI();
      return;
    }
    if (now < s.stopAt) return;
    s.stopAt = null;
    action();
  },

  updateGuardUI() {
    const s = this.state;
    const btn = document.getElementById('toggleBtn');
    const reset = document.getElementById('resetBtn');
    if (!btn || !s.running) return;
    if (s.level === 'timeout' && s.stopAt) {
      const left = Math.ceil((s.stopAt - Date.now()) / 1000);
      const txt = left > 0 ? `Warte ${left} s …` : 'Jetzt pausieren';
      btn.textContent = txt;
      btn.style.opacity = left > 0 ? '.6' : '';
      if (reset) reset.style.opacity = left > 0 ? '.6' : '';
    }
  },

  start() {
    const s = this.state;
    if (!s.sessionStart) { s.sessionStart = Date.now(); s.attempts = 0; }
    s.stopAt = null;
    s.running = true;
    s.endAt = Date.now() + s.remaining * 1000; // Zeitstempel statt Sekundenzählen: stimmt auch, wenn die App im Hintergrund schläft
    window.onbeforeunload = s.level === 'strict' && s.mode === 'focus' ? (e) => { e.preventDefault(); e.returnValue = ''; } : null;
    clearInterval(s.intervalId);
    s.intervalId = setInterval(() => this.tick(), 1000);
    App.refresh();
  },

  pause() {
    const s = this.state;
    s.running = false;
    s.stopAt = null;
    window.onbeforeunload = null;
    clearInterval(s.intervalId);
    App.refresh();
  },

  reset() {
    const s = this.state;
    clearInterval(s.intervalId);
    s.running = false;
    s.stopAt = null;
    window.onbeforeunload = null;
    s.mode = 'focus';
    s.remaining = s.focusMin * 60;
    s.sessionStart = null;
    App.refresh();
  },

  updateRing() {
    const ring = document.getElementById('ringProgress');
    if (!ring) return;
    const circumference = 2 * Math.PI * this.RADIUS;
    ring.style.strokeDashoffset = this.offset(circumference);
  },

  async tick() {
    const s = this.state;
    s.remaining = Math.max(0, Math.round((s.endAt - Date.now()) / 1000));
    const display = document.getElementById('timerDisplay');
    if (display) display.textContent = this.fmt(Math.max(0, s.remaining));
    this.updateRing();
    this.updateGuardUI();

    if (s.remaining <= 0) {
      if (s.mode === 'focus') {
        await DB.put('focusSessions', {
          id: DB.uid(),
          startedAt: s.sessionStart || Date.now(),
          duration: s.focusMin * 60,
          intention: s.intention || '',
          level: s.level,
          taskId: s.taskId || null,
        });
        // Ist-Zeit an der Aufgabe festhalten (Grundlage der lernenden Schätzung)
        if (s.taskId) {
          const t = await DB.get('tasks', s.taskId);
          if (t) { t.actual = (t.actual || 0) + s.focusMin; await DB.put('tasks', t); }
        }
        s.stopAt = null;
        window.onbeforeunload = null;
        Planner.toast('Fokus geschafft 🎉');
        App.confetti(document.getElementById('ringWrap'), 30);
        s.mode = 'break';
        s.remaining = s.breakMin * 60;
      } else {
        s.mode = 'focus';
        s.remaining = s.focusMin * 60;
      }
      s.endAt = Date.now() + s.remaining * 1000;
      s.sessionStart = Date.now();
      if (App.current === 'focus') App.refresh();
    }
  },
};

// Nach dem Zurückkehren in die App sofort den korrekten Stand anzeigen
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && FocusView.state.running) FocusView.tick();
});
