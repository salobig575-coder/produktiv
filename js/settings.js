const SettingsView = {
  open() {
    const fileInput = App.el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fileInput.addEventListener('change', () => this.importFile(fileInput.files[0]));

    const content = App.el('div', {}, [
      App.el('h3', {}, 'Einstellungen'),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, 'Backup'),
        App.el('p', { class: 'tag' }, 'Alle Daten liegen lokal in einer Datenbank auf diesem Gerät. Exportiere regelmäßig eine Sicherung als Datei.'),
        App.el('button', { class: 'btn', style: 'margin-bottom:8px', onclick: () => this.exportFile() }, '⬇️ Backup exportieren (.json)'),
        App.el('button', { class: 'btn secondary', onclick: () => fileInput.click() }, '⬆️ Backup importieren'),
        fileInput,
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, 'App installieren'),
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
