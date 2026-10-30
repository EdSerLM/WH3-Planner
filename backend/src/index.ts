import express from 'express';
import cors from 'cors';
import { sources } from './data.js';
import { handle, HttpError } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT ?? 3001);

// Todas las rutas /api/... las resuelve routes.ts (el mismo código que usa la web estática del celular)
app.all('/api/*', (req, res) => {
  try {
    res.json(handle(req.method, req.path, req.query as Record<string, string>, req.body));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    res.status(status).json({ error: (e as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`WH3 Planner API escuchando en http://localhost:${PORT}`);
  console.log(`Datos: ${sources.skills} | ${sources.units}`);
  console.log(sources.gameTrees ? `Árboles de todas las facciones (datos de tu juego): ${sources.gameTrees}` : 'Árboles: solo Guerreros del Caos (corre npm run extraer para todas las facciones)');
  console.log(sources.allUnits ? `Unidades de todas las facciones: ${sources.allUnits}` : 'Sin unidades de otras facciones (corre npm run extraer)');
  console.log(sources.officialLoc ? `Textos oficiales en español: ${sources.officialLoc}` : "Sin textos oficiales (backend/data/loc-es): se usa el glosario propio");
});
