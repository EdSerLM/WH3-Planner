import { useState } from 'react';
import type { SkillNode } from '../types';

/**
 * Icono de la habilidad. Los hechizos usan el icono de su habilidad de batalla (frontend/public/abilities),
 * porque en el juego muchos traen la imagen del Saber de las Fauces; el resto, la imagen del juego en
 * frontend/public/skills/<icon>.png (extraída de "ui/campaign ui/skills"). Si no existe, un símbolo por tipo.
 */
const GLYPH: Record<string, string> = {
  mount: '🐎',
  magic: '✦',
  actions: '🗡',
  army: '⚑',
  combat: '⚔',
  campaign: '♜',
};

const missing = new Set<string>();

export function SkillIcon({ node, size = 34 }: { node: SkillNode; size?: number }) {
  const candidates = [
    node.abilityIcon ? `/abilities/${node.abilityIcon.toLowerCase()}.png` : null,
    node.icon ? `/skills/${node.icon.toLowerCase()}.png` : null,
  ].filter((s): s is string => !!s && !missing.has(s));
  const [failed, setFailed] = useState<string[]>([]);
  const src = candidates.find((s) => !failed.includes(s));
  const cat = node.category ?? 'combat';
  if (!src) {
    return (
      <span className={'skill-icon glyph ' + cat} style={{ width: size, height: size, fontSize: size * 0.5 }}>
        {GLYPH[cat] ?? '•'}
      </span>
    );
  }
  return (
    <img
      className="skill-icon"
      src={src}
      width={size}
      height={size}
      alt=""
      onError={() => {
        missing.add(src);
        setFailed((f) => [...f, src]);
      }}
    />
  );
}
