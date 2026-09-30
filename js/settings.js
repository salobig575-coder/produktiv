const SettingsView = {
  async open() {
    const fileInput = App.el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fileInput.addEventListener('change', () => this.importFile(fileInput.files[0]));

    const theme = App.currentTheme();
    const themeBtn = (key, label) => App.el('button', {
      class: 'btn secondary' + (theme === key ? ' selected' : ''),
      onclick: (e) => {
        App.applyTheme(key);
        e.currentTarget.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      },
    }, label);

    const [weightRow, intensityRow, metricRow, warmRow, restRow, uniRestRow, stepGoalRow] = await Promise.all([
      DB.get('settings', 'weightTrackingEnabled'), DB.get('settings', 'recordIntensity'), DB.get('settings', 'intensityMetric'),
      DB.get('settings', 'trackWarmupSets'), DB.get('settings', 'defaultRestSeconds'),
      DB.get('settings', 'unilateralRestSeconds'), DB.get('settings', 'stepGoal'),
    ]);
    const weightEnabled = weightRow ? weightRow.value !== false : true;
    const recordIntensity = intensityRow ? !!intensityRow.value : false;
    const intensityMetric = metricRow ? metricRow.value : 'rir';
    const trackWarmup = warmRow ? !!warmRow.value : false;
    const restSeconds = restRow ? restRow.value : 90;
    const uniRestSeconds = uniRestRow ? uniRestRow.value : 20;
    const stepGoal = stepGoalRow ? stepGoalRow.value : 8000;

    const stepGoalInput = App.el('input', { type: 'number', inputmode: 'numeric', value: stepGoal, style: 'max-width:140px' });
    stepGoalInput.addEventListener('change', async (e) => { await DB.put('settings', { key: 'stepGoal', value: Number(e.target.value) || 8000 }); });

    const restSelect = App.el('select', {}, [30, 45, 60, 90, 120, 150, 180, 240].map((s) => App.el('option', { value: s }, `${s} Sekunden`)));
    restSelect.value = String(restSeconds);
    restSelect.addEventListener('change', async (e) => { await DB.put('settings', { key: 'defaultRestSeconds', value: Number(e.target.value) }); });

    const uniRestSelect = App.el('select', {}, [10, 15, 20, 30, 45, 60, 90].map((s) => App.el('option', { value: s }, `${s} Sekunden`)));
    uniRestSelect.value = String(uniRestSeconds);
    uniRestSelect.addEventListener('change', async (e) => { await DB.put('settings', { key: 'unilateralRestSeconds', value: Number(e.target.value) }); });

    const metricSelect = App.el('select', {}, [
      App.el('option', { value: 'rir' }, 'Wiederholungen in Reserve (RIR)'),
      App.el('option', { value: 'rpe' }, 'Belastungsempfinden (RPE)'),
    ]);
    metricSelect.value = intensityMetric;
    metricSelect.addEventListener('change', async (e) => { await DB.put('settings', { key: 'intensityMetric', value: e.target.value }); });

    const ps = await Planner.settings();
    const startInput = App.el('input', { type: 'time', value: Planner.fmt(ps.start) });
    const endInput = App.el('input', { type: 'time', value: Planner.fmt(ps.end) });
    startInput.addEventListener('change', async () => { await DB.put('settings', { key: 'plannerStart', value: Planner.parseTime(startInput.value) }); });
    endInput.addEventListener('change', async () => { await DB.put('settings', { key: 'plannerEnd', value: Planner.parseTime(endInput.value) }); });
    const holSelect = App.el('select', {}, Object.entries(Holidays.STATES).map(([k, l]) => App.el('option', { value: k }, l)));
    holSelect.value = ps.holidays || '';
    holSelect.addEventListener('change', async (e) => { await DB.put('settings', { key: 'holidayState', value: e.target.value }); });
    const bufferSelect = App.el('select', {}, [0, 5, 10, 15, 30].map((m) => App.el('option', { value: m }, m ? `${m} Minuten` : 'Kein Puffer')));
    bufferSelect.value = String(ps.buffer);
    bufferSelect.addEventListener('change', async (e) => { await DB.put('settings', { key: 'plannerBuffer', value: Number(e.target.value) }); });

    const ai = await AI.config();
    const keyInput = App.el('input', { type: 'password', value: ai.key, placeholder: 'sk-ant-…', autocomplete: 'off' });
    keyInput.addEventListener('change', async () => { await DB.put('settings', { key: 'aiKey', value: keyInput.value.trim() }); });
    const modelSelect = App.el('select', {}, AI.MODELS.map((m) => App.el('option', { value: m.key }, m.label)));
    modelSelect.value = ai.model;
    modelSelect.addEventListener('change', async (e) => { await DB.put('settings', { key: 'aiModel', value: e.target.value }); });
    const endpointInput = App.el('input', { type: 'url', value: ai.endpoint, placeholder: 'Optional: eigener Proxy (statt api.anthropic.com)' });
    endpointInput.addEventListener('change', async () => { await DB.put('settings', { key: 'aiEndpoint', value: endpointInput.value.trim() }); });

    const sc = await Sync.cfg();
    const urlInput = App.el('input', { type: 'url', value: sc.url, placeholder: 'https://xxxx.supabase.co', autocapitalize: 'off' });
    const skeyInput = App.el('input', { type: 'password', value: sc.key, placeholder: 'anon public key', autocomplete: 'off' });
    const mailInput = App.el('input', { type: 'email', value: sc.session ? sc.session.email : '', placeholder: 'E-Mail', autocomplete: 'email' });
    const passInput = App.el('input', { type: 'password', placeholder: 'Passwort (mind. 6 Zeichen)', autocomplete: 'current-password' });
    const syncMsg = App.el('div', { class: 'tag', style: 'margin:8px 0 10px' }, Sync.statusText());
    const saveCfg = async () => { await Sync.setLocal('syncUrl', urlInput.value.trim()); await Sync.setLocal('syncKey', skeyInput.value.trim()); };
    const doAuth = (kind) => async () => {
      syncMsg.textContent = 'Einen Moment …';
      try {
        await saveCfg();
        await Sync.auth(kind, mailInput.value.trim(), passInput.value);
        await Sync.run();
        this.open();
      } catch (e) { syncMsg.textContent = e.message; }
    };
    const syncCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.sparkles(), style: 'width:14px;height:14px' }), 'Geräte-Sync']),
      App.el('p', { class: 'tag' }, 'Hält Mac, PC und iPhone synchron (Supabase). Einrichtung: siehe SYNC.md. Die Daten bleiben zusätzlich lokal auf jedem Gerät.'),
    ]);
    if (sc.session) {
      syncCard.appendChild(App.el('div', { class: 'tag', style: 'margin-bottom:4px' }, `Angemeldet als ${sc.session.email}`));
      syncCard.appendChild(syncMsg);
      syncCard.appendChild(App.el('button', { class: 'btn', style: 'margin-bottom:8px', onclick: async () => { syncMsg.textContent = 'Synchronisiere …'; await Sync.run(); syncMsg.textContent = Sync.statusText(); } }, 'Jetzt synchronisieren'));
      syncCard.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-bottom:0', onclick: async () => { await Sync.logout(); this.open(); } }, 'Abmelden'));
    } else {
      syncCard.appendChild(App.el('div', { class: 'field' }, [App.el('label', {}, 'Projekt-URL'), urlInput]));
      syncCard.appendChild(App.el('div', { class: 'field' }, [App.el('label', {}, 'Anon Key'), skeyInput]));
      syncCard.appendChild(App.el('div', { class: 'field' }, [App.el('label', {}, 'Konto'), mailInput]));
      syncCard.appendChild(App.el('div', { class: 'field', style: 'margin-bottom:0' }, [passInput]));
      syncCard.appendChild(syncMsg);
      syncCard.appendChild(App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: doAuth('signup') }, 'Registrieren'),
        App.el('button', { class: 'btn', onclick: doAuth('login') }, 'Anmelden'),
      ]));
    }

    const icsInput = App.el('input', { type: 'file', accept: '.ics,text/calendar', style: 'display:none' });
    icsInput.addEventListener('change', () => this.importICS(icsInput.files[0]));

    const content = App.el('div', {}, [
      App.el('h3', {}, 'Einstellungen'),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, 'Darstellung'),
        App.el('div', { class: 'fab-row', style: 'margin-bottom:0' }, [
          themeBtn('auto', 'Automatisch'),
          themeBtn('light', 'Hell'),
          themeBtn('dark', 'Dunkel'),
        ]),
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.planen(), style: 'width:14px;height:14px' }), 'Planer']),
        App.el('div', { class: 'row' }, [
          App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Tag beginnt'), startInput]),
          App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, 'Tag endet'), endInput]),
        ]),
        App.el('div', { class: 'field' }, [App.el('label', {}, 'Puffer zwischen Blöcken'), bufferSelect, App.el('p', { class: 'tag', style: 'margin-top:4px' }, 'Die automatische Planung nutzt nur Zeit innerhalb dieses Fensters.')]),
        App.el('div', { class: 'field' }, [App.el('label', {}, 'Feiertage anzeigen'), holSelect]),
        App.switchRow('Erinnerungen', 'Hinweis vor Terminen, solange Produktiv geöffnet ist. Benachrichtigungen des Browsers werden zusätzlich genutzt, falls erlaubt.', ps.reminders, async (val) => {
          await DB.put('settings', { key: 'remindersEnabled', value: val });
          if (val && Native.isNative()) await Native.requestNotifications();
          if (val && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
        }),
      ]),
      syncCard,
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.sparkles(), style: 'width:14px;height:14px' }), 'KI (optional)']),
        App.el('p', { class: 'tag' }, 'Aufgaben in Schritte zerlegen und Wochenfazit. Der Schlüssel bleibt nur auf diesem Gerät; Anfragen gehen direkt an Anthropic. Ohne Schlüssel funktioniert alles andere wie gewohnt.'),
        App.el('div', { class: 'field' }, [App.el('label', {}, 'API-Schlüssel'), keyInput]),
        App.el('div', { class: 'field' }, [App.el('label', {}, 'Modell'), modelSelect]),
        App.el('div', { class: 'field', style: 'margin-bottom:0' }, [App.el('label', {}, 'Proxy-Endpunkt'), endpointInput]),
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.planen(), style: 'width:14px;height:14px' }), 'Kalender-Austausch']),
        App.el('p', { class: 'tag' }, 'Termine als .ics-Datei sichern oder aus Google, Apple oder Outlook übernehmen. Ganztägige Termine werden übersprungen.'),
        App.el('button', { class: 'btn', style: 'margin-bottom:8px', onclick: () => this.exportICS() }, [App.el('span', { html: Icons.download(), style: 'width:16px;height:16px' }), 'Kalender exportieren (.ics)']),
        App.el('button', { class: 'btn secondary', style: 'margin-bottom:0', onclick: () => icsInput.click() }, [App.el('span', { html: Icons.upload(), style: 'width:16px;height:16px' }), 'Kalender importieren (.ics)']),
        icsInput,
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.fitness(), style: 'width:14px;height:14px' }), 'Training & Fortschritt']),
        App.switchRow('Gewicht tracken', 'Gewichtskarte im Fitness-Bereich anzeigen und protokollieren.', weightEnabled, async (val) => {
          await DB.put('settings', { key: 'weightTrackingEnabled', value: val });
        }),
        App.el('div', { class: 'field', style: 'margin-top:2px' }, [App.el('label', {}, 'Intensitätsmaß'), metricSelect]),
        App.switchRow('Intensitätsmessung aufzeichnen', 'Zeigt ein RIR/RPE-Feld bei jedem Satz im Workout-Editor und beim Training an.', recordIntensity, async (val) => {
          await DB.put('settings', { key: 'recordIntensity', value: val });
        }),
        App.switchRow('Aufwärmsätze verfolgen', 'Erlaubt, Sätze als Aufwärmsatz zu markieren — zählen nicht zu Volumen & Rekorden.', trackWarmup, async (val) => {
          await DB.put('settings', { key: 'trackWarmupSets', value: val });
        }),
        App.el('div', { class: 'field', style: 'margin-top:10px' }, [App.el('label', {}, 'Standard-Pausenzeit'), restSelect]),
        App.el('div', { class: 'field', style: 'margin-bottom:0' }, [App.el('label', {}, 'Standard-Pausenzeit (unilateral)'), uniRestSelect, App.el('p', { class: 'tag', style: 'margin-top:4px' }, 'Pause nach der ersten Seite bei einseitigen Übungen (L/R).')]),
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.bolt(), style: 'width:14px;height:14px' }), 'Cardio & Schritte']),
        App.el('div', { class: 'field', style: 'margin-bottom:0' }, [App.el('label', {}, 'Tagesziel Schritte'), stepGoalInput]),
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.fitness(), style: 'width:14px;height:14px' }), 'Fitnessstudios & Ausrüstung']),
        App.el('button', { class: 'btn secondary', style: 'margin-bottom:0', onclick: () => Gyms.manage() }, 'Fitnessstudios verwalten'),
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.download(), style: 'width:14px;height:14px' }), 'Backup']),
        App.el('p', { class: 'tag' }, 'Alle Daten liegen lokal in einer Datenbank auf diesem Gerät. Exportiere regelmäßig eine Sicherung als Datei.'),
        App.el('button', { class: 'btn', style: 'margin-bottom:8px', onclick: () => this.exportFile() }, [App.el('span', { html: Icons.download(), style: 'width:16px;height:16px' }), 'Backup exportieren (.json)']),
        App.el('button', { class: 'btn secondary', onclick: () => fileInput.click() }, [App.el('span', { html: Icons.upload(), style: 'width:16px;height:16px' }), 'Backup importieren']),
        fileInput,
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.el('span', { html: Icons.sparkles(), style: 'width:14px;height:14px' }), 'App installieren']),
        App.el('p', { class: 'tag' }, 'Am Handy: Browser-Menü → „Zum Startbildschirm hinzufügen“. Am PC: Adressleiste → Install-Symbol.'),
      ]),
      App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Schließen'),
    ]);
    App.showModal(content);
  },

  async exportICS() {
    const blob = new Blob([Planner.toICS(await Planner.load())], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produktiv-kalender-${App.todayStr()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async importICS(file) {
    if (!file) return;
    try {
      const { events, skipped } = Planner.parseICS(await file.text());
      for (const e of events) await DB.put('events', e);
      App.closeModal();
      App.refresh();
      Planner.toast(`${events.length} Termine importiert${skipped ? `, ${skipped} übersprungen` : ''}.`);
    } catch (e) {
      alert('Kalender konnte nicht gelesen werden: ' + e.message);
    }
  },

  async exportFile() {
    try { localStorage.setItem('lastBackup', String(Date.now())); } catch (e) {}
    const payload = await DB.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produktiv-backup-${App.todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async importFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await DB.importAll(payload);
      App.closeModal();
      App.refresh();
    } catch (e) {
      alert('Backup konnte nicht gelesen werden: ' + e.message);
    }
  },
};
