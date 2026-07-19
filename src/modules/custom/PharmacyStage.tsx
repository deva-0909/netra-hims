import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { dispensePrescription } from '../../lib/dispensePrescription';
import { DrugPicker } from '../../components/DrugPicker';
import { advanceVisitStageTo } from '../../lib/advanceVisitStage';
import type { VisitStage } from '../../lib/types';

interface ItemDraft {
  drugId: string | null;
  drugName: string;
  dosage: string;
  frequency: string;
  duration_days: string;
  quantity: string;
  eye: string;
  instructions: string;
}

const emptyItem: ItemDraft = { drugId: null, drugName: '', dosage: '', frequency: '', duration_days: '', quantity: '1', eye: 'n/a', instructions: '' };

export function PharmacyStage({ visitId, stageOrder }: { visitId: string; stageOrder: VisitStage[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<ItemDraft[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  const { data: prescriptions } = useQuery({
    queryKey: ['prescriptions', visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, prescription_items(*, drugs(name)), pharmacy_dispenses(*)')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateItem = (i: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const savePrescription = async () => {
    const valid = items.filter((it) => it.drugName.trim());
    if (valid.length === 0) return;
    setSaving(true);
    setError(null);
    const { data: rx, error: rxError } = await supabase
      .from('prescriptions')
      .insert({ visit_id: visitId, prescribed_by: profile?.id })
      .select()
      .single();
    if (rxError || !rx) {
      setSaving(false);
      setError(rxError?.message ?? 'Could not create prescription.');
      return;
    }
    const itemRows = valid.map((it) => ({
      prescription_id: rx.id,
      drug_id: it.drugId,
      drug_name_freetext: it.drugName,
      dosage: it.dosage || null,
      frequency: it.frequency || null,
      duration_days: it.duration_days ? Number(it.duration_days) : null,
      quantity: Number(it.quantity) || 1,
      eye: it.eye,
      instructions: it.instructions || null,
    }));
    const { error: itemsError } = await supabase.from('prescription_items').insert(itemRows);
    if (itemsError) {
      setSaving(false);
      setError(`Prescription created, but drug items failed to save: ${itemsError.message}`);
      qc.invalidateQueries({ queryKey: ['prescriptions', visitId] });
      return;
    }
    const { error: dispenseInitError } = await supabase.from('pharmacy_dispenses').insert({ prescription_id: rx.id, status: 'pending' });
    setSaving(false);
    if (dispenseInitError) {
      setError(`Prescription saved, but couldn't queue it for dispensing: ${dispenseInitError.message}`);
      qc.invalidateQueries({ queryKey: ['prescriptions', visitId] });
      return;
    }
    setItems([{ ...emptyItem }]);
    qc.invalidateQueries({ queryKey: ['prescriptions', visitId] });
    await advanceVisitStageTo(visitId, 'pharmacy', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const markDispensed = async (dispenseId: string, prescriptionId: string) => {
    setDispenseError(null);
    setDispensingId(dispenseId);
    const { error } = await dispensePrescription(dispenseId, prescriptionId, profile?.id);
    setDispensingId(null);
    if (error) {
      setDispenseError(error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['prescriptions', visitId] });
    qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>New prescription</h4>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-2)', borderBottom: '1px dashed var(--color-divider)' }}>
            <DrugPicker value={{ drugId: it.drugId, name: it.drugName }} onChange={(v) => updateItem(i, { drugId: v.drugId, drugName: v.name })} />
            <input className="input" style={{ flex: '0 1 90px' }} type="number" min={1} placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
            <input className="input" style={{ flex: '1 1 100px' }} placeholder="Dosage" value={it.dosage} onChange={(e) => updateItem(i, { dosage: e.target.value })} />
            <input className="input" style={{ flex: '1 1 100px' }} placeholder="Frequency" value={it.frequency} onChange={(e) => updateItem(i, { frequency: e.target.value })} />
            <input className="input" style={{ flex: '1 1 90px' }} type="number" placeholder="Days" value={it.duration_days} onChange={(e) => updateItem(i, { duration_days: e.target.value })} />
            <select className="input" style={{ flex: '1 1 90px' }} value={it.eye} onChange={(e) => updateItem(i, { eye: e.target.value })}>
              <option value="n/a">N/A</option><option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
            </select>
            <input className="input" style={{ flex: '1 1 160px' }} placeholder="Instructions" value={it.instructions} onChange={(e) => updateItem(i, { instructions: e.target.value })} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>+ Add drug</button>
          <button type="button" className="btn btn-primary" onClick={savePrescription} disabled={saving}>{saving ? 'Saving…' : 'Save prescription'}</button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <div>
        <h4>Prescription history</h4>
        {dispenseError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{dispenseError}</div>}
        {prescriptions?.length ? prescriptions.map((rx: any) => (
          <div key={rx.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <div className="card-meta">{new Date(rx.created_at).toLocaleString()}
              {rx.pharmacy_dispenses?.[0] && (
                <span className={`tag ${rx.pharmacy_dispenses[0].status === 'dispensed' ? 'tag-accent' : 'tag-outline'}`} style={{ marginLeft: 8 }}>
                  {rx.pharmacy_dispenses[0].status}
                </span>
              )}
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {rx.prescription_items?.map((it: any) => (
                <li key={it.id}>
                  {it.drugs?.name ?? it.drug_name_freetext} × {it.quantity} — {it.dosage} {it.frequency} for {it.duration_days} days {it.eye !== 'n/a' ? `(${it.eye.toUpperCase()})` : ''}
                  {!it.drug_id && <span className="text-muted"> (not in catalog)</span>}
                </li>
              ))}
            </ul>
            {rx.pharmacy_dispenses?.[0] && rx.pharmacy_dispenses[0].status !== 'dispensed' && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: 8 }}
                onClick={() => markDispensed(rx.pharmacy_dispenses[0].id, rx.id)}
                disabled={dispensingId === rx.pharmacy_dispenses[0].id}
              >
                {dispensingId === rx.pharmacy_dispenses[0].id ? 'Dispensing…' : 'Mark dispensed'}
              </button>
            )}
          </div>
        )) : <p className="text-muted">No prescriptions yet.</p>}
      </div>
    </div>
  );
}
