// KI-Schicht (optional). Der Schlüssel liegt nur lokal auf diesem Gerät; Anfragen gehen direkt an die Anthropic-API
// oder an einen eigenen Proxy-Endpunkt (Einstellungen). Ohne Schlüssel bleibt die App voll nutzbar.
const AI = {
  MODELS: [
    { key: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (schnell, günstig)' },
    { key: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (genauer)' },
  ],

  async config() {
    const rows = await Promise.all(['aiKey', 'aiModel', 'aiEndpoint'].map((k) => DB.get('settings', k)));
    const v = (r, d) => (r && r.value ? r.value : d);
    return { key: v(rows[0], ''), model: v(rows[1], this.MODELS[0].key), endpoint: v(rows[2], '') };
  },

  async enabled() {
    const c = await this.config();
    return !!(c.key || c.endpoint);
  },

  async ask(system, user, maxTokens = 800) {
    const c = await this.config();
    if (!c.key && !c.endpoint) throw new Error('Kein KI-Zugang eingerichtet (Einstellungen → KI).');
    const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
    if (c.key) {
      headers['x-api-key'] = c.key;
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    const res = await fetch(c.endpoint || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) {
      let msg = `Fehler ${res.status}`;
      try { msg += ': ' + ((await res.json()).error || {}).message; } catch (e) {}
      throw new Error(msg);
    }
    const data = await res.json();
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  },

  // Aufgabe in 3–7 konkrete Schritte mit Minutenangabe zerlegen.
  async breakdown(task) {
    const text = await this.ask(
      'Du hilfst beim Planen. Zerlege die Aufgabe in 3 bis 7 kleine, konkrete Schritte auf Deutsch. ' +
      'Antworte ausschließlich mit einem JSON-Array: [{"title":"...","minutes":25}]. Minuten sind realistische Schätzungen (5–120), Titel kurz und mit Verb.',
      `Aufgabe: ${task.title}${task.notes ? `\nNotizen: ${task.notes}` : ''}${task.duration ? `\nGesamtdauer laut Nutzer: ${task.duration} Minuten` : ''}`,
      600
    );
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('Antwort konnte nicht gelesen werden.');
    const steps = JSON.parse(m[0]).filter((s) => s && s.title).slice(0, 8);
    return steps.map((s) => ({ title: String(s.title).slice(0, 120), minutes: Math.max(5, Math.min(120, Math.round(Number(s.minutes) / 5) * 5 || 25)) }));
  },

  async weeklySummary(stats) {
    return this.ask(
      'Du bist ein ruhiger, ehrlicher Produktivitäts-Coach. Schreibe auf Deutsch 2 bis 3 kurze Sätze als Wochenfazit mit einem konkreten Tipp für die nächste Woche. Keine Floskeln, kein Lob ohne Grund.',
      JSON.stringify(stats),
      300
    );
  },
};
