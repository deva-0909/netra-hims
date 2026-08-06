import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { DrugPicker } from '../DrugPicker';

const ROUTES = ['oral', 'iv', 'im', 'topical', 'subcutaneous', 'other'];
const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'STAT', 'SOS', 'Q4H', 'Q6H', 'Q8H'];
const ADMIN_STATUS_LABEL: Record<string, string> = { given: 'Given', withheld: 'Withheld', refused: 'Refused' };

function NewMedicationOrderForm({ admissionId, onDone }: { admissionId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [drug, setDrug] = useState<{ drugId: string | null; name: string }>({ drugId: null, name: '' });
  const [form, setForm] = useState({ dosage: '', route: 'oral', frequency: 'OD', instructions: '', end_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!drug.name.trim() || !form.dosage.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ipd_medication_orders').insert({
      admission_id: admissionId,
      drug_id: drug.drugId,
      drug_name: drug.name,
      dosage: form.dosage,
      route: form.route,
      frequency: form.frequency,
      instructions: form.instructions || null,
      end_date: form.end_date || null,
      ordered_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['ipd-medication-orders', admissionId] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', padding: 8, background: 'var(--color-accent-100)', marginTop: 6, borderRadius: 'var(--radius-md)' }}>
      <DrugPicker value={drug} onChange={setDrug} />
      <div className="field" style={{ flex: '0 1 110px' }}><label>Dosage</label><input className="input" value={form.dosage} onChange={(e) => set('dosage', e.target.value)} placeholder="e.g. 1 drop" /></div>
      <div className="field" style={{ flex: '0 1 130px' }}>
        <label>Route</label>
        <select className="input" value={form.route} onChange={(e) => set('route', e.target.value)}>
          {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '0 1 100px' }}>
        <label>Frequency</label>
        <select className="input" value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>
          {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Instructions</label><input className="input" value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="e.g. operated eye only" /></div>
      <div className="field" style={{ flex: '0 1 140px' }}><label>End date (optional)</label><input className="input" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></div>
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Ordering…' : 'Order'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function MedicationOrderRow({ order, canAdminister, isDoctor, onChanged }: { order: any; canAdminister: boolean; isDoctor: boolean; onChanged: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showAdminister, setShowAdminister] = useState(false);
  const [adminStatus, setAdminStatus] = useState('given');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: administrations } = useQuery({
    queryKey: ['ipd-med-administrations', order.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('ipd_medication_administrations').select('*').eq('order_id', order.id).order('administered_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const logAdministration = async () => {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ipd_medication_administrations').insert({
      order_id: order.id, status: adminStatus, notes: adminNotes || null, administered_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setAdminNotes('');
    setShowAdminister(false);
    qc.invalidateQueries({ queryKey: ['ipd-med-administrations', order.id] });
  };

  const discontinue = async () => {
    setError(null);
    const { error: updateError } = await supabase.from('ipd_medication_orders').update({
      status: 'discontinued', discontinued_by: profile?.id, discontinued_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (updateError) { setError(updateError.message); return; }
    onChanged();
  };

  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div>
          <strong>{order.drug_name}</strong> — {order.dosage} · {order.route} · {order.frequency}
          <span className={`tag ${order.status === 'active' ? 'tag-accent' : 'tag-outline'}`} style={{ marginLeft: 6 }}>{order.status}</span>
          <span className={`tag ${order.dispensed_to_ward ? 'tag-accent' : 'tag-outline'}`} style={{ marginLeft: 4 }}>
            {order.dispensed_to_ward ? 'sent by pharmacy' : 'awaiting pharmacy'}
          </span>
          {order.instructions && <div className="text-muted">{order.instructions}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {canAdminister && order.status === 'active' && !showAdminister && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowAdminister(true)}>Log dose</button>}
          {isDoctor && order.status === 'active' && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={discontinue}>Discontinue</button>}
        </div>
      </div>
      {showAdminister && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <select className="input" style={{ width: 120 }} value={adminStatus} onChange={(e) => setAdminStatus(e.target.value)}>
            {Object.keys(ADMIN_STATUS_LABEL).map((s) => <option key={s} value={s}>{ADMIN_STATUS_LABEL[s]}</option>)}
          </select>
          <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
          <button className="btn btn-primary" onClick={logAdministration} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
          <button className="btn btn-ghost" onClick={() => setShowAdminister(false)}>Cancel</button>
        </div>
      )}
      {administrations && administrations.length > 0 && (
        <div className="text-muted" style={{ marginTop: 4, fontSize: 12 }}>
          {administrations.map((a: any) => (
            <div key={a.id}>{ADMIN_STATUS_LABEL[a.status]} — {new Date(a.administered_at).toLocaleString()}{a.notes ? ` — ${a.notes}` : ''}</div>
          ))}
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export function MedicationsPanel({ admissionId, isDoctor, canManage }: { admissionId: string; isDoctor: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const [showNewOrder, setShowNewOrder] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ['ipd-medication-orders', admissionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ipd_medication_orders').select('*').eq('admission_id', admissionId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refreshOrders = () => qc.invalidateQueries({ queryKey: ['ipd-medication-orders', admissionId] });

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--color-bg)' }}>
        <strong style={{ fontSize: 13 }}>Medication orders (eMAR)</strong>
        {isDoctor && !showNewOrder && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowNewOrder(true)}>+ Order</button>}
      </div>
      {showNewOrder && <NewMedicationOrderForm admissionId={admissionId} onDone={() => { setShowNewOrder(false); refreshOrders(); }} />}
      {orders?.length ? (
        orders.map((o: any) => <MedicationOrderRow key={o.id} order={o} canAdminister={canManage} isDoctor={isDoctor} onChanged={refreshOrders} />)
      ) : (
        <p className="text-muted" style={{ fontSize: 12, padding: '6px 10px 10px' }}>No medication orders yet.</p>
      )}
    </div>
  );
}
