const PlanenHub = {
  activeTab: 'tasks',
  tabs: [
    { key: 'tasks', label: 'Aufgaben' },
    { key: 'notes', label: 'Notizen' },
    { key: 'habits', label: 'Habits' },
    { key: 'focus', label: 'Fokus' },
  ],
  viewFor(key) {
    return { tasks: TasksView, notes: NotesView, habits: HabitsView, focus: FocusView }[key];
  },

  async render() {
    const wrap = App.el('div');
    wrap.appendChild(App.tabBar(this.tabs, this.activeTab, (key) => { this.activeTab = key; App.refresh(); }));
    const node = await this.viewFor(this.activeTab).render();
    wrap.appendChild(node);
    return wrap;
  },
};

const FitnessHub = {
  activeTab: 'profile',
  tabs: [
    { key: 'workouts', label: 'Workouts' },
    { key: 'exercises', label: 'Übungen' },
    { key: 'progress', label: 'Progress' },
    { key: 'profile', label: 'Profil' },
  ],

  async render() {
    const wrap = App.el('div', { class: 'hub-fitness' });
    wrap.appendChild(App.tabBar(this.tabs, this.activeTab, (key) => { this.activeTab = key; App.refresh(); }));

    let node;
    if (this.activeTab === 'profile') {
      node = await ProfileView.render();
    } else if (this.activeTab === 'workouts') {
      if (typeof WorkoutSessionView !== 'undefined' && WorkoutSessionView.state.active) {
        node = await WorkoutSessionView.render();
      } else {
        node = typeof WorkoutsView !== 'undefined' ? await WorkoutsView.render() : this.placeholder('Workouts', Icons.fitness());
      }
    } else if (this.activeTab === 'exercises') {
      node = typeof ExercisesView !== 'undefined' ? await ExercisesView.render() : this.placeholder('Übungen', Icons.dumbbell ? Icons.dumbbell() : Icons.fitness());
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
