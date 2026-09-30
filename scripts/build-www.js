// Kopiert die Web-App nach www/ (ohne node_modules, .git, native Projekte), damit Capacitor nur das Nötige bündelt.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const include = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of include) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
console.log('www/ bereit:', include.join(', '));
