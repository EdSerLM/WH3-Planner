import { useState } from 'react';
import type { SkillNode } from '../types';

/**
 * Icono de la habilidad. Busca la imagen del juego en frontend/public/skills/<icon>.png
 * (extraída con RPFM de "ui/campaign ui/skills"). Si no existe, muestra un símbolo por tipo.
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
  const [failed, setFailed] = useState(!node.icon || missing.has(node.icon));
  const cat = node.category ?? 'combat';
  if (failed || !node.icon) {
    return (
      <span className={'skill-icon glyph ' + cat} style={{ width: size, height: size, fontSize: size * 0.5 }}>
        {GLYPH[cat] ?? '•'}
      </span>
    );
  }
  return (
    <img
      className="skill-icon"
      src={`/skills/${node.icon.toLowerCase()}.png`}
      width={size}
      height={size}
      alt=""
      onError={() => {
        missing.add(node.icon!);
        setFailed(true);
      }}
    />
  );
}
