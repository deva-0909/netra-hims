import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const IMPLANT_TYPES = ['iol', 'other'];

/** Pre-op IOL power is calculated and stored (imaging_records), and now a
 * lens can be picked directly from tracked stock (iol_units) instead of
 * only free-typed — picking from stock links the implant record back to a
 * specific serial/lot for real recall traceability, and marks that unit
 * consumed. Manual entry stays available for untracked/consignment lenses. */
export function ImplantsPanel({ otRecordId, canManage }: { otRecordId: string; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fromStock, setFromStock] = useState(true);
  const [modelId, setModelId] = useState('');
  const [unitId, setUnitId] = useState('');
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

  const { data: models } = useQuery({
    queryKey: ['iol-models-active'],
    enabled: fromStock && showForm,
    queryFn: async () => {
      const { data, error } = await supabase.from('iol_models').select('*').eq('active', true).order('manufacturer').order('model_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: availableUnits } = useQuery({
    queryKey: ['iol-units-in-stock', modelId],
    enabled: fromStock && showForm && !!modelId,
    queryFn: async () => {
      const { data, error } = await supabase.from('iol_units').select('*').eq('model_id', modelId).eq('status', 'in_stock').order('power');
      if (error) throw error;
      return data;
    },
  });

  const submitFromStock = async () => {
    const unit = availableUnits?.find((u: any) => u.id === unitId);
    const model = models?.find((m: any) => m.id === modelId);
    if (!unit || !model) return;
    setSaving(true);
    setError(null);
    const { data: implant, error: insertError } = await supabase.from('ot_implants').insert({
      ot_record_id: otRecordId, implant_type: 'iol', model_name: `${model.manufacturer} ${model.model_name}`,
      power: String(unit.power), lot_number: unit.lot_number, serial_number: unit.serial_number,
      notes: form.notes || null, recorded_by: profile?.id, iol_unit_id: unit.id,
    }).select().single();
    if (insertError || !implant) { setSaving(false); setError(insertError?.message ?? 'Could not save implant record.'); return; }
    const { error: unitError } = await supabase.from('iol_units').update({ status: 'implanted', implanted_ot_implant_id: implant.id }).eq('id', unit.id);
    setSaving(false);
    if (unitError) { setError(`Implant recorded, but stock wasn't updated: ${unitError.message}`); return; }
    setModelId(''); setUnitId(''); setForm((p) => ({ ...p, notes: '' }));
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ot-implants', otRecordId] });
    qc.invalidateQueries({ queryKey: ['iol-units-in-stock', modelId] });
  };

  const submitManual = async () => {
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
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="radio" checked={fromStock} onChange={() => setFromStock(true)} /> From stock</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="radio" checked={!fromStock} onChange={() => setFromStock(false)} /> Type manually</label>
          </div>
          {fromStock ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <select className="input" style={{ flex: '1 1 200px' }} value={modelId} onChange={(e) => { setModelId(e.target.value); setUnitId(''); }}>
                <option value="">Select lens model…</option>
                {models?.map((m: any) => <option key={m.id} value={m.id}>{m.manufacturer} {m.model_name} ({m.lens_type})</option>)}
              </select>
              <select className="input" style={{ flex: '1 1 200px' }} value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!modelId}>
                <option value="">Select unit…</option>
                {availableUnits?.map((u: any) => <option key={u.id} value={u.id}>{u.power}D — lot {u.lot_number ?? '—'}, SN {u.serial_number ?? '—'}</option>)}
              </select>
              <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              {modelId && availableUnits?.length === 0 && <span className="text-muted" style={{ fontSize: 11 }}>No stock for this model.</span>}
              <button className="btn btn-primary" onClick={submitFromStock} disabled={saving || !unitId}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <select className="input" style={{ flex: '0 1 100px' }} value={form.implant_type} onChange={(e) => set('implant_type', e.target.value)}>
                {IMPLANT_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <input className="input" style={{ flex: '1 1 160px' }} placeholder="Model name" value={form.model_name} onChange={(e) => set('model_name', e.target.value)} />
              <input className="input" style={{ flex: '0 1 100px' }} placeholder="Power (D)" value={form.power} onChange={(e) => set('power', e.target.value)} />
              <input className="input" style={{ flex: '0 1 130px' }} placeholder="Lot number" value={form.lot_number} onChange={(e) => set('lot_number', e.target.value)} />
              <input className="input" style={{ flex: '0 1 130px' }} placeholder="Serial number" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
              <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              <button className="btn btn-primary" onClick={submitManual} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          )}
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
