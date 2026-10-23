import type { AbilityState } from '../types';

// Qué toca cada habilidad, por categoría de stat (clave del juego)
const CATS: { icon: string; label: string; re: RegExp }[] = [
  { icon: '⚔️', label: 'Ataque cuerpo a cuerpo', re: /melee_attack|bonus_vs/ },
  { icon: '🛡️', label: 'Defensa / armadura', re: /melee_defence|armour|missile_block|parry/ },
  { icon: '💥', label: 'Daño cuerpo a cuerpo', re: /melee_damage|charge_bonus|splash|damage_reflection/ },
  { icon: '🏹', label: 'Proyectiles', re: /missile|reloading|accuracy|range/ },
  // "Debilidad al fuego -20" = resistencia al fuego -20: va con las resistencias, en el mismo sentido
  { icon: '✨', label: 'Resistencias', re: /resistance|weakness/ },
  { icon: '🚩', label: 'Liderazgo', re: /morale/ },
  { icon: '👟', label: 'Velocidad / movimiento', re: /speed|acceleration|deceleration|turn|mass/ },
  { icon: '❤️', label: 'Curación', re: /healing/ },
  { icon: '🔮', label: 'Magia', re: /spell_mastery|miscast/ },
];
const TARGET = {
  allies: { icon: '👥', label: 'Afecta a aliados' },
  self: { icon: '👤', label: 'Solo a sí mismo' },
  enemies: { icon: '🎯', label: 'Afecta a enemigos' },
  none: { icon: '', label: '' },
} as const;

/** Iconos: a quién afecta y qué stats sube (verde) o baja (rojo). Pasa el ratón para ver el detalle. */
export function AbilityIcons({ a }: { a: AbilityState }) {
  const groups = new Map<string, { icon: string; label: string; up: number; down: number; lines: string[] }>();
  (a.effects ?? []).forEach((e, i) => {
    const c = CATS.find((x) => x.re.test(e.stat));
    if (!c) return;
    const up = e.how === 'mult' ? e.v > 1 : e.v > 0;
    const g = groups.get(c.label) ?? { icon: c.icon, label: c.label, up: 0, down: 0, lines: [] };
    if (up) g.up++; else g.down++;
    g.lines.push(a.stats[i] ?? e.stat);
    groups.set(c.label, g);
  });
  const t = TARGET[a.mode];
  return (
    <span className="ab-icons">
      {t.icon && <span className={`ab-target ${a.mode}`} title={t.label}>{t.icon}</span>}
      {[...groups.values()].map((g) => (
        <span key={g.label} className={'ab-stat ' + (g.down && !g.up ? 'down' : g.up && !g.down ? 'up' : 'mixed')} title={`${g.label}:\n${g.lines.join('\n')}`}>
          {g.icon}{g.down && !g.up ? '▼' : g.up && !g.down ? '▲' : '◆'}
        </span>
      ))}
      {a.flaming && <span className="ab-stat up" title="Ataques flamígeros">🔥</span>}
      {a.magical && <span className="ab-stat up" title="Ataques mágicos">✦</span>}
      {a.attributes.length > 0 && <span className="ab-stat up" title={`Atributos:\n${a.attributes.join('\n')}`}>🏷️</span>}
    </span>
  );
}
