const MUSCLE_GROUPS = ['Brust', 'Rücken', 'Beine', 'Schultern', 'Bizeps', 'Trizeps', 'Unterarm', 'Bauch'];
const EXERCISE_SEED_VERSION = 2;

const EXERCISE_SEED_CURATED = [
  // Brust
  { id: 'bench-press', name: 'Bankdrücken', primaryMuscle: 'Brust', secondaryMuscles: ['Trizeps', 'Schultern'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Der Klassiker für Brustkraft und -masse.', execution: 'Rückenlage, Stange schulterbreit-plus greifen, kontrolliert zur Brust absenken, explosiv drücken.', variants: ['incline-bench-press', 'dumbbell-bench-press', 'close-grip-bench-press'] },
  { id: 'incline-bench-press', name: 'Schrägbankdrücken', primaryMuscle: 'Brust', secondaryMuscles: ['Schultern', 'Trizeps'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Betont die obere Brust stärker als flaches Bankdrücken.', execution: 'Bank auf 30-45°, Stange zum oberen Brustbereich führen.', variants: ['bench-press', 'dumbbell-bench-press'] },
  { id: 'dumbbell-bench-press', name: 'Kurzhantel-Bankdrücken', primaryMuscle: 'Brust', secondaryMuscles: ['Trizeps', 'Schultern'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'beginner', description: 'Größerer Bewegungsradius, trainiert Stabilität zusätzlich.', execution: 'Hanteln über der Brust nach oben drücken, Ellbogen nicht überstrecken.', variants: ['bench-press', 'incline-bench-press'] },
  { id: 'decline-bench-press', name: 'Negativbankdrücken', primaryMuscle: 'Brust', secondaryMuscles: ['Trizeps'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Fokus auf untere Brust.', execution: 'Bank nach unten geneigt, Stange zur unteren Brust führen.', variants: ['bench-press'] },
  { id: 'push-up', name: 'Liegestütze', primaryMuscle: 'Brust', secondaryMuscles: ['Trizeps', 'Bauch'], equipment: 'Körpergewicht', type: 'compound', difficulty: 'beginner', description: 'Effektive Grundübung ohne Geräte.', execution: 'Körper gerade halten, Brust fast zum Boden, hochdrücken.', variants: ['dips'] },
  { id: 'chest-fly', name: 'Fliegende (Kurzhantel)', primaryMuscle: 'Brust', secondaryMuscles: ['Schultern'], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Isoliert die Brustmuskulatur über Dehnung und Kontraktion.', execution: 'Leicht gebeugte Arme seitlich öffnen und wieder zusammenführen.', variants: ['cable-fly'] },
  { id: 'cable-fly', name: 'Kabelzug-Fliegende', primaryMuscle: 'Brust', secondaryMuscles: ['Schultern'], equipment: 'Kabelzug', type: 'isolation', difficulty: 'intermediate', description: 'Konstante Spannung über die gesamte Bewegung.', execution: 'Kabel von beiden Seiten vor dem Körper zusammenführen.', variants: ['chest-fly'] },
  { id: 'dips', name: 'Dips', primaryMuscle: 'Brust', secondaryMuscles: ['Trizeps', 'Schultern'], equipment: 'Körpergewicht', type: 'compound', difficulty: 'intermediate', description: 'Starke Übung für untere Brust und Trizeps, Oberkörper leicht vorbeugen für mehr Brustfokus.', execution: 'Am Barren tief absenken, kontrolliert hochdrücken.', variants: ['push-up'] },

  // Rücken
  { id: 'deadlift', name: 'Kreuzheben', primaryMuscle: 'Rücken', secondaryMuscles: ['Beine', 'Bauch'], equipment: 'Langhantel', type: 'compound', difficulty: 'advanced', description: 'Eine der effektivsten Ganzkörper-Kraftübungen überhaupt.', execution: 'Rücken gerade, Stange nah am Körper vom Boden aufnehmen, Hüfte durchstrecken.', variants: ['romanian-deadlift', 'sumo-deadlift'] },
  { id: 'romanian-deadlift', name: 'Rumänisches Kreuzheben', primaryMuscle: 'Rücken', secondaryMuscles: ['Beine'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Fokus auf hintere Oberschenkel und unteren Rücken.', execution: 'Beine leicht gebeugt, Hüfte nach hinten schieben, Stange nah am Bein führen.', variants: ['deadlift'] },
  { id: 'sumo-deadlift', name: 'Sumo-Kreuzheben', primaryMuscle: 'Rücken', secondaryMuscles: ['Beine'], equipment: 'Langhantel', type: 'compound', difficulty: 'advanced', description: 'Breiter Stand, mehr Beinbeteiligung, kürzerer Weg.', execution: 'Füße breit, Griff innerhalb der Beine, Rücken gerade hochziehen.', variants: ['deadlift'] },
  { id: 'pull-up', name: 'Klimmzüge', primaryMuscle: 'Rücken', secondaryMuscles: ['Bizeps'], equipment: 'Körpergewicht', type: 'compound', difficulty: 'advanced', description: 'Königsübung für den breiten Rücken.', execution: 'Obergriff, Kinn über die Stange ziehen, kontrolliert absenken.', variants: ['chin-up', 'lat-pulldown'] },
  { id: 'chin-up', name: 'Kinnaufzüge', primaryMuscle: 'Rücken', secondaryMuscles: ['Bizeps'], equipment: 'Körpergewicht', type: 'compound', difficulty: 'intermediate', description: 'Untergriff-Variante, stärkere Bizepsbeteiligung.', execution: 'Untergriff schulterbreit, Kinn über die Stange ziehen.', variants: ['pull-up'] },
  { id: 'lat-pulldown', name: 'Latzug', primaryMuscle: 'Rücken', secondaryMuscles: ['Bizeps'], equipment: 'Maschine', type: 'compound', difficulty: 'beginner', description: 'Gute Klimmzug-Alternative mit einstellbarem Gewicht.', execution: 'Stange vor dem Körper zur oberen Brust ziehen, Schulterblätter zusammenziehen.', variants: ['pull-up'] },
  { id: 'barbell-row', name: 'Langhantelrudern', primaryMuscle: 'Rücken', secondaryMuscles: ['Bizeps'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Baut Dicke im mittleren Rücken auf.', execution: 'Oberkörper vorgebeugt, Stange zum Bauch ziehen, Rücken gerade halten.', variants: ['dumbbell-row', 'seated-cable-row'] },
  { id: 'dumbbell-row', name: 'Kurzhantelrudern', primaryMuscle: 'Rücken', secondaryMuscles: ['Bizeps'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'beginner', description: 'Einseitig, gut für Ausgleich von Dysbalancen.', execution: 'Knie und Hand auf Bank abstützen, Hantel zur Hüfte ziehen.', variants: ['barbell-row'] },
  { id: 'seated-cable-row', name: 'Sitzendes Kabelrudern', primaryMuscle: 'Rücken', secondaryMuscles: ['Bizeps'], equipment: 'Kabelzug', type: 'compound', difficulty: 'beginner', description: 'Kontrollierte Zugbewegung mit konstanter Spannung.', execution: 'Aufrecht sitzen, Griff zum Bauch ziehen, Schulterblätter zusammenführen.', variants: ['barbell-row'] },
  { id: 't-bar-row', name: 'T-Bar-Rudern', primaryMuscle: 'Rücken', secondaryMuscles: ['Bizeps'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Starke Übung für dicken mittleren Rücken.', execution: 'Vorgebeugt, Stange zum Oberkörper ziehen.', variants: ['barbell-row'] },
  { id: 'hyperextension', name: 'Rückenstrecker', primaryMuscle: 'Rücken', secondaryMuscles: ['Beine'], equipment: 'Maschine', type: 'isolation', difficulty: 'beginner', description: 'Kräftigt den unteren Rücken.', execution: 'Oberkörper aus der Hüfte absenken und wieder anheben.', variants: [] },
  { id: 'rowing-machine', name: 'Rudergerät', primaryMuscle: 'Rücken', secondaryMuscles: ['Beine'], equipment: 'Maschine', type: 'cardio', difficulty: 'beginner', description: 'Schonendes Ganzkörper-Cardiotraining mit Rückenfokus.', execution: 'Mit den Beinen starten, dann Arme zum Körper ziehen.', variants: [] },
  { id: 'farmers-walk', name: 'Farmers Walk', primaryMuscle: 'Rücken', secondaryMuscles: ['Unterarm', 'Beine'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'beginner', description: 'Baut Griffkraft und Rumpfstabilität auf.', execution: 'Schwere Gewichte aufrecht eine Strecke weit tragen.', variants: [] },

  // Beine
  { id: 'squat', name: 'Kniebeuge', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Die wichtigste Beinübung, trainiert nahezu den ganzen Körper mit.', execution: 'Stange auf dem oberen Rücken, in die Hocke gehen bis Oberschenkel parallel, hochdrücken.', variants: ['front-squat', 'goblet-squat', 'leg-press'] },
  { id: 'front-squat', name: 'Frontkniebeuge', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Langhantel', type: 'compound', difficulty: 'advanced', description: 'Mehr Quadrizeps-Fokus, aufrechtere Haltung.', execution: 'Stange vorne auf den Schultern, aufrecht in die Hocke gehen.', variants: ['squat'] },
  { id: 'goblet-squat', name: 'Goblet Squat', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'beginner', description: 'Einsteigerfreundliche Kniebeugen-Variante.', execution: 'Hantel vor der Brust halten, in die Hocke gehen.', variants: ['squat'] },
  { id: 'leg-press', name: 'Beinpresse', primaryMuscle: 'Beine', secondaryMuscles: [], equipment: 'Maschine', type: 'compound', difficulty: 'beginner', description: 'Sicher hohe Gewichte für die Beine bewegen.', execution: 'Füße schulterbreit auf der Platte, Beine beugen und strecken.', variants: ['squat'] },
  { id: 'lunges', name: 'Ausfallschritte', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'beginner', description: 'Trainiert Beine einseitig und die Balance.', execution: 'Großer Schritt nach vorne, Knie senken, zurückdrücken.', variants: ['bulgarian-split-squat', 'step-up'] },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'intermediate', description: 'Intensive einseitige Beinübung mit erhöhtem hinteren Fuß.', execution: 'Hinteren Fuß auf Bank ablegen, vorderes Bein beugen und strecken.', variants: ['lunges'] },
  { id: 'step-up', name: 'Step-ups', primaryMuscle: 'Beine', secondaryMuscles: [], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'beginner', description: 'Funktionelle Übung für Beine und Gesäß.', execution: 'Auf eine erhöhte Fläche steigen, kontrolliert zurück.', variants: ['lunges'] },
  { id: 'leg-extension', name: 'Beinstrecker', primaryMuscle: 'Beine', secondaryMuscles: [], equipment: 'Maschine', type: 'isolation', difficulty: 'beginner', description: 'Isoliert den Quadrizeps.', execution: 'Unterschenkel gegen das Polster strecken, langsam absenken.', variants: [] },
  { id: 'leg-curl', name: 'Beinbeuger', primaryMuscle: 'Beine', secondaryMuscles: [], equipment: 'Maschine', type: 'isolation', difficulty: 'beginner', description: 'Isoliert die hintere Oberschenkelmuskulatur.', execution: 'Fersen zum Gesäß ziehen, kontrolliert zurückführen.', variants: [] },
  { id: 'calf-raises', name: 'Wadenheben', primaryMuscle: 'Beine', secondaryMuscles: [], equipment: 'Maschine', type: 'isolation', difficulty: 'beginner', description: 'Trainiert die Wadenmuskulatur.', execution: 'Auf die Zehenspitzen heben, kurz halten, absenken.', variants: [] },
  { id: 'hip-thrust', name: 'Hip Thrust', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Eine der besten Übungen für die Gesäßmuskulatur.', execution: 'Oberer Rücken auf Bank, Hantel über der Hüfte, Hüfte nach oben drücken.', variants: [] },
  { id: 'good-morning', name: 'Good Mornings', primaryMuscle: 'Beine', secondaryMuscles: ['Rücken'], equipment: 'Langhantel', type: 'compound', difficulty: 'advanced', description: 'Kräftigt hintere Kette und unteren Rücken.', execution: 'Stange auf den Schultern, Oberkörper aus der Hüfte nach vorne beugen.', variants: ['romanian-deadlift'] },
  { id: 'adductor-machine', name: 'Adduktorenmaschine', primaryMuscle: 'Beine', secondaryMuscles: [], equipment: 'Maschine', type: 'isolation', difficulty: 'beginner', description: 'Trainiert die innere Oberschenkelmuskulatur.', execution: 'Beine gegen Widerstand zusammenführen.', variants: [] },
  { id: 'running', name: 'Laufen', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Keine', type: 'cardio', difficulty: 'beginner', description: 'Klassisches Ausdauertraining.', execution: 'Gleichmäßiges Lauftempo über die geplante Distanz/Zeit.', variants: [] },
  { id: 'jump-rope', name: 'Seilspringen', primaryMuscle: 'Beine', secondaryMuscles: ['Bauch'], equipment: 'Sonstiges', type: 'cardio', difficulty: 'beginner', description: 'Effizientes Koordinations- und Ausdauertraining.', execution: 'Gleichmäßig über das Seil springen.', variants: [] },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', primaryMuscle: 'Beine', secondaryMuscles: ['Rücken', 'Bauch'], equipment: 'Kettlebell', type: 'compound', difficulty: 'intermediate', description: 'Trainiert Hüftstreckung, Kraft und Ausdauer zugleich.', execution: 'Kettlebell aus der Hüfte heraus bis Schulterhöhe schwingen.', variants: [] },

  // Schultern
  { id: 'shoulder-press', name: 'Schulterdrücken', primaryMuscle: 'Schultern', secondaryMuscles: ['Trizeps'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Grundübung für kräftige, runde Schultern.', execution: 'Stange oder Hanteln über Kopf drücken, kontrolliert absenken.', variants: ['dumbbell-shoulder-press', 'arnold-press'] },
  { id: 'dumbbell-shoulder-press', name: 'Kurzhantel-Schulterdrücken', primaryMuscle: 'Schultern', secondaryMuscles: ['Trizeps'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'beginner', description: 'Größerer Bewegungsspielraum als mit der Langhantel.', execution: 'Hanteln auf Schulterhöhe starten, nach oben drücken.', variants: ['shoulder-press'] },
  { id: 'arnold-press', name: 'Arnold Press', primaryMuscle: 'Schultern', secondaryMuscles: ['Trizeps'], equipment: 'Kurzhanteln', type: 'compound', difficulty: 'intermediate', description: 'Rotation während der Bewegung trainiert alle Schulterköpfe.', execution: 'Mit Handflächen zum Körper starten, drehen und nach oben drücken.', variants: ['shoulder-press'] },
  { id: 'lateral-raise', name: 'Seitheben', primaryMuscle: 'Schultern', secondaryMuscles: [], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Formt die seitlichen Schultern.', execution: 'Arme seitlich bis Schulterhöhe anheben, langsam absenken.', variants: [] },
  { id: 'front-raise', name: 'Frontheben', primaryMuscle: 'Schultern', secondaryMuscles: [], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Trainiert die vordere Schulter.', execution: 'Arme nach vorne bis Schulterhöhe anheben.', variants: [] },
  { id: 'reverse-fly', name: 'Reverse Fly', primaryMuscle: 'Schultern', secondaryMuscles: ['Rücken'], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Kräftigt die hintere Schulter und obere Rückenpartie.', execution: 'Vorgebeugt Arme seitlich nach oben führen.', variants: ['face-pull'] },
  { id: 'face-pull', name: 'Face Pull', primaryMuscle: 'Schultern', secondaryMuscles: ['Rücken'], equipment: 'Kabelzug', type: 'isolation', difficulty: 'beginner', description: 'Wichtig für gesunde Schultern und Haltung.', execution: 'Seil zum Gesicht ziehen, Ellbogen hoch, Schulterblätter zusammen.', variants: ['reverse-fly'] },
  { id: 'upright-row', name: 'Aufrechtes Rudern', primaryMuscle: 'Schultern', secondaryMuscles: ['Rücken'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Trainiert seitliche Schulter und oberen Trapez.', execution: 'Stange eng greifen, nah am Körper bis Brusthöhe ziehen.', variants: [] },

  // Bizeps
  { id: 'biceps-curl', name: 'Bizepscurls', primaryMuscle: 'Bizeps', secondaryMuscles: [], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Klassische Übung für den Bizeps.', execution: 'Hanteln ohne Schwung zur Schulter curlen, langsam absenken.', variants: ['hammer-curl', 'barbell-curl'] },
  { id: 'barbell-curl', name: 'Langhantel-Curls', primaryMuscle: 'Bizeps', secondaryMuscles: [], equipment: 'Langhantel', type: 'isolation', difficulty: 'beginner', description: 'Erlaubt insgesamt schwerere Gewichte als Kurzhanteln.', execution: 'Stange schulterbreit greifen, kontrolliert curlen.', variants: ['biceps-curl'] },
  { id: 'hammer-curl', name: 'Hammercurls', primaryMuscle: 'Bizeps', secondaryMuscles: ['Unterarm'], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Neutraler Griff, trainiert zusätzlich den Unterarm.', execution: 'Hanteln im neutralen Griff curlen.', variants: ['biceps-curl'] },
  { id: 'preacher-curl', name: 'Preacher Curls', primaryMuscle: 'Bizeps', secondaryMuscles: [], equipment: 'Maschine', type: 'isolation', difficulty: 'intermediate', description: 'Schränkt Schwung komplett aus, isoliert den Bizeps stark.', execution: 'Arme auf der Schrägbank ablegen, curlen.', variants: ['biceps-curl'] },
  { id: 'concentration-curl', name: 'Konzentrationscurls', primaryMuscle: 'Bizeps', secondaryMuscles: [], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Sitzend, sehr fokussierte Kontraktion.', execution: 'Ellbogen am Oberschenkel abstützen, langsam curlen.', variants: ['biceps-curl'] },
  { id: 'cable-curl', name: 'Kabel-Curls', primaryMuscle: 'Bizeps', secondaryMuscles: [], equipment: 'Kabelzug', type: 'isolation', difficulty: 'beginner', description: 'Konstante Spannung über die gesamte Bewegung.', execution: 'Stange am Kabelzug zur Schulter curlen.', variants: ['biceps-curl'] },

  // Trizeps
  { id: 'triceps-pushdown', name: 'Trizepsdrücken am Kabel', primaryMuscle: 'Trizeps', secondaryMuscles: [], equipment: 'Kabelzug', type: 'isolation', difficulty: 'beginner', description: 'Effektive Grundübung für den Trizeps.', execution: 'Seil oder Stange nach unten drücken, Ellbogen am Körper fixiert.', variants: ['skull-crusher', 'close-grip-bench-press'] },
  { id: 'skull-crusher', name: 'Skull Crushers', primaryMuscle: 'Trizeps', secondaryMuscles: [], equipment: 'Langhantel', type: 'isolation', difficulty: 'intermediate', description: 'Starke Dehnung und Belastung des Trizeps.', execution: 'Liegend Stange zur Stirn absenken, zurückdrücken.', variants: ['triceps-pushdown'] },
  { id: 'close-grip-bench-press', name: 'Enges Bankdrücken', primaryMuscle: 'Trizeps', secondaryMuscles: ['Brust'], equipment: 'Langhantel', type: 'compound', difficulty: 'intermediate', description: 'Kombiniert Trizeps- und Brusttraining.', execution: 'Schulterbreiter Griff, Stange zur unteren Brust absenken.', variants: ['bench-press'] },
  { id: 'triceps-kickback', name: 'Kickbacks', primaryMuscle: 'Trizeps', secondaryMuscles: [], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Isolationsübung für den Trizeps.', execution: 'Vorgebeugt Arm nach hinten strecken.', variants: [] },
  { id: 'overhead-triceps-extension', name: 'Overhead Extension', primaryMuscle: 'Trizeps', secondaryMuscles: [], equipment: 'Kurzhanteln', type: 'isolation', difficulty: 'beginner', description: 'Dehnt den Trizeps stark, gut für den langen Kopf.', execution: 'Hantel hinter dem Kopf absenken, nach oben strecken.', variants: [] },

  // Bauch
  { id: 'plank', name: 'Plank', primaryMuscle: 'Bauch', secondaryMuscles: ['Rücken'], equipment: 'Körpergewicht', type: 'core', difficulty: 'beginner', description: 'Statische Übung für die gesamte Rumpfstabilität.', execution: 'Unterarmstütz, Körper in einer geraden Linie halten.', variants: [] },
  { id: 'crunches', name: 'Crunches', primaryMuscle: 'Bauch', secondaryMuscles: [], equipment: 'Körpergewicht', type: 'core', difficulty: 'beginner', description: 'Klassische Übung für die geraden Bauchmuskeln.', execution: 'Oberkörper einrollen, Schulterblätter vom Boden heben.', variants: ['cable-crunch'] },
  { id: 'leg-raise', name: 'Beinheben', primaryMuscle: 'Bauch', secondaryMuscles: [], equipment: 'Körpergewicht', type: 'core', difficulty: 'intermediate', description: 'Trainiert vor allem den unteren Bauch.', execution: 'Liegend oder hängend gestreckte Beine anheben.', variants: ['hanging-leg-raise'] },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', primaryMuscle: 'Bauch', secondaryMuscles: ['Rücken'], equipment: 'Körpergewicht', type: 'core', difficulty: 'advanced', description: 'Anspruchsvolle Variante des Beinhebens.', execution: 'An der Stange hängend Beine kontrolliert anheben.', variants: ['leg-raise'] },
  { id: 'russian-twist', name: 'Russian Twists', primaryMuscle: 'Bauch', secondaryMuscles: [], equipment: 'Körpergewicht', type: 'core', difficulty: 'beginner', description: 'Trainiert die schrägen Bauchmuskeln.', execution: 'Im Sitzen Oberkörper von Seite zu Seite drehen.', variants: [] },
  { id: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', primaryMuscle: 'Bauch', secondaryMuscles: ['Rücken'], equipment: 'Sonstiges', type: 'core', difficulty: 'advanced', description: 'Sehr intensive Übung für die gesamte Rumpfmuskulatur.', execution: 'Mit dem Rad nach vorne rollen, Rumpf stabil halten, zurückziehen.', variants: [] },
  { id: 'cable-crunch', name: 'Cable Crunch', primaryMuscle: 'Bauch', secondaryMuscles: [], equipment: 'Kabelzug', type: 'core', difficulty: 'intermediate', description: 'Ermöglicht progressive Belastung für den Bauch.', execution: 'Kniend Oberkörper gegen das Seil einrollen.', variants: ['crunches'] },
  { id: 'mountain-climbers', name: 'Mountain Climbers', primaryMuscle: 'Bauch', secondaryMuscles: ['Beine'], equipment: 'Körpergewicht', type: 'core', difficulty: 'beginner', description: 'Kombiniert Rumpfstabilität mit erhöhter Herzfrequenz.', execution: 'Im Liegestütz Knie abwechselnd zur Brust ziehen.', variants: [] },
  { id: 'burpees', name: 'Burpees', primaryMuscle: 'Bauch', secondaryMuscles: ['Beine', 'Brust'], equipment: 'Körpergewicht', type: 'cardio', difficulty: 'intermediate', description: 'Intensive Ganzkörperübung für Kraft und Ausdauer.', execution: 'In die Liegestützposition springen, Liegestütz, aufspringen.', variants: [] },
].map((e) => ({ secondaryMuscles: [], variants: [], custom: false, images: [], videoUrl: '', ...e }));

// EXERCISE_DB_IMPORT is defined in js/exerciseDb.js (876 exercises, public domain,
// source: https://github.com/yuhonas/free-exercise-db)
const EXERCISE_SEED = EXERCISE_SEED_CURATED.concat(
  (typeof EXERCISE_DB_IMPORT !== 'undefined' ? EXERCISE_DB_IMPORT : [])
    .map((e) => ({ secondaryMuscles: [], variants: [], custom: false, videoUrl: '', images: [], ...e }))
);

const Exercises = {
  _cache: null,

  async ensureSeeded() {
    const versionRow = await DB.get('settings', 'exerciseSeedVersion');
    const currentVersion = versionRow ? versionRow.value : 0;

    if (currentVersion < EXERCISE_SEED_VERSION) {
      const existing = await DB.getAll('exercises');
      const existingIds = new Set(existing.map((e) => e.id));
      for (const ex of EXERCISE_SEED) {
        if (!existingIds.has(ex.id)) await DB.put('exercises', ex);
      }
      await DB.put('settings', { key: 'exerciseSeedVersion', value: EXERCISE_SEED_VERSION });
      this._cache = await DB.getAll('exercises');
      return this._cache;
    }

    this._cache = await DB.getAll('exercises');
    return this._cache;
  },

  async all() {
    return this._cache || (await this.ensureSeeded());
  },

  async byId(id) {
    const all = await this.all();
    return all.find((e) => e.id === id);
  },

  invalidate() { this._cache = null; },

  youTubeEmbed(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  },
};

const ExercisesView = {
  query: '',
  muscle: 'all',
  RENDER_LIMIT: 60,

  async render() {
    const wrap = App.el('div');
    const all = await Exercises.all();

    const search = App.el('input', {
      type: 'text', placeholder: `${all.length} Übungen durchsuchen…`, value: this.query,
      oninput: (e) => { this.query = e.target.value; this.rerender(list, all); },
    });
    wrap.appendChild(App.el('div', { class: 'field' }, [search]));

    const muscleTabs = [{ key: 'all', label: 'Alle' }, ...MUSCLE_GROUPS.map((m) => ({ key: m, label: m }))];
    wrap.appendChild(App.tabBar(muscleTabs, this.muscle, (key) => { this.muscle = key; this.rerender(list, all); }));

    wrap.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-bottom:14px', onclick: () => this.openCustomEditor(all) }, [
      App.el('span', { html: Icons.plus(), style: 'width:16px;height:16px' }), 'Eigene Übung hinzufügen',
    ]));

    const list = App.el('div', { class: 'list' });
    wrap.appendChild(list);
    this.rerender(list, all);
    return wrap;
  },

  filtered(all) {
    const q = this.query.trim().toLowerCase();
    return all.filter((e) =>
      (this.muscle === 'all' || e.primaryMuscle === this.muscle) &&
      (!q || e.name.toLowerCase().includes(q))
    );
  },

  rerender(list, all) {
    list.innerHTML = '';
    const items = this.filtered(all);
    if (items.length === 0) {
      list.appendChild(App.el('div', { class: 'empty' }, [
        App.el('div', { class: 'empty-icon', html: Icons.fitness() }),
        'Keine Übungen gefunden.',
      ]));
      return;
    }
    const shown = items.slice(0, this.RENDER_LIMIT);
    shown.forEach((ex, i) => {
      const thumb = ex.images && ex.images[0]
        ? App.el('img', { src: ex.images[0], style: 'width:44px;height:44px;object-fit:cover;border-radius:10px;flex-shrink:0;background:var(--surface-2)' })
        : App.el('span', { html: Icons.fitness(), style: 'width:44px;height:44px;padding:10px;box-sizing:border-box;color:var(--text-dim);flex-shrink:0' });
      list.appendChild(App.el('div', { class: 'item', style: `cursor:pointer;animation-delay:${Math.min(i, 10) * 25}ms`, onclick: () => this.openDetail(ex) }, [
        thumb,
        App.el('div', { style: 'flex:1;min-width:0' }, [
          App.el('div', { class: 'item-title' }, ex.name),
          App.el('div', { class: 'item-meta' }, `${ex.primaryMuscle} · ${ex.equipment}`),
        ]),
        App.el('span', { class: 'pill' }, ex.difficulty === 'beginner' ? 'Einfach' : ex.difficulty === 'advanced' ? 'Fortgeschritten' : 'Mittel'),
      ]));
    });
    if (items.length > shown.length) {
      list.appendChild(App.el('div', { class: 'empty', style: 'padding:16px 10px' }, `${shown.length} von ${items.length} angezeigt — Suche verfeinern für mehr.`));
    }
  },

  openDetail(ex) {
    const mediaBox = App.el('div', { style: 'margin-bottom:14px' });
    if (ex.images && ex.images.length) {
      const row = App.el('div', { class: 'row', style: 'gap:8px;overflow-x:auto' });
      for (const src of ex.images) row.appendChild(App.el('img', { src, style: 'height:160px;border-radius:12px;flex-shrink:0' }));
      mediaBox.appendChild(row);
    }
    if (ex.mediaBlob) {
      const url = URL.createObjectURL(ex.mediaBlob);
      mediaBox.appendChild(ex.mediaType === 'video'
        ? App.el('video', { src: url, controls: true, style: 'width:100%;border-radius:12px;max-height:280px' })
        : App.el('img', { src: url, style: 'width:100%;border-radius:12px;max-height:280px;object-fit:cover' }));
    }
    if (ex.videoUrl) {
      const embed = Exercises.youTubeEmbed(ex.videoUrl);
      mediaBox.appendChild(embed
        ? App.el('div', { html: `<iframe src="${embed}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:12px" allowfullscreen></iframe>` })
        : App.el('a', { href: ex.videoUrl, target: '_blank', rel: 'noopener', class: 'btn secondary', style: 'display:flex' }, '▶ Video ansehen'));
    }

    const content = App.el('div', {}, [
      App.el('h3', {}, ex.name),
      mediaBox,
      App.el('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px;margin-bottom:14px' }, [
        App.el('span', { class: 'pill' }, ex.primaryMuscle),
        ...(ex.secondaryMuscles || []).map((m) => App.el('span', { class: 'pill' }, m)),
        App.el('span', { class: 'pill' }, ex.equipment),
      ]),
      ex.description && ex.description === ex.execution
        ? App.el('div', { class: 'field' }, [App.el('label', {}, 'Anleitung'), App.el('div', {}, ex.description)])
        : App.el('div', {}, [
            App.el('div', { class: 'field' }, [App.el('label', {}, 'Beschreibung'), App.el('div', {}, ex.description || '–')]),
            App.el('div', { class: 'field' }, [App.el('label', {}, 'Ausführung'), App.el('div', {}, ex.execution || '–')]),
          ]),
      App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Schließen'),
    ]);
    App.showModal(content);
  },

  openCustomEditor(all) {
    const nameInput = App.el('input', { type: 'text', placeholder: 'z.B. Kabelrudern eng' });
    const muscleSelect = App.el('select', {}, MUSCLE_GROUPS.map((m) => App.el('option', { value: m }, m)));
    const equipSelect = App.el('select', {}, ['Langhantel', 'Kurzhanteln', 'Maschine', 'Kabelzug', 'Körpergewicht', 'Kettlebell', 'Sonstiges'].map((e) => App.el('option', { value: e }, e)));
    const descInput = App.el('textarea', { placeholder: 'Kurze Beschreibung (optional)' });
    const videoUrlInput = App.el('input', { type: 'url', placeholder: 'z.B. YouTube-Link (optional)' });
    const fileInput = App.el('input', { type: 'file', accept: 'image/*,video/*' });
    const preview = App.el('div', { style: 'margin-top:8px' });
    let mediaFile = null;

    fileInput.addEventListener('change', () => {
      mediaFile = fileInput.files[0] || null;
      preview.innerHTML = '';
      if (!mediaFile) return;
      const url = URL.createObjectURL(mediaFile);
      preview.appendChild(mediaFile.type.startsWith('video')
        ? App.el('video', { src: url, controls: true, style: 'width:100%;border-radius:12px;max-height:200px' })
        : App.el('img', { src: url, style: 'width:100%;border-radius:12px;max-height:200px;object-fit:cover' }));
    });

    const content = App.el('div', {}, [
      App.el('h3', {}, 'Eigene Übung'),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Name'), nameInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Hauptmuskel'), muscleSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Equipment'), equipSelect]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Beschreibung'), descInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Video-Link (optional)'), videoUrlInput]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Foto oder Video hochladen (optional)'), fileInput, preview]),
      App.el('div', { class: 'row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', {
          class: 'btn', onclick: async () => {
            const name = nameInput.value.trim();
            if (!name) { nameInput.focus(); return; }
            const ex = {
              id: 'custom-' + DB.uid(), name, primaryMuscle: muscleSelect.value, secondaryMuscles: [],
              equipment: equipSelect.value, type: 'compound', difficulty: 'intermediate',
              description: descInput.value, execution: '', variants: [], custom: true,
              images: [], videoUrl: videoUrlInput.value.trim(),
              mediaBlob: mediaFile || null, mediaType: mediaFile ? (mediaFile.type.startsWith('video') ? 'video' : 'image') : null,
            };
            await DB.put('exercises', ex);
            Exercises.invalidate();
            App.closeModal();
            App.refresh();
          },
        }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    setTimeout(() => nameInput.focus(), 50);
  },
};
