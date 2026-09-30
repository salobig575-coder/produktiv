// Brücke zur nativen Hülle (Capacitor). Im Browser passiert hier nichts.
// iOS/Android: geplante lokale Benachrichtigungen, damit Erinnerungen auch bei geschlossener App kommen.
const Native = {
  isNative() {
    return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  },

  plugin(name) {
    return window.Capacitor && Capacitor.Plugins ? Capacitor.Plugins[name] : null;
  },

  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h) % 2147483000 + 1;
  },

  async requestNotifications() {
    const LN = this.plugin('LocalNotifications');
    if (!LN) return false;
    try { return (await LN.requestPermissions()).display === 'granted'; } catch (e) { return false; }
  },

  // Plant alle Erinnerungen der nächsten 7 Tage neu (alte werden vorher entfernt).
  async syncReminders() {
    const LN = this.plugin('LocalNotifications');
    if (!LN || this._syncing) return;
    this._syncing = true;
    try {
      const pending = await LN.getPending();
      if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      const s = await Planner.settings();
      if (!s.reminders) return;
      const data = await Planner.load();
      const now = Date.now(), list = [];
      for (let i = 0; i < 7; i++) {
        const date = Planner.addDays(App.todayStr(), i);
        for (const r of Planner.reminderList(data, date)) {
          const at = new Date(date + 'T00:00:00');
          at.setMinutes(r.at);
          if (at.getTime() <= now) continue;
          list.push({ id: this.hash(r.key), title: 'Produktiv', body: r.msg, schedule: { at } });
        }
      }
      if (list.length) await LN.schedule({ notifications: list.slice(0, 60) });
    } catch (e) {} finally { this._syncing = false; }
  },
};
