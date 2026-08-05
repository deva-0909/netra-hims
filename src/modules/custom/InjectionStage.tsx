import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { DrugPicker } from '../../components/DrugPicker';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { INJECTION_DOSES } from '../commonOptions';
import { deductDrugStock } from '../../lib/deductDrugStock';

const emptyForm = { eye: 'od', batch_number: '', dose: '', next_dose_due: '' };

/** Intravitreal injection record — a custom stage (not the generic RecordForm)
 * because it needs a catalog-linked drug_id to deduct real pharmacy stock on
 * save, the same way PharmacyStage dispensing does. */
export function InjectionStage({ visitId }: { visitId: string; stageOrder: unknown }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [drug, setDrug] = useState<{ drugId: string | null; name: string }>({ drugId: null, name: '' });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof emptyForm, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: records } = useQuery({
    queryKey: ['injection-records', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('injection_records').select('*').eq('visit_id', visitId).order('injected_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    if (!drug.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('injection_records').insert({
      visit_id: visitId,
      eye: form.eye,
      drug_id: drug.drugId,
      drug_name: drug.name,
      batch_number: form.batch_number || null,
      dose: form.dose || null,
      next_dose_due: form.next_dose_due || null,
      injected_by: profile?.id,
    });
    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }
    const { error: stockError } = await deductDrugStock(drug.drugId, 1);
    setSaving(false);
    if (stockError) {
      setError(`Injection recorded, but stock wasn't updated: ${stockError}`);
    }
    setDrug({ drugId: null, name: '' });
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ['injection-records', visitId] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>New injection record</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="field" style={{ flex: '0 1 110px' }}>
            <label>Eye</label>
            <select className="input" value={form.eye} onChange={(e) => set('eye', e.target.value)}>
              <option value="od">OD</option><option value="os">OS</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label>Drug</label>
            <DrugPicker value={drug} onChange={setDrug} />
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label>Batch number</label>
            <input className="input" value={form.batch_number} onChange={(e) => set('batch_number', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label>Dose</label>
            <SelectOrOtherInput value={form.dose} options={INJECTION_DOSES} onChange={(v) => set('dose', v)} />
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label>Next dose due</label>
            <input className="input" type="date" value={form.next_dose_due} onChange={(e) => set('next_dose_due', e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Record injection'}
        </button>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <div>
        <h4>Injection history</h4>
        {records?.length ? records.map((r: any) => (
          <div key={r.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <div className="card-meta">{new Date(r.injected_at).toLocaleString()}</div>
            <div style={{ fontSize: 13 }}>
              {r.eye.toUpperCase()} · {r.drug_name} {r.batch_number ? `(batch ${r.batch_number})` : ''} {r.dose ? `· ${r.dose}` : ''}
              {!r.drug_id && <span className="text-muted"> (not in catalog — stock unaffected)</span>}
              {r.next_dose_due && <div className="text-muted">Next dose due: {new Date(r.next_dose_due).toLocaleDateString()}</div>}
            </div>
          </div>
        )) : <p className="text-muted">No injections recorded yet for this visit.</p>}
      </div>
    </div>
  );
}
