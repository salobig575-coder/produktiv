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

    const [weightRow, intensityRow, metricRow, warmRow, restRow, uniRestRow] = await Promise.all([
      DB.get('settings', 'weightTrackingEnabled'), DB.get('settings', 'recordIntensity'), DB.get('settings', 'intensityMetric'),
      DB.get('settings', 'trackWarmupSets'), DB.get('settings', 'defaultRestSeconds'),
      DB.get('settings', 'unilateralRestSeconds'),
    ]);
    const weightEnabled = weightRow ? weightRow.value !== false : true;
    const recordIntensity = intensityRow ? !!intensityRow.value : false;
    const intensityMetric = metricRow ? metricRow.value : 'rir';
    const trackWarmup = warmRow ? !!warmRow.value : false;
    const restSeconds = restRow ? restRow.value : 90;
    const uniRestSeconds = uniRestRow ? uniRestRow.value : 20;

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

  async exportFile() {
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
