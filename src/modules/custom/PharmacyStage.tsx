import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

interface ItemDraft {
  drug_name_freetext: string;
  dosage: string;
  frequency: string;
  duration_days: string;
  eye: string;
  instructions: string;
}

const emptyItem: ItemDraft = { drug_name_freetext: '', dosage: '', frequency: '', duration_days: '', eye: 'n/a', instructions: '' };

export function PharmacyStage({ visitId }: { visitId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<ItemDraft[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);

  const { data: prescriptions } = useQuery({
    queryKey: ['prescriptions', visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, prescription_items(*), pharmacy_dispenses(*)')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateItem = (i: number, key: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  };

  const savePrescription = async () => {
    const valid = items.filter((it) => it.drug_name_freetext.trim());
    if (valid.length === 0) return;
    setSaving(true);
    const { data: rx, error } = await supabase
      .from('prescriptions')
      .insert({ visit_id: visitId, prescribed_by: profile?.id })
      .select()
      .single();
    if (error || !rx) { setSaving(false); return; }
    const itemRows = valid.map((it) => ({
      prescription_id: rx.id,
      drug_name_freetext: it.drug_name_freetext,
      dosage: it.dosage || null,
      frequency: it.frequency || null,
      duration_days: it.duration_days ? Number(it.duration_days) : null,
      eye: it.eye,
      instructions: it.instructions || null,
    }));
    await supabase.from('prescription_items').insert(itemRows);
    await supabase.from('pharmacy_dispenses').insert({ prescription_id: rx.id, status: 'pending' });
    setSaving(false);
    setItems([{ ...emptyItem }]);
    qc.invalidateQueries({ queryKey: ['prescriptions', visitId] });
  };

  const markDispensed = async (dispenseId: string) => {
    await supabase.from('pharmacy_dispenses').update({ status: 'dispensed', dispensed_at: new Date().toISOString(), dispensed_by: profile?.id }).eq('id', dispenseId);
    qc.invalidateQueries({ queryKey: ['prescriptions', visitId] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>New prescription</h4>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-2)', borderBottom: '1px dashed var(--color-divider)' }}>
            <input className="input" style={{ flex: '1 1 180px' }} placeholder="Drug name" value={it.drug_name_freetext} onChange={(e) => updateItem(i, 'drug_name_freetext', e.target.value)} />
            <input className="input" style={{ flex: '1 1 100px' }} placeholder="Dosage" value={it.dosage} onChange={(e) => updateItem(i, 'dosage', e.target.value)} />
            <input className="input" style={{ flex: '1 1 100px' }} placeholder="Frequency" value={it.frequency} onChange={(e) => updateItem(i, 'frequency', e.target.value)} />
            <input className="input" style={{ flex: '1 1 90px' }} type="number" placeholder="Days" value={it.duration_days} onChange={(e) => updateItem(i, 'duration_days', e.target.value)} />
            <select className="input" style={{ flex: '1 1 90px' }} value={it.eye} onChange={(e) => updateItem(i, 'eye', e.target.value)}>
              <option value="n/a">N/A</option><option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
            </select>
            <input className="input" style={{ flex: '1 1 160px' }} placeholder="Instructions" value={it.instructions} onChange={(e) => updateItem(i, 'instructions', e.target.value)} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>+ Add drug</button>
          <button type="button" className="btn btn-primary" onClick={savePrescription} disabled={saving}>{saving ? 'Saving…' : 'Save prescription'}</button>
        </div>
      </div>

      <div>
        <h4>Prescription history</h4>
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
                <li key={it.id}>{it.drug_name_freetext} — {it.dosage} {it.frequency} for {it.duration_days} days {it.eye !== 'n/a' ? `(${it.eye.toUpperCase()})` : ''}</li>
              ))}
            </ul>
            {rx.pharmacy_dispenses?.[0] && rx.pharmacy_dispenses[0].status !== 'dispensed' && (
              <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => markDispensed(rx.pharmacy_dispenses[0].id)}>Mark dispensed</button>
            )}
          </div>
        )) : <p className="text-muted">No prescriptions yet.</p>}
      </div>
    </div>
  );
}
