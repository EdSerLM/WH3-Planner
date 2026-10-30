// Después de "vite build --mode static": copia los datos del juego a dist/data y escribe la lista de cartas de unidad.
// Así la web funciona sin servidor (GitHub Pages) y el backend corre en el navegador.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const data = join(root, '..', 'backend', 'data');
const out = join(dist, 'data');
mkdirSync(out, { recursive: true });

const files = [
  ['raw/wh3_all_skills.json', true], ['raw/wh3_all_units.json', true], ['raw/wh3_skill_locks.json', false],
  ['nombres-es.json', false], ['exclusivas.json', false], ['loc-es/wh3_es.tsv', false],
];
let total = 0;
for (const [f, required] of files) {
  const src = join(data, f);
  if (!existsSync(src)) {
    if (required) throw new Error(`Falta ${src}: corre npm run extraer y sube los datos`);
    continue;
  }
  copyFileSync(src, join(out, f.split('/').pop()));
  total += statSync(src).size;
}
const unitsDir = join(root, 'public', 'units');
const cards = existsSync(unitsDir) ? readdirSync(unitsDir).filter((f) => /\.png$/i.test(f)).map((f) => f.slice(0, -4).toLowerCase()) : [];
mkdirSync(join(dist, 'units'), { recursive: true });
writeFileSync(join(dist, 'units', 'index.json'), JSON.stringify(cards));
// Versión de los datos: el service worker la usa para saber cuándo volver a descargarlos
writeFileSync(join(dist, 'data', 'version.txt'), String(Date.now()));
console.log(`Datos para la web estática: ${(total / 1e6).toFixed(1)} MB, ${cards.length} cartas de unidad`);
