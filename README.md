# WH3 Planner (MVP)

Planner de **Total War: Warhammer III** que junta en un solo lugar:

- **Árboles de habilidades de las 25 facciones** (561 señores y héroes, legendarios y genéricos) sacados de tu instalación del juego. Sin extraer tus datos, solo Guerreros del Caos (datos del planner).
- **Tecnologías** (pestaña junto a Señor/Héroe): el árbol de tecnologías de tu facción (y los propios de Azazel, Be'lakor, Nakai…). Clic investiga (con sus requisitos), clic derecho quita, botón "+ Todas las de batalla". Sus bufos se suman a las tarjetas y aparecen como "Tecnologías" en el desglose.
- **Objetos de los legendarios** (señores y héroes): los de su misión y los exclusivos (Matarreyes, Ghal Maraz…), con su bonificación de conjunto. Se equipan con un clic; si la misión pide rango, el rango sube.
- **Montura**: el selector muestra todas las monturas del personaje; elegir una la compra en el árbol (y sube el rango si la pide).
- **Selector de facción** arriba: cambia los personajes, el roster del ejército y el roster propio del DPS. Cada facción guarda su ejército en el navegador.
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

## Datos de tu juego (iconos, español oficial, bloqueos)

Con el juego instalado, corre una vez (solo lee los .pack, no modifica nada del juego):

```bash
npm run extraer -- "D:\Program Files\Steam\steamapps\common\Total War WARHAMMER III\data"
```

Genera:
- `frontend/public/skills/*.png`: iconos de habilidades (de `ui.pack` / `ui2.pack`).
- `backend/data/loc-es/wh3_es.tsv`: nombres y textos **oficiales en español** (de `local_sp.pack`: "Vanguardia del Caos", "Espada Ígnea de Rhuin", "Malditos del Caos", "Paladín del Caos"…).
- `backend/data/raw/wh3_skill_locks.json`: **habilidades excluyentes oficiales** (de `db.pack`, tabla `character_skill_nodes_skill_locks`).
- `backend/data/raw/wh3_all_skills.json`: **árboles de habilidades de las 25 facciones** (`backend/scripts/arboles.ts`): nodos, requisitos, rangos (el juego los guarda desde 0; aquí empiezan en 1), efectos ya separados por stat y por lista exacta de unidades (`unit_sets`), hechizos y habilidades, monturas con sus stats (habilidad → ancillary → unidad montada) y bloqueos. Validado contra el planner con los 66 personajes del Caos: mismos nodos, rangos, efectos y stats de montura; el `npm test` pasa igual con estos datos.
- `backend/data/raw/wh3_all_units.json`: **unidades de las 25 facciones** (2,300+, con nombres oficiales en español) para usarlas como objetivos en el DPS. Se calculan desde las tablas `main_units`, `land_units`, armas, entidades, etc. de `db.pack`; verificado contra twwstats con las 176 unidades del Caos (todas las stats iguales).

Las tablas de `db.pack` se leen con el esquema de [RPFM](https://github.com/Frodo45127/rpfm-schemas) (licencia MIT); en `backend/data/schema/wh3_db_subset.json` están solo las que usa el planner. Si un parche cambia una tabla y el script avisa que "el esquema no coincide", hay que actualizar ese archivo.

Vuelve a correrlo después de cada parche. Los iconos y textos del juego no se suben a git (`.gitignore`).

## Rango e iconos

- **Rango del personaje** (como el planner original): empieza en **rango 1** y **sube solo** al comprar (1 punto por rango, o el rango que pida la habilidad, p. ej. Skullcrusher → 10). Al subir se activan en verde, sin gastar puntos, las habilidades que el juego da por rango (monturas, Immortality, Soldiers of Renown…). Clic en una de esas sube el rango hasta donde se desbloquea. La barra fija un rango mínimo; bajarla quita lo que ya no cabe.
- **Iconos**: el planner busca los iconos del juego en `frontend/public/skills/<nombre>.png`. Sácalos con RPFM (ver `frontend/public/skills/LEEME.txt`). Sin ellos se muestra un símbolo por tipo (⚔ combate, ✦ magia, ⚑ ejército, ♜ campaña, 🐎 montura, 🗡 acciones).

## Limitaciones conocidas (MVP)

- Árboles: se arman para **Imperios Inmortales** (los nodos solo de El Reino del Caos no salen) y sin los nodos exclusivos de una facción concreta (p. ej. los de Festus cuando lo recluta Archaón). Los rasgos innatos de facción sí aparecen en el selector.
- Algunos personajes salen en la facción de su dios (Bloodspeaker, Skarr, Karanak → Khorne; Ezar, Khargan, Plagueridden → Nurgle), no en Guerreros del Caos: así los da el juego.
- Las habilidades que una habilidad da a ciertas tropas (p. ej. "Cólera de la tormenta" a los Ogros Dragón) salen como atributo de esas unidades, no como interruptor.
- Los objetivos del DPS van sin bufos.
- **Idioma:** los efectos, etiquetas, alcances, atributos y tipos de personaje salen en español con un glosario propio (`backend/src/i18n.ts`: "Melee defence" → "Defensa cuerpo a cuerpo", etc.). Los **nombres propios** (habilidades, hechizos, unidades) quedan en inglés hasta que pongas los textos oficiales del juego en `backend/data/loc-es/` (ver el LEEME de esa carpeta). Con ellos se usan los nombres y las frases oficiales. `nombres-es.json` sirve para corregir nombres a mano.
- **Habilidades excluyentes**: salen del juego (`character_skill_nodes_skill_locks`). Si algo faltara, `backend/data/exclusivas.json` permite agregar grupos a mano (grupos por clave de habilidad, "elige N de estas"). Ya están las dos filas del Héroe Exaltado (Gladiator/Commander/Strategist y Wrath/Leadership/Unity), que también cubren a los Exaltados de cada dios, Khargan, Harald y los Hechiceros. Si encuentras otro par bloqueado en el juego, agrégalo ahí: la clave aparece en el detalle de cada nodo.
- El rango mínimo es aproximado (1 punto por rango).
- No se modelan la experiencia por rango de las unidades, objetos, tecnologías ni la autoridad del Caos.
- El DPS no cuenta carga, splash, colisiones, que no todos los modelos peleen a la vez, ni liderazgo/huida. Subestima a monstruos y carros.

## Datos propios con RPFM (referencia)

Para todas las facciones y nombres en español, exporta desde RPFM (`data.pack` y `local_sp.pack`) las tablas:
`character_skill_node_sets`, `character_skill_nodes`, `character_skill_node_links`, `character_skills`, `character_skill_level_to_effects_junctions`, `effects`, `effect_bonus_value_*`, `unit_abilities`, `special_ability_phases`, `special_ability_phase_stat_effects`, `main_units`, `land_units`, `melee_weapons`, `missile_weapons`, `projectiles`, `battle_entities`, más los `.loc` en español.
El motor (`effects.ts` / `engine.ts`) no cambia; solo hay que escribir un convertidor nuevo hacia el formato de `data/raw`.
