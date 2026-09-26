// genera-manifest.js
// Esegui con: node genera-manifest.js
const fs = require('fs');
const path = require('path');

const BOOKS_DIR = path.join(__dirname, 'Libri');

if (!fs.existsSync(BOOKS_DIR)) {
    console.error('❌ Cartella "Libri" non trovata!');
    process.exit(1);
}

const files = fs.readdirSync(BOOKS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

if (files.length === 0) {
    console.warn('⚠️ Nessun file .json trovato nella cartella Libri/');
    process.exit(0);
}

const manifest = { libri: files };

fs.writeFileSync(
    path.join(BOOKS_DIR, 'index.json'),
    JSON.stringify(manifest, null, 2)
);

console.log(`✅ Manifest generato: ${files.length} libri`);
files.forEach((f, i) => console.log(`   ${String(i + 1).padStart(2, '0')}. ${f}`));