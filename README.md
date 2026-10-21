# WH3 Planner · Guerreros del Caos (MVP)

Planner de **Total War: Warhammer III** que junta en un solo lugar:

- **Árboles de habilidades** de los 66 señores y héroes de Guerreros del Caos (legendarios y genéricos).
- **Tarjetas de unidad que se recalculan en vivo**: cada punto que subes al señor o a un héroe actualiza las stats de las tropas, con el desglose de qué habilidad aporta cada número.
- **Habilidades y hechizos** que se encienden o apagan (Stand or Die!, Flaming Sword…), auras y bufos de rango 7+.
- **DPS en melee** con la fórmula del proyecto, contra varias unidades a la vez.
- **Guardado de ejércitos** en el backend.

## Requisitos

- Node.js 20 o superior (`node -v`).

## Cómo correrlo

```bash
cd WH3-Planner
npm install        # instala backend y frontend (workspaces)
npm run dev        # levanta los dos: API en :3001 y web en :5173
```

Abre <http://localhost:5173>.

Para levantar cada uno por separado: `npm run dev:back` y `npm run dev:front`.
Prueba del motor de bufos (reproduce un build real y compara números): `npm test`.

## Estructura

```
WH3-Planner/
├─ backend/                 Node + Express + TypeScript (puerto 3001)
│  ├─ data/raw/             datos extraídos (JSON)
│  │   ├─ wh3_chs_skills.json   árboles, habilidades y hechizos (totalwarhammerplanner.com, parche 9.0.3)
│  │   └─ wh3_chs_units.json    stats de 176 unidades (twwstats.com, parche 9.0.5)
│  ├─ data/nombres-es.json  nombres en español opcionales (clave = unit card)
│  ├─ data/builds.json      ejércitos guardados (se crea solo)
│  └─ src/
│     ├─ data.ts            carga y normaliza los datos
│     ├─ effects.ts         convierte el texto de cada efecto en stat + valor + a quién aplica
│     ├─ engine.ts          motor: builds → bufos sobre cada tarjeta
│     ├─ dps.ts             fórmula de DPS melee
│     ├─ builds.ts          guardado de ejércitos
│     ├─ index.ts           API REST
│     └─ selftest.ts        prueba con un build real
└─ frontend/                React + Vite + TypeScript (puerto 5173, /api va al backend)
   └─ src/components/       SkillTree, ArmyPanel, AbilitiesPanel, UnitCard, DpsPanel…
```

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/characters` | Lista de señores y héroes |
| GET | `/api/characters/:key` | Árbol completo de un personaje (con info de sus hechizos) |
| GET | `/api/units` | Roster con stats base |
| POST | `/api/compute` | `{ lord, heroes, units, activeAbilities, inAura }` → tarjetas con bufos y desglose |
| POST | `/api/dps` | `{ army, attacker, targets[] }` → tabla de DPS |
| GET/POST/DELETE | `/api/builds` | Ejércitos guardados |

## Cómo se calculan los bufos

- Cada efecto del árbol trae su **lista exacta de unidades** a las que aplica (del planner). Por eso "no demoníaco", "Forsaken, Chaos Spawn…" o "rango 7+" se respetan sin adivinar.
- En el juego, cada nivel de una habilidad ya trae el **total** (Chaos Vanguard 3/3 = +8 ataque, +12 armadura), no se suman los niveles.
- "Fuerza del arma +X%" multiplica daño base **y** perforante.
- Las **resistencias** no se apilan entre tipos: el DPS usa la más alta que aplique (física, fuego si el ataque es flamígero, mágica si es mágico, o salvación). Tope 90%.
- **Rasgo innato:** cada personaje del Caos recibe uno al azar del pool (Iron Skin, Burning Body…); los legendarios traen el suyo fijo. Elígelo en el árbol.

## Rango e iconos

- **Rango del personaje** (barra arriba del árbol): lo que el juego da solo por rango (monturas, Immortality, Soldiers of Renown, niveles de Rule of Chaos…) se activa solo y en verde, sin gastar puntos. Lo que pide rango (Skullcrusher R10, Chaos Marked R16, Mentor R30…) queda bloqueado hasta llegar. Puntos disponibles: 1 por rango (aprox.).
- **Iconos**: el planner busca los iconos del juego en `frontend/public/skills/<nombre>.png`. Sácalos con RPFM (ver `frontend/public/skills/LEEME.txt`). Sin ellos se muestra un símbolo por tipo (⚔ combate, ✦ magia, ⚑ ejército, ♜ campaña, 🐎 montura, 🗡 acciones).

## Limitaciones conocidas (MVP)

- Solo **Guerreros del Caos**. Los objetivos del DPS son unidades de ese roster.
- **Idioma:** los efectos, etiquetas, alcances, atributos y tipos de personaje salen en español con un glosario propio (`backend/src/i18n.ts`: "Melee defence" → "Defensa cuerpo a cuerpo", etc.). Los **nombres propios** (habilidades, hechizos, unidades) quedan en inglés hasta que pongas los textos oficiales del juego en `backend/data/loc-es/` (ver el LEEME de esa carpeta). Con ellos se usan los nombres y las frases oficiales. `nombres-es.json` sirve para corregir nombres a mano.
- **Habilidades excluyentes**: no vienen en los datos del planner, así que se definen a mano en `backend/data/exclusivas.json` (grupos por clave de habilidad, "elige N de estas"). Ya están las dos filas del Héroe Exaltado (Gladiator/Commander/Strategist y Wrath/Leadership/Unity), que también cubren a los Exaltados de cada dios, Khargan, Harald y los Hechiceros. Si encuentras otro par bloqueado en el juego, agrégalo ahí: la clave aparece en el detalle de cada nodo.
- El rango mínimo es aproximado (1 punto por rango).
- No se modelan la experiencia por rango de las unidades, objetos, tecnologías ni la autoridad del Caos.
- El DPS no cuenta carga, splash, colisiones, que no todos los modelos peleen a la vez, ni liderazgo/huida. Subestima a monstruos y carros.

## Siguiente paso: datos propios con RPFM

Para todas las facciones y nombres en español, exporta desde RPFM (`data.pack` y `local_sp.pack`) las tablas:
`character_skill_node_sets`, `character_skill_nodes`, `character_skill_node_links`, `character_skills`, `character_skill_level_to_effects_junctions`, `effects`, `effect_bonus_value_*`, `unit_abilities`, `special_ability_phases`, `special_ability_phase_stat_effects`, `main_units`, `land_units`, `melee_weapons`, `missile_weapons`, `projectiles`, `battle_entities`, más los `.loc` en español.
El motor (`effects.ts` / `engine.ts`) no cambia; solo hay que escribir un convertidor nuevo hacia el formato de `data/raw`.
