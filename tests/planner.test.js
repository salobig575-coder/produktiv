// Läuft mit: node --test tests/   (keine Abhängigkeiten nötig)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Browser-Umgebung minimal nachbilden und die Module laden
global.App = {
  todayStr(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
};
global.DB = { uid: () => 'id' + Math.random().toString(36).slice(2, 8) };
global.Native = { isNative: () => false };
const load = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
eval(load('holidays.js') + ';global.Holidays = Holidays;');
eval(load('planner.js') + ';global.Planner = Planner;');

const today = App.todayStr();

test('Schnelleingabe: Termin mit Uhrzeit und Dauer', () => {
  const p = Planner.parseQuick('Zahnarzt morgen 15 Uhr 1h');
  assert.strictEqual(p.kind, 'event');
  assert.strictEqual(p.title, 'Zahnarzt');
  assert.strictEqual(p.start, 15 * 60);
  assert.strictEqual(p.dur, 60);
  assert.strictEqual(p.date, Planner.addDays(today, 1));
});

test('Schnelleingabe: Aufgabe mit Priorität und Dauer', () => {
  const p = Planner.parseQuick('Steuer erledigen p1 45min');
  assert.strictEqual(p.kind, 'task');
  assert.strictEqual(p.priority, 'high');
  assert.strictEqual(p.dur, 45);
  assert.strictEqual(p.title, 'Steuer erledigen');
});

test('Schnelleingabe: Wiederholung und Dezimalstunden', () => {
  const p = Planner.parseQuick('Sport jeden Montag um 18:30 1,5h');
  assert.strictEqual(p.repeat, 'weekly');
  assert.strictEqual(p.start, 18 * 60 + 30);
  assert.strictEqual(p.dur, 90);
  assert.strictEqual(new Date(p.date + 'T00:00:00').getDay(), 1);
});

test('Wiederholungen: wöchentlich, Ausnahmen und Enddatum', () => {
  const base = '2026-10-05'; // Montag
  const ev = { date: base, repeat: 'weekly', skip: ['2026-10-12'], until: '2026-10-26' };
  assert.ok(Planner.occursOn(ev, '2026-10-05'));
  assert.ok(!Planner.occursOn(ev, '2026-10-06'));
  assert.ok(!Planner.occursOn(ev, '2026-10-12'), 'übersprungener Tag');
  assert.ok(Planner.occursOn(ev, '2026-10-19'));
  assert.ok(!Planner.occursOn(ev, '2026-11-02'), 'nach Enddatum');
  assert.ok(!Planner.occursOn(ev, '2026-09-28'), 'vor Beginn');
});

test('Werktags-Wiederholung überspringt das Wochenende', () => {
  const ev = { date: '2026-10-05', repeat: 'weekdays' };
  assert.ok(Planner.occursOn(ev, '2026-10-09'));
  assert.ok(!Planner.occursOn(ev, '2026-10-10'));
  assert.ok(!Planner.occursOn(ev, '2026-10-11'));
});

test('Freie Zeit berücksichtigt Termine und Puffer', () => {
  const s = { start: 480, end: 1200, buffer: 5 };
  const items = [{ start: 600, end: 660 }, { start: 780, end: 840 }];
  const gaps = Planner.freeSlots(items, s, '2000-01-01');
  assert.deepStrictEqual(gaps, [[480, 595], [665, 775], [845, 1200]]);
});

test('Lernende Schätzung: erst ab drei Datenpunkten, begrenzt', () => {
  const mk = (r) => ({ done: true, duration: 30, actual: 30 * r });
  assert.strictEqual(Planner.estimateFactor([mk(2), mk(2)]), 1);
  assert.strictEqual(Planner.estimateFactor([mk(1.5), mk(1.5), mk(1.4), mk(2)]), 1.5);
  assert.strictEqual(Planner.estimateFactor([mk(5), mk(5), mk(5)]), 2);
});

test('Nächste Fälligkeit wiederkehrender Aufgaben', () => {
  const far = Planner.addDays(today, 10);
  assert.strictEqual(Planner.nextDue(far, 'daily'), Planner.addDays(far, 1));
  assert.strictEqual(Planner.nextDue(far, 'weekly'), Planner.addDays(far, 7));
  const wd = Planner.nextDue(far, 'weekdays');
  assert.ok(![0, 6].includes(new Date(wd + 'T00:00:00').getDay()));
});

test('ICS: Export und Import ergeben denselben Termin (inkl. Enddatum, Ausnahme)', () => {
  const ev = { id: 'a', title: 'Sport, hart; ok', date: '2026-10-05', start: 1110, dur: 90, repeat: 'weekdays', skip: ['2026-10-07'], until: '2026-12-31' };
  const ics = Planner.toICS({ events: [ev], tasks: [] });
  const back = Planner.parseICS(ics).events[0];
  assert.strictEqual(back.title, ev.title);
  assert.strictEqual(back.date, ev.date);
  assert.strictEqual(back.start, ev.start);
  assert.strictEqual(back.dur, ev.dur);
  assert.strictEqual(back.repeat, 'weekdays');
  assert.deepStrictEqual(back.skip, ['2026-10-07']);
  assert.strictEqual(back.until, '2026-12-31');
});

test('Feiertage: Ostern und bundeslandabhängige Tage', () => {
  assert.strictEqual(Holidays.fmt(Holidays.easter(2026)), '2026-04-05');
  assert.strictEqual(Holidays.name('2026-04-03', 'NW'), 'Karfreitag');
  assert.strictEqual(Holidays.name('2026-04-06', 'HH'), 'Ostermontag');
  assert.strictEqual(Holidays.name('2026-06-04', 'BY'), 'Fronleichnam');
  assert.strictEqual(Holidays.name('2026-06-04', 'HH'), null);
  assert.strictEqual(Holidays.name('2026-10-31', 'SN'), 'Reformationstag');
  assert.strictEqual(Holidays.name('2026-11-18', 'SN'), 'Buß- und Bettag');
  assert.strictEqual(Holidays.name('2026-12-25', ''), null, 'deaktiviert');
});
