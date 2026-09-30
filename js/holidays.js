// Gesetzliche Feiertage in Deutschland (bundesweit + je Bundesland), ohne Netzwerk berechnet.
const Holidays = {
  STATES: {
    '': 'Nicht anzeigen', BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg',
    HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz',
    SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen',
  },
  _cache: {},

  // Ostersonntag (Gauß, gregorianisch)
  easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  },

  fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  year(y, state) {
    const key = `${y}:${state}`;
    if (this._cache[key]) return this._cache[key];
    const map = {};
    const fixed = (m, d, name, states) => { if (!states || states.includes(state)) map[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = name; };
    const e = this.easter(y);
    const rel = (n, name, states) => { const d = new Date(e); d.setDate(d.getDate() + n); if (!states || states.includes(state)) map[this.fmt(d)] = name; };

    fixed(1, 1, 'Neujahr');
    rel(-2, 'Karfreitag'); rel(1, 'Ostermontag');
    fixed(5, 1, 'Tag der Arbeit');
    rel(39, 'Christi Himmelfahrt'); rel(50, 'Pfingstmontag');
    fixed(10, 3, 'Tag der Deutschen Einheit');
    fixed(12, 25, '1. Weihnachtstag'); fixed(12, 26, '2. Weihnachtstag');

    fixed(1, 6, 'Heilige Drei Könige', ['BW', 'BY', 'ST']);
    fixed(3, 8, 'Internationaler Frauentag', ['BE', 'MV']);
    rel(0, 'Ostersonntag', ['BB']); rel(49, 'Pfingstsonntag', ['BB']);
    rel(60, 'Fronleichnam', ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']);
    fixed(8, 15, 'Mariä Himmelfahrt', ['SL']);
    fixed(9, 20, 'Weltkindertag', ['TH']);
    fixed(10, 31, 'Reformationstag', ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']);
    fixed(11, 1, 'Allerheiligen', ['BW', 'BY', 'NW', 'RP', 'SL']);
    if (state === 'SN') { // Buß- und Bettag: Mittwoch vor dem 23. November
      const d = new Date(y, 10, 22);
      while (d.getDay() !== 3) d.setDate(d.getDate() - 1);
      map[this.fmt(d)] = 'Buß- und Bettag';
    }
    this._cache[key] = map;
    return map;
  },

  // Name des Feiertags oder null (state '' = deaktiviert)
  name(dateStr, state) {
    if (!state) return null;
    return this.year(Number(dateStr.slice(0, 4)), state)[dateStr] || null;
  },
};
