const FocusView = {
  state: {
    mode: 'focus',
    focusMin: 25,
    breakMin: 5,
    remaining: 25 * 60,
    running: false,
    intervalId: null,
    sessionStart: null,
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
        App.el('div', { class: 'timer-mode', id: 'timerMode' }, s.mode === 'focus' ? 'Fokus' : 'Pause'),
      ]),
    ]);
    wrap.appendChild(ringWrap);

    wrap.appendChild(App.el('div', { class: 'timer-controls' }, [
      App.el('button', {
        class: 'btn', id: 'toggleBtn',
        onclick: () => this.toggle(),
      }, s.running ? 'Pause' : 'Start'),
      App.el('button', { class: 'btn secondary', onclick: () => this.reset() }, 'Zurücksetzen'),
    ]));

    if (!s.running) {
      wrap.appendChild(App.el('div', { class: 'row', style: 'justify-content:center;gap:16px;margin-bottom:16px' }, [
        this.durationPicker('focusMin', 'Fokus (Min)'),
        this.durationPicker('breakMin', 'Pause (Min)'),
      ]));
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
    if (this.state.running) this.pause();
    else this.start();
  },

  start() {
    const s = this.state;
    if (!s.sessionStart) s.sessionStart = Date.now();
    s.running = true;
    clearInterval(s.intervalId);
    s.intervalId = setInterval(() => this.tick(), 1000);
    App.refresh();
  },

  pause() {
    const s = this.state;
    s.running = false;
    clearInterval(s.intervalId);
    App.refresh();
  },

  reset() {
    const s = this.state;
    clearInterval(s.intervalId);
    s.running = false;
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
    s.remaining -= 1;
    const display = document.getElementById('timerDisplay');
    if (display) display.textContent = this.fmt(Math.max(0, s.remaining));
    this.updateRing();

    if (s.remaining <= 0) {
      if (s.mode === 'focus') {
        await DB.put('focusSessions', {
          id: DB.uid(),
          startedAt: s.sessionStart || Date.now(),
          duration: s.focusMin * 60,
        });
        s.mode = 'break';
        s.remaining = s.breakMin * 60;
      } else {
        s.mode = 'focus';
        s.remaining = s.focusMin * 60;
      }
      s.sessionStart = Date.now();
      if (App.current === 'focus') App.refresh();
    }
  },
};
