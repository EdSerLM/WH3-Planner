import type { CharacterSummary } from '../types';

interface Props {
  characters: CharacterSummary[];
  type: 'lord' | 'hero';
  value: string | null;
  onChange: (key: string) => void;
}

export function CharacterPicker({ characters, type, value, onChange }: Props) {
  const list = characters.filter((c) => c.type === type);
  const legendary = list.filter((c) => c.legendary);
  const generic = list.filter((c) => !c.legendary);
  return (
    <select className="picker" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {type === 'lord' ? 'Elige un señor…' : 'Elige un héroe…'}
      </option>
      <optgroup label={type === 'lord' ? 'Señores legendarios' : 'Héroes legendarios'}>
        {legendary.map((c) => (
          <option key={c.key} value={c.key}>{c.name}</option>
        ))}
      </optgroup>
      <optgroup label={type === 'lord' ? 'Señores genéricos' : 'Héroes genéricos'}>
        {generic.map((c) => (
          <option key={c.key} value={c.key}>{c.name}</option>
        ))}
      </optgroup>
    </select>
  );
}
