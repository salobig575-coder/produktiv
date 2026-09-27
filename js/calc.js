const ACTIVITY_FACTORS = {
  sedentary: { factor: 1.2, label: 'Sitzend (wenig/keine Bewegung)' },
  light: { factor: 1.375, label: 'Leicht aktiv (1-3x Sport/Woche)' },
  moderate: { factor: 1.55, label: 'Mäßig aktiv (3-5x Sport/Woche)' },
  active: { factor: 1.725, label: 'Sehr aktiv (6-7x Sport/Woche)' },
  veryActive: { factor: 1.9, label: 'Extrem aktiv (Leistungssport/körperliche Arbeit)' },
};

const GOALS = {
  lose: { label: 'Abnehmen', delta: -350 },
  maintain: { label: 'Gewicht halten', delta: 0 },
  gain: { label: 'Muskelaufbau', delta: 300 },
};

const Calc = {
  bmr({ weightKg, heightCm, age, sex }) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return Math.round(sex === 'female' ? base - 161 : base + 5);
  },

  tdee(bmrValue, activityLevel) {
    const f = ACTIVITY_FACTORS[activityLevel]?.factor || 1.2;
    return Math.round(bmrValue * f);
  },

  calorieTarget(tdeeValue, goal) {
    const delta = GOALS[goal]?.delta ?? 0;
    return Math.max(1000, Math.round(tdeeValue + delta));
  },

  macros(calorieTargetValue, weightKg) {
    const proteinG = Math.round(weightKg * 1.8);
    const proteinKcal = proteinG * 4;
    const fatKcal = calorieTargetValue * 0.27;
    const fatG = Math.round(fatKcal / 9);
    const carbKcal = Math.max(0, calorieTargetValue - proteinKcal - fatKcal);
    const carbG = Math.round(carbKcal / 4);
    return { proteinG, fatG, carbG };
  },

  full(profile) {
    const weightKg = Number(profile.weightKg);
    const heightCm = Number(profile.heightCm);
    const age = Number(profile.age);
    if (!weightKg || !heightCm || !age) return null;

    const bmrValue = this.bmr({ weightKg, heightCm, age, sex: profile.sex || 'male' });
    const tdeeValue = this.tdee(bmrValue, profile.activityLevel || 'sedentary');
    const goal = profile.goal || 'maintain';
    const target = this.calorieTarget(tdeeValue, goal);
    const macros = this.macros(target, weightKg);

    return {
      bmr: bmrValue,
      tdee: tdeeValue,
      target,
      goal,
      ...macros,
      byGoal: Object.fromEntries(
        Object.keys(GOALS).map((g) => [g, this.calorieTarget(tdeeValue, g)])
      ),
    };
  },

  estimatedOneRepMax(weight, reps) {
    if (!weight || !reps) return 0;
    return Math.round(weight * (1 + reps / 30));
  },
};
