import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import type { StageConfig } from '../modules/fieldTypes';
import { FieldInput } from './FieldInput';

interface Props {
  stage: StageConfig;
  extraValues: Record<string, any>; // e.g. { visit_id }
  onSaved?: () => void;
}

export function RecordForm({ stage, extraValues, onSaved }: Props) {
  const { profile } = useAuth();
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedOk(false);

    const payload: Record<string, any> = { ...values, ...extraValues };
    if (stage.staffField && profile) payload[stage.staffField] = profile.id;

    // strip empty strings on optional fields to avoid type coercion issues
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = null;
    });

    const { error: insertError } = await supabase.from(stage.table).insert(payload);
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setSavedOk(true);
      setValues({});
      onSaved?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        {stage.fields.map((field) => (
          <div
            className="field"
            key={field.name}
            style={{ flex: field.half ? '1 1 220px' : '1 1 100%' }}
          >
            <label htmlFor={field.name}>{field.label}</label>
            <FieldInput field={field} value={values[field.name]} onChange={handleChange} folder={stage.table} />
          </div>
        ))}
      </div>

      {error && (
        <div style={{ color: '#b64545', fontSize: 13 }}>{error}</div>
      )}
      {savedOk && (
        <div style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>Saved.</div>
      )}

      <div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save record'}
        </button>
      </div>
    </form>
  );
}
