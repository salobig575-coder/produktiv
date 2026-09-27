const ProfileView = {
  _saveTimer: null,

  async getProfile() {
    const stored = await DB.get('settings', 'fitnessProfile');
    return Object.assign({
      heightCm: '', weightKg: '', age: '', sex: 'male',
      targetWeightKg: '', activityLevel: 'sedentary', goal: 'maintain',
    }, stored || {});
  },

  async render() {
    const profile = await this.getProfile();
    const wrap = App.el('div');

    const heightInput = this.numberField('Größe (cm)', profile.heightCm, 'z.B. 178');
    const weightInput = this.numberField('Gewicht (kg)', profile.weightKg, 'z.B. 76.5', '0.1');
    const ageInput = this.numberField('Alter', profile.age, 'z.B. 28');
    const targetInput = this.numberField('Zielgewicht (kg)', profile.targetWeightKg, 'optional', '0.1');

    const sexSelect = App.el('select', {}, [
      App.el('option', { value: 'male' }, 'Männlich'),
      App.el('option', { value: 'female' }, 'Weiblich'),
    ]);
    sexSelect.value = profile.sex;

    const activitySelect = App.el('select', {}, Object.entries(ACTIVITY_FACTORS).map(([key, a]) =>
      App.el('option', { value: key }, a.label)
    ));
    activitySelect.value = profile.activityLevel;

    const goalSelect = App.el('select', {}, Object.entries(GOALS).map(([key, g]) =>
      App.el('option', { value: key }, g.label)
    ));
    goalSelect.value = profile.goal;

    const resultBox = App.el('div', { id: 'calcResults' });

    const collect = () => ({
      heightCm: heightInput.input.value,
      weightKg: weightInput.input.value,
      age: ageInput.input.value,
      targetWeightKg: targetInput.input.value,
      sex: sexSelect.value,
      activityLevel: activitySelect.value,
      goal: goalSelect.value,
    });

    const onChange = () => {
      const p = collect();
      this.renderResults(resultBox, p);
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.save(p), 400);
    };

    [heightInput.input, weightInput.input, ageInput.input, targetInput.input].forEach((el) => el.addEventListener('input', onChange));
    [sexSelect, activitySelect, goalSelect].forEach((el) => el.addEventListener('change', onChange));

    wrap.appendChild(App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.weight(), style: 'width:14px;height:14px' }), 'Körperdaten']),
      App.el('div', { class: 'row', style: 'gap:10px' }, [heightInput.field, weightInput.field]),
      App.el('div', { class: 'row', style: 'gap:10px' }, [ageInput.field, targetInput.field]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Geschlecht (für BMR-Berechnung)'), sexSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Aktivitätslevel'), activitySelect]),
      App.el('div', { class: 'field', style: 'margin-bottom:0' }, [App.el('label', {}, 'Trainingsziel'), goalSelect]),
    ]));

    wrap.appendChild(resultBox);
    this.renderResults(resultBox, profile, { instant: true });

    return wrap;
  },

  numberField(label, value, placeholder, step) {
    const input = App.el('input', { type: 'number', value: value || '', placeholder, step: step || '1', inputmode: 'decimal' });
    const field = App.el('div', { class: 'field', style: 'flex:1' }, [App.el('label', {}, label), input]);
    return { input, field };
  },

  async save(profile) {
    await DB.put('settings', { key: 'fitnessProfile', ...profile });
    if (profile.weightKg) {
      const today = App.todayStr();
      await DB.put('bodyMetrics', { id: `bm-${today}`, date: today, weight: Number(profile.weightKg) });
    }
  },

  renderResults(box, profile, opts = {}) {
    const result = Calc.full(profile);
    box.innerHTML = '';

    if (!result) {
      box.appendChild(App.el('div', { class: 'card empty', style: 'padding:26px 16px' }, [
        App.el('div', { class: 'empty-icon', html: Icons.sparkles() }),
        'Trag Größe, Gewicht und Alter ein, um deinen Kalorienbedarf zu sehen.',
      ]));
      return;
    }

    const hero = App.el('div', { class: 'card hero' }, [
      App.el('h2', {}, [App.el('span', { html: Icons.flame(), style: 'width:14px;height:14px' }), 'Dein Kalorienziel · ' + GOALS[result.goal].label]),
      App.el('div', { style: 'font-size:44px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums' }, [
        App.el('span', { id: 'calTarget' }, '0'), App.el('span', { style: 'font-size:18px;opacity:.75;font-weight:700' }, ' kcal/Tag'),
      ]),
      App.el('div', { class: 'stat-row', style: 'margin-top:14px' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num', id: 'calBmr' }, '0'), App.el('div', { class: 'lbl' }, 'BMR (Grundumsatz)')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num', id: 'calTdee' }, '0'), App.el('div', { class: 'lbl' }, 'TDEE (Gesamtumsatz)')]),
      ]),
    ]);
    box.appendChild(hero);

    const macroCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, 'Makro-Ziele pro Tag'),
      this.macroRow('Protein', 'calProtein', 'g', 'var(--accent-fit)'),
      this.macroRow('Fett', 'calFat', 'g', 'var(--warn)'),
      this.macroRow('Kohlenhydrate', 'calCarb', 'g', 'var(--accent-2)'),
    ]);
    box.appendChild(macroCard);

    const compareCard = App.el('div', { class: 'card' }, [
      App.el('h2', {}, 'Kalorien je nach Ziel'),
      App.el('div', { class: 'stat-row' }, Object.entries(GOALS).map(([key, g]) =>
        App.el('div', { class: 'stat' + (key === result.goal ? '' : '') }, [
          App.el('div', { class: 'num', style: key === result.goal ? 'color:var(--accent-fit)' : '' }, String(result.byGoal[key])),
          App.el('div', { class: 'lbl' }, g.label),
        ])
      )),
    ]);
    box.appendChild(compareCard);

    const duration = opts.instant ? 0 : 500;
    App.animateCounter(hero.querySelector('#calTarget'), result.target, { duration });
    App.animateCounter(hero.querySelector('#calBmr'), result.bmr, { duration });
    App.animateCounter(hero.querySelector('#calTdee'), result.tdee, { duration });
    App.animateCounter(macroCard.querySelector('#calProtein'), result.proteinG, { duration });
    App.animateCounter(macroCard.querySelector('#calFat'), result.fatG, { duration });
    App.animateCounter(macroCard.querySelector('#calCarb'), result.carbG, { duration });
  },

  macroRow(label, id, unit, color) {
    return App.el('div', { class: 'row', style: 'justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)' }, [
      App.el('div', { class: 'row', style: 'gap:8px' }, [
        App.el('span', { style: `width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0` }),
        App.el('span', { style: 'font-weight:600;font-size:14px' }, label),
      ]),
      App.el('span', { style: 'font-weight:800;font-variant-numeric:tabular-nums' }, [App.el('span', { id }, '0'), ' ' + unit]),
    ]);
  },
};
