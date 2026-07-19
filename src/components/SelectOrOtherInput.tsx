import { useState } from 'react';

interface Props {
  value: string | null | undefined;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * A dropdown of known/common values with an escape hatch for the case that
 * doesn't fit the list â€” used everywhere a field is "usually one of these
 * things" but can't be a strictly closed set (diagnoses, procedure names,
 * insurance schemes, etc). Prefer this over a plain text input wherever a
 * common-values list exists, since it cuts typing to zero for the vast
 * majority of entries while never blocking the genuinely unusual case.
 */
export function SelectOrOtherInput({ value, options, onChange, placeholder }: Props) {
  const isKnownOrEmpty = !value || options.includes(value);
  const [manualMode, setManualMode] = useState(!isKnownOrEmpty);

  if (manualMode) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          className="input"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn btn-ghost" style={{ flex: 'none' }} onClick={() => { setManualMode(false); onChange(''); }}>
          Choose from list
        </button>
      </div>
    );
  }

  return (
    <select
      className="input"
      value={isKnownOrEmpty ? (value ?? '') : ''}
      onChange={(e) => {
        if (e.target.value === '__other__') {
          setManualMode(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="">â€”</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__other__">Other (type manually)</option>
    </select>
  );
}