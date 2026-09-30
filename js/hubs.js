const PlanenHub = {
  activeTab: 'calendar',
  tabIcons: { calendar: 'planen', tasks: 'tasks', notes: 'notes', habits: 'habits', focus: 'focus' },
  tabs: [
    { key: 'calendar', label: 'Kalender' },
    { key: 'tasks', label: 'Aufgaben' },
    { key: 'notes', label: 'Notizen' },
    { key: 'habits', label: 'Habits' },
    { key: 'focus', label: 'Fokus' },
  ],
  viewFor(key) {
    return { calendar: CalendarView, tasks: TasksView, notes: NotesView, habits: HabitsView, focus: FocusView }[key];
  },

  async render() {
    const wrap = App.el('div');
    const node = await this.viewFor(this.activeTab).render();
    wrap.appendChild(node);
    return wrap;
  },
};

const FitnessHub = {
  activeTab: 'uebersicht',
  tabIcons: { uebersicht: 'bolt', workouts: 'fitness', exercises: 'weight', progress: 'trophy' },
  tabs: [
    { key: 'uebersicht', label: 'Übersicht' },
    { key: 'workouts', label: 'Workouts' },
    { key: 'exercises', label: 'Übungen' },
    { key: 'progress', label: 'Progress' },
  ],

  async render() {
    const wrap = App.el('div');

    let node;
    if (this.activeTab === 'uebersicht') {
      node = typeof FitnessDashboardView !== 'undefined' ? await FitnessDashboardView.render() : this.placeholder('Übersicht', Icons.fitness());
    } else if (this.activeTab === 'workouts') {
      if (typeof WorkoutSessionView !== 'undefined' && WorkoutSessionView.state.active) {
        node = await WorkoutSessionView.render();
      } else {
        node = typeof WorkoutsView !== 'undefined' ? await WorkoutsView.render() : this.placeholder('Workouts', Icons.fitness());
      }
    } else if (this.activeTab === 'exercises') {
      node = typeof ExercisesView !== 'undefined' ? await ExercisesView.render() : this.placeholder('Übungen', Icons.fitness());
    } else if (this.activeTab === 'progress') {
      node = typeof ProgressView !== 'undefined' ? await ProgressView.render() : this.placeholder('Progress', Icons.trophy());
    }
    wrap.appendChild(node);
    return wrap;
  },

  placeholder(name, icon) {
    return App.el('div', { class: 'empty' }, [
      App.el('div', { class: 'empty-icon', html: icon }),
      `${name} kommt in der nächsten Ausbaustufe.`,
    ]);
  },
};
