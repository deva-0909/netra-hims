import type { FieldConfig } from '../modules/fieldTypes';
import { FileUploadField } from './FileUploadField';
import { SelectOrOtherInput } from './SelectOrOtherInput';
import { DbSelectOrOtherInput } from './DbSelectOrOtherInput';

interface Props {
  field: FieldConfig;
  value: any;
  onChange: (name: string, value: any) => void;
  folder?: string; // storage namespace, defaults to field name
}

export function FieldInput({ field, value, onChange, folder }: Props) {
  const common = {
    id: field.name,
    className: 'input',
  };

  if (field.type === 'static_text') {
    return (
      <div className="card" style={{ padding: 'var(--space-3)', background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {field.content}
      </div>
    );
  }

  if (field.type === 'file') {
    return (
      <FileUploadField
        value={value}
        onChange={(url) => onChange(field.name, url)}
        folder={folder ?? field.name}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        {...common}
        placeholder={field.placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        {...common}
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="">—</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'db_select_or_other') {
    return (
      <DbSelectOrOtherInput
        value={value}
        dbTable={field.dbTable!}
        dbColumn={field.dbColumn!}
        onChange={(v) => onChange(field.name, v)}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === 'select_or_other') {
    return (
      <SelectOrOtherInput
        value={value}
        options={field.options ?? []}
        onChange={(v) => onChange(field.name, v)}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="radio">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field.name, e.target.checked)}
        />
        <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} />
        {value ? 'Yes' : 'No'}
      </label>
    );
  }

  if (field.type === 'number') {
    return (
      <input
        {...common}
        type="number"
        step="any"
        placeholder={field.placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value === '' ? null : Number(e.target.value))}
      />
    );
  }

  if (field.type === 'date') {
    return (
      <input
        {...common}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === 'datetime') {
    return (
      <input
        {...common}
        type="datetime-local"
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  return (
    <input
      {...common}
      type="text"
      placeholder={field.placeholder}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
    />
  );
}