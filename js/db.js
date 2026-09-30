const DB_NAME = 'produktiv-db';
const DB_VERSION = 5;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('tasks')) {
        const s = db.createObjectStore('tasks', { keyPath: 'id' });
        s.createIndex('done', 'done');
        s.createIndex('dueDate', 'dueDate');
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('habits')) {
        db.createObjectStore('habits', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('habitLogs')) {
        const s = db.createObjectStore('habitLogs', { keyPath: 'id' });
        s.createIndex('habitId', 'habitId');
        s.createIndex('habitDate', ['habitId', 'date'], { unique: true });
      }
      if (!db.objectStoreNames.contains('focusSessions')) {
        const s = db.createObjectStore('focusSessions', { keyPath: 'id' });
        s.createIndex('startedAt', 'startedAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('exercises')) {
        db.createObjectStore('exercises', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('workouts')) {
        db.createObjectStore('workouts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('workoutSessions')) {
        const s = db.createObjectStore('workoutSessions', { keyPath: 'id' });
        s.createIndex('startedAt', 'startedAt');
      }
      if (!db.objectStoreNames.contains('bodyMetrics')) {
        const s = db.createObjectStore('bodyMetrics', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cardioSessions')) {
        const s = db.createObjectStore('cardioSessions', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('stepLogs')) {
        const s = db.createObjectStore('stepLogs', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('sleepLogs')) {
        const s = db.createObjectStore('sleepLogs', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('progressPhotos')) {
        const s = db.createObjectStore('progressPhotos', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('events')) {
        const s = db.createObjectStore('events', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('gyms')) {
        db.createObjectStore('gyms', { keyPath: 'id' });
      }
    };

    // Blockiert eine noch laufende alte App-Instanz das Update, hängt sonst alles ohne Meldung
    req.onblocked = () => {
      const show = () => {
        if (document.getElementById('dbBlocked')) return;
        const b = document.createElement('div');
        b.id = 'dbBlocked';
        b.style.cssText = 'position:fixed;left:16px;right:16px;bottom:100px;z-index:999;background:#e5484d;color:#fff;padding:14px 16px;border-radius:14px;font:600 14px/1.4 -apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)';
        b.textContent = 'Die Datenbank wird aktualisiert, aber die App ist noch woanders geöffnet. Bitte alle Produktiv-Fenster schließen (auf dem iPhone: im App-Wechsler nach oben wischen) und neu öffnen.';
        document.body.appendChild(b);
      };
      if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Künftige Updates dürfen nicht an offenen Verbindungen hängen bleiben
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = openDB();

function withStore(storeName, mode, fn) {
  return dbPromise.then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  async getAll(storeName) {
    try {
      return await withStore(storeName, 'readonly', (store) => reqToPromise(store.getAll()));
    } catch (e) {
      if (e && e.name === 'NotFoundError') return []; // Speicher fehlt (Update noch nicht durch) – leer statt Absturz
      throw e;
    }
  },

  async get(storeName, id) {
    const db = await dbPromise;
    if (!db.objectStoreNames.contains(storeName)) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, obj) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => resolve(obj);
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(storeName, id) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async exportAll() {
    const stores = ['tasks', 'notes', 'habits', 'habitLogs', 'focusSessions', 'settings', 'exercises', 'workouts', 'workoutSessions', 'bodyMetrics', 'goals', 'cardioSessions', 'stepLogs', 'sleepLogs', 'progressPhotos', 'gyms', 'events'];
    const data = {};
    for (const s of stores) {
      data[s] = await this.getAll(s);
    }
    return { exportedAt: new Date().toISOString(), data };
  },

  async importAll(payload) {
    const db = await dbPromise;
    const stores = Object.keys(payload.data || {});
    for (const s of stores) {
      if (!db.objectStoreNames.contains(s)) continue;
      const tx = db.transaction(s, 'readwrite');
      const store = tx.objectStore(s);
      for (const item of payload.data[s]) {
        store.put(item);
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
  },
};
