import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const IMPLANT_TYPES = ['iol', 'other'];

/** Pre-op IOL power is calculated and stored (imaging_records), but nothing
 * on the OT side ever recorded which lens was actually implanted — surgeons
 * sometimes change the lens intraoperatively, and lot-number traceability
 * matters for both billing and recalls. */
export function ImplantsPanel({ otRecordId, canManage }: { otRecordId: string; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ implant_type: 'iol', model_name: '', power: '', lot_number: '', serial_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { data: implants } = useQuery({
    queryKey: ['ot-implants', otRecordId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ot_implants').select('*').eq('ot_record_id', otRecordId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!form.model_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ot_implants').insert({
      ot_record_id: otRecordId,
      implant_type: form.implant_type,
      model_name: form.model_name,
      power: form.power || null,
      lot_number: form.lot_number || null,
      serial_number: form.serial_number || null,
      notes: form.notes || null,
      recorded_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm({ implant_type: 'iol', model_name: '', power: '', lot_number: '', serial_number: '', notes: '' });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ot-implants', otRecordId] });
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Implants</strong>
        {canManage && !showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>+ Record implant</button>}
      </div>
      {showForm && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end' }}>
          <select className="input" style={{ flex: '0 1 100px' }} value={form.implant_type} onChange={(e) => set('implant_type', e.target.value)}>
            {IMPLANT_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
          <input className="input" style={{ flex: '1 1 160px' }} placeholder="Model name" value={form.model_name} onChange={(e) => set('model_name', e.target.value)} />
          <input className="input" style={{ flex: '0 1 100px' }} placeholder="Power (D)" value={form.power} onChange={(e) => set('power', e.target.value)} />
          <input className="input" style={{ flex: '0 1 130px' }} placeholder="Lot number" value={form.lot_number} onChange={(e) => set('lot_number', e.target.value)} />
          <input className="input" style={{ flex: '0 1 130px' }} placeholder="Serial number" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
          <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {implants?.length ? (
        <ul style={{ paddingLeft: 18, fontSize: 13, marginTop: 6 }}>
          {implants.map((i: any) => (
            <li key={i.id}>
              {i.implant_type.toUpperCase()} — {i.model_name}{i.power ? `, ${i.power}D` : ''}{i.lot_number ? ` · lot ${i.lot_number}` : ''}{i.serial_number ? ` · SN ${i.serial_number}` : ''}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No implants recorded.</p>}
    </div>
  );
}
