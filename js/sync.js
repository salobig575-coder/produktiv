// Geräte-Sync über Supabase (REST, ohne Bibliothek). Offline-first: die lokale Datenbank bleibt die Arbeitskopie.
// Jede Änderung wird lokal als "dirty" vermerkt und später hochgeladen; fremde Änderungen werden geholt.
// Konflikte: Der Stand mit dem neueren Änderungszeitpunkt (client_ts) gewinnt.
const Sync = {
  STORES: ['tasks', 'notes', 'habits', 'habitLogs', 'focusSessions', 'settings', 'exercises', 'workouts', 'workoutSessions',
    'bodyMetrics', 'goals', 'cardioSessions', 'stepLogs', 'sleepLogs', 'gyms', 'events'], // Fotos (Blobs) bleiben lokal
  LOCAL_SETTINGS: ['aiKey', 'syncSession', 'syncUrl', 'syncKey', 'syncCursor'],
  status: 'aus',
  enabled: false, // erst nach Anmeldung wird mitgeschrieben (spart Arbeit; die Anmeldung markiert alles)
  _timer: null,

  keyOf(store, obj) { return store === 'settings' ? obj.key : obj.id; },

  eligible(store, obj) {
    if (!this.STORES.includes(store)) return false;
    if (store === 'settings') return !this.LOCAL_SETTINGS.includes(obj.key);
    if (store === 'exercises') return obj.custom === true; // mitgelieferte Übungen kommen aus dem Code
    return true;
  },

  // ---------- Dirty-Verwaltung (localStorage) ----------
  dirty() {
    try { return JSON.parse(localStorage.getItem('syncDirty') || '{}'); } catch (e) { return {}; }
  },
  saveDirty(d) {
    try { localStorage.setItem('syncDirty', JSON.stringify(d)); } catch (e) {}
  },
  mark(store, id, deleted) {
    if (!this.enabled) return;
    const d = this.dirty();
    d[`${store}\u0001${id}`] = { t: Date.now(), del: !!deleted };
    this.saveDirty(d);
    this.schedule();
  },

  install() {
    const put = DB.put.bind(DB), del = DB.delete.bind(DB), imp = DB.importAll.bind(DB);
    DB.rawPut = put;
    DB.rawDelete = del;
    DB.put = async (store, obj) => {
      const r = await put(store, obj);
      if (this.eligible(store, obj)) this.mark(store, this.keyOf(store, obj), false);
      return r;
    };
    DB.delete = async (store, id) => {
      const r = await del(store, id);
      if (this.STORES.includes(store) && !(store === 'exercises' && !String(id).startsWith('custom-')) &&
        !(store === 'settings' && this.LOCAL_SETTINGS.includes(id))) this.mark(store, id, true);
      return r;
    };
    DB.importAll = async (payload) => { await imp(payload); await this.markAll(); };
    this.cfg().then((c) => { this.enabled = !!c.session; }).catch(() => {});
    window.addEventListener('online', () => this.schedule(500));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.schedule(500); });
    this.schedule(1500);
  },

  async markAll() {
    const d = this.dirty(), t = Date.now();
    for (const store of this.STORES) {
      for (const obj of await DB.getAll(store)) {
        if (this.eligible(store, obj)) d[`${store}\u0001${this.keyOf(store, obj)}`] = { t, del: false };
      }
    }
    this.saveDirty(d);
    this.schedule();
  },

  // ---------- Konfiguration / Anmeldung ----------
  async cfg() {
    const rows = await Promise.all(['syncUrl', 'syncKey', 'syncSession', 'syncCursor'].map((k) => DB.get('settings', k)));
    const v = (r) => (r ? r.value : null);
    return { url: (v(rows[0]) || '').replace(/\/+$/, ''), key: v(rows[1]) || '', session: v(rows[2]), cursor: v(rows[3]) };
  },
  async setLocal(key, value) { await DB.rawPut('settings', { key, value }); },

  async auth(kind, email, password) {
    const c = await this.cfg();
    if (!c.url || !c.key) throw new Error('Projekt-URL und Anon-Key fehlen.');
    const path = kind === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
    const res = await fetch(c.url + path, { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.msg || j.error_description || j.message || `Fehler ${res.status}`);
    if (!j.access_token) throw new Error('Konto angelegt – bitte zuerst die Bestätigungs-E-Mail öffnen (oder in Supabase „Confirm email“ ausschalten) und dann anmelden.');
    await this.setLocal('syncSession', this.toSession(j));
    this.enabled = true;
    if (!c.cursor) await this.markAll(); // erste Anmeldung: vorhandene Daten hochladen
    this.schedule(200);
  },

  toSession(j) {
    return { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, user: j.user ? j.user.id : null, email: j.user ? j.user.email : '' };
  },

  async logout() {
    this.enabled = false;
    await this.setLocal('syncSession', null);
    await this.setLocal('syncCursor', null);
    this.status = 'aus';
  },

  async token() {
    const c = await this.cfg();
    if (!c.session) throw new Error('Nicht angemeldet.');
    if (Date.now() < c.session.exp) return { c, tok: c.session.access, uid: c.session.user };
    const res = await fetch(`${c.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: c.session.refresh }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) { await this.setLocal('syncSession', null); throw new Error('Sitzung abgelaufen – bitte neu anmelden.'); }
    const s = this.toSession(j);
    await this.setLocal('syncSession', s);
    return { c, tok: s.access, uid: s.user };
  },

  // ---------- Abgleich ----------
  schedule(ms = 3000) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.run().catch(() => {}), ms);
  },

  // Läufe werden nacheinander abgearbeitet, damit keine Änderung durch einen parallelen Lauf verloren geht.
  run() {
    this._chain = (this._chain || Promise.resolve()).then(() => this.runOnce()).catch(() => {});
    return this._chain;
  },

  async runOnce() {
    if (!navigator.onLine) return;
    const c0 = await this.cfg();
    if (!c0.session || !c0.url) { this.status = 'aus'; return; }
    this.status = 'läuft';
    try {
      const { c, tok, uid } = await this.token();
      const headers = { apikey: c.key, Authorization: `Bearer ${tok}`, 'content-type': 'application/json' };
      const changed = await this.pull(c, headers);
      await this.push(c, headers, uid);
      this.status = 'ok';
      localStorage.setItem('syncLast', String(Date.now()));
      if (changed && !App._modal) App.refresh();
    } catch (e) {
      this.status = 'Fehler: ' + e.message;
    }
  },

  async pull(c, headers) {
    let cursor = c.cursor, max = cursor, changed = false;
    const dirty = this.dirty();
    for (let offset = 0; ; offset += 500) {
      const q = `${c.url}/rest/v1/sync_docs?select=store,id,data,deleted,client_ts,updated_at&order=updated_at.asc,id.asc&limit=500&offset=${offset}` + (cursor ? `&updated_at=gte.${encodeURIComponent(cursor)}` : '');
      const res = await fetch(q, { headers, cache: 'no-store' });
      if (!res.ok) throw new Error(`Abruf fehlgeschlagen (${res.status}) – ist schema.sql ausgeführt?`);
      const rows = await res.json();
      for (const r of rows) {
        if (!this.STORES.includes(r.store)) continue;
        const k = `${r.store}\u0001${r.id}`;
        if (dirty[k] && dirty[k].t >= r.client_ts) continue; // lokale Änderung ist neuer
        const local = await DB.get(r.store, r.id);
        const same = r.deleted ? !local : (local && JSON.stringify(local) === JSON.stringify(r.data));
        if (!same) {
          if (r.deleted) await DB.rawDelete(r.store, r.id);
          else await DB.rawPut(r.store, r.data);
          changed = true;
          if (r.store === 'exercises' && typeof ExercisesView !== 'undefined') ExercisesView._cache = null;
        }
        if (dirty[k]) delete dirty[k];
        if (!max || r.updated_at > max) max = r.updated_at;
      }
      if (rows.length < 500) break;
    }
    this.saveDirty(dirty);
    if (max && max !== c.cursor) await this.setLocal('syncCursor', max);
    return changed;
  },

  async push(c, headers, uid) {
    const dirty = this.dirty();
    const keys = Object.keys(dirty);
    for (let i = 0; i < keys.length; i += 100) {
      const batch = [], sent = [];
      for (const k of keys.slice(i, i + 100)) {
        const [store, id] = k.split('\u0001');
        const d = dirty[k];
        let data = null, deleted = d.del;
        if (!deleted) {
          data = await DB.get(store, id);
          if (!data) deleted = true;
        }
        batch.push({ user_id: uid, store, id, data: deleted ? null : data, deleted, client_ts: d.t });
        sent.push([k, d.t]);
      }
      const res = await fetch(`${c.url}/rest/v1/sync_docs?on_conflict=user_id,store,id`, {
        method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`Hochladen fehlgeschlagen (${res.status})`);
      const now = this.dirty();
      for (const [k, t] of sent) if (now[k] && now[k].t === t) delete now[k]; // zwischenzeitlich geändert -> bleibt dirty
      this.saveDirty(now);
    }
  },

  statusText() {
    const last = Number(localStorage.getItem('syncLast') || 0);
    const n = Object.keys(this.dirty()).length;
    const when = last ? new Date(last).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'noch nie';
    if (this.status === 'aus') return 'Nicht verbunden.';
    if (this.status.startsWith('Fehler')) return this.status;
    return `Verbunden · zuletzt ${when}${n ? ` · ${n} Änderungen warten` : ''}`;
  },
};
