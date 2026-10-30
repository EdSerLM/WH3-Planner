import { useMemo, useState } from 'react';
import type { BuildSelection, CharacterTree, InitiativeSet } from '../types';

/**
 * Gloria demoníaca (Legión del Caos de Daniel) con el aspecto de la pantalla del juego: una fila por dios con su
 * gloria, la barra con las ofrendas y unidades en su umbral, y debajo los dones (piezas) que se desbloquean.
 * Al mover la gloria se elige la ofrenda más alta alcanzada (sus efectos, acumulados, entran en la tarjeta).
 */

const GODS: Record<string, { icon: string; color: string; name: string }> = {
  undivided: { icon: '✴️', color: '#d9a441', name: 'Caos Absoluto' },
  khorne: { icon: '🩸', color: '#c0392b', name: 'Khorne' },
  nurgle: { icon: '🪰', color: '#7fae3a', name: 'Nurgle' },
  slaanesh: { icon: '💜', color: '#c46fc9', name: 'Slaanesh' },
  tzeentch: { icon: '🔷', color: '#3f8fd6', name: 'Tzeentch' },
};
const ORDER = ['undivided', 'khorne', 'nurgle', 'slaanesh', 'tzeentch'];
const PX = 0.5; // píxeles por punto de gloria en la barra
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };

interface Props {
  tree: CharacterTree;
  sets: InitiativeSet[];
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
}

export function GloryPanel({ tree, sets, selection, onChange }: Props) {
  const items = selection.items ?? [];
  const ordered = [...sets].sort((a, b) => ORDER.indexOf(a.god ?? '') - ORDER.indexOf(b.god ?? ''));
  const maxTop = Math.max(...sets.map((s) => s.top ?? 0), 1);
  const width = Math.round(maxTop * PX) + 60;
  const armory = useMemo(() => new Map((tree.armory?.items ?? []).map((i) => [i.key, i])), [tree.armory]);

  // Gloria de cada dios: la del umbral de la ofrenda elegida (o la que movió el usuario en esta sesión)
  const fromSel = (s: InitiativeSet) => {
    const k = s.items.find((i) => items.includes(i.key))?.key;
    return k ? Number(k.split(':').pop()) : 0;
  };
  const [manual, setManual] = useState<Record<string, number>>({});
  const valueOf = (s: InitiativeSet) => manual[s.key] ?? fromSel(s);

  const setValue = (s: InitiativeSet, v: number) => {
    const val = Math.max(0, Math.min(s.top ?? 0, Math.round(v)));
    setManual((m) => ({ ...m, [s.key]: val }));
    const best = [...s.items].filter((i) => Number(i.key.split(':').pop()) <= val).pop();
    const mine = new Set(s.items.map((i) => i.key));
    const next = items.filter((k) => !mine.has(k));
    if (best) next.push(best.key);
    onChange({ ...selection, items: next });
  };

  return (
    <div className="glory">
      <div className="glory-title">Gloria Demoníaca</div>
      <p className="muted small">
        Mueve la gloria de cada dios (o haz clic en un umbral). Se aplica la ofrenda más alta alcanzada con las anteriores; son efectos de
        facción, así que elígelos en el señor. Las unidades y dones que pasan el umbral salen desbloqueados.
      </p>
      <div className="glory-scroll">
        {ordered.map((s) => {
          const g = GODS[s.god ?? ''] ?? { icon: '✦', color: '#999', name: s.name };
          const val = valueOf(s);
          const track = s.track ?? [];
          const offerings = track.filter((t) => t.kind === 'offering');
          const units = track.filter((t) => t.kind === 'unit');
          const gifts = track.filter((t) => t.kind === 'gift');
          const cur = [...offerings].filter((o) => o.at <= val).pop();
          return (
            <div key={s.key} className="glory-row" style={{ ['--god' as string]: g.color }}>
              <div className="glory-god">
                <span className="glory-emblem" title={g.name}>{g.icon}</span>
                <input
                  type="number" min={0} max={s.top} step={10} value={val}
                  onChange={(e) => setValue(s, Number(e.target.value))}
                  title={`Gloria de ${g.name} (máx. ${s.top})`}
                />
                <span className="glory-cur small" title={cur?.n}>{cur ? `Ofrenda ${ROMAN[offerings.indexOf(cur)] ?? offerings.indexOf(cur) + 1}` : 'Sin ofrenda'}</span>
              </div>
              <div className="glory-lane" style={{ width }}>
                <div className="glory-bar">
                  <div className="glory-fill" style={{ width: Math.round(val * PX) }} />
                  <input
                    className="glory-range" type="range" min={0} max={s.top} step={10} value={val}
                    style={{ width: Math.round((s.top ?? 0) * PX) }}
                    onChange={(e) => setValue(s, Number(e.target.value))}
                  />
                  {units.map((u, i) => (
                    <button
                      key={`u${i}`} className={'glory-mark unit' + (u.at <= val ? ' on' : '')} style={{ left: Math.round(u.at * PX) }}
                      title={`${u.n ?? u.key} · ${u.at} de gloria`} onClick={() => setValue(s, u.at)}
                    >
                      {u.art ? <img src={`/units/${u.art}.png`} alt="" onError={hide} /> : '⚔'}
                    </button>
                  ))}
                  {offerings.map((o, i) => (
                    <button
                      key={`o${i}`} className={'glory-mark offering' + (o.at <= val ? ' on' : '')} style={{ left: Math.round(o.at * PX) }}
                      title={`${o.n} · ${o.at} de gloria`} onClick={() => setValue(s, o.at)}
                    >
                      {o.icon ? <img src={`/bundles/${o.icon}.png`} alt="" onError={hide} /> : null}
                      <span>{ROMAN[i] ?? i + 1}</span>
                    </button>
                  ))}
                </div>
                <div className="glory-gifts">
                  {gifts.map((t, i) => {
                    const it = armory.get(t.key);
                    const open = t.at <= val;
                    return (
                      <button
                        key={i} className={'glory-gift' + (open ? ' on' : '')} onClick={() => setValue(s, t.at)}
                        title={`${it?.name ?? t.key}${it?.slot ? ` (${tree.armory?.slots.find((x) => x.key === it.slot)?.name ?? it.slot})` : ''}\n${t.at} de gloria`}
                      >
                        <img src={`/armory/${t.key}.png`} alt="" onError={hide} />
                        <span className="glory-gift-name">{it?.name ?? t.key.replace(/^wh3_main_dae_cha_daemon_prince_/, '').replace(/_/g, ' ')}</span>
                        {!open && <span className="glory-lock">🔒</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {ordered.map((s) => {
        const cur = s.items.find((i) => items.includes(i.key));
        return cur ? (
          <div key={s.key} className="glory-effects">
            <b>{GODS[s.god ?? '']?.icon} {cur.name}</b>
            <ul className="aslot-eff">{cur.effects.map((e) => e.text).filter(Boolean).map((t, j) => <li key={j}>{t}</li>)}</ul>
          </div>
        ) : null;
      })}
    </div>
  );
}
