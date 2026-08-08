import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { dispensePrescription } from '../lib/dispensePrescription';
import { dispenseIpdOrder } from '../lib/dispenseIpdOrder';
import { undoDispense, undoIpdDispense } from '../lib/undoDispense';

function IpdOrderRow({ order, dispensingId, onDispense }: { order: any; dispensingId: string | null; onDispense: (order: any, qty: number) => void }) {
  const [qty, setQty] = useState('1');
  const patient = order.admissions?.visits?.patients;

  return (
    <div className="card blueprint elev-sm" style={{ padding: 'var(--space-3)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong>{patient?.full_name} ({patient?.uhid})</strong>
          <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>Bed {order.admissions?.beds?.bed_number ?? '—'}</span>
          {patient?.known_allergies && (
            <span className="tag" style={{ marginLeft: 6, background: '#f6dede', color: '#8a2c2c', fontSize: 11 }}>Allergy: {patient.known_allergies}</span>
          )}
          <div style={{ fontSize: 13, marginTop: 2 }}>
            {order.drug_name}{!order.drug_id && <span className="text-muted"> (not in catalog)</span>} — {order.dosage} · {order.route} · {order.frequency}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className="input" style={{ width: 70 }} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} title="Quantity to send to ward" />
          <button className="btn btn-secondary" onClick={() => onDispense(order, Number(qty) || 1)} disabled={dispensingId === order.id}>
            {dispensingId === order.id ? 'Sending…' : 'Send to ward'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PharmacyQueuePage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const { data: dispenses, isLoading } = useQuery({
    queryKey: ['pharmacy-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacy_dispenses')
        .select('*, prescriptions(*, visits(patient_id, patients(full_name, uhid, known_allergies)), prescription_items(*, drugs(name, stock_qty)))')
        .order('dispensed_at', { ascending: false, nullsFirst: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: ipdOrders } = useQuery({
    queryKey: ['pharmacy-ipd-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ipd_medication_orders')
        .select('*, admissions(bed_id, beds(bed_number), visits(patient_id, patients(full_name, uhid, known_allergies)))')
        .eq('status', 'active')
        .eq('dispensed_to_ward', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: recentlySentToWard } = useQuery({
    queryKey: ['pharmacy-ipd-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ipd_medication_orders')
        .select('*, admissions(bed_id, beds(bed_number), visits(patient_id, patients(full_name, uhid)))')
        .eq('dispensed_to_ward', true)
        .order('dispensed_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const markDispensed = async (dispenseId: string, prescriptionId: string) => {
    setError(null);
    setDispensingId(dispenseId);
    const { error } = await dispensePrescription(dispenseId, prescriptionId, profile?.id);
    setDispensingId(null);
    if (error) {
      setError(error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  const sendToWard = async (order: any, qty: number) => {
    setError(null);
    setDispensingId(order.id);
    const { error } = await dispenseIpdOrder(order.id, order.drug_id, qty, profile?.id);
    setDispensingId(null);
    if (error) {
      setError(error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['pharmacy-ipd-orders'] });
    qc.invalidateQueries({ queryKey: ['pharmacy-ipd-recent'] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  const undoOpdDispense = async (d: any) => {
    setError(null);
    setUndoingId(d.id);
    const { error } = await undoDispense(d.id, d.prescription_id, profile?.id);
    setUndoingId(null);
    if (error) { setError(error); return; }
    qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  const undoWardDispense = async (order: any) => {
    setError(null);
    setUndoingId(order.id);
    const { error } = await undoIpdDispense(order.id, order.drug_id, order.dispensed_quantity ?? 0, profile?.id);
    setUndoingId(null);
    if (error) { setError(error); return; }
    qc.invalidateQueries({ queryKey: ['pharmacy-ipd-orders'] });
    qc.invalidateQueries({ queryKey: ['pharmacy-ipd-recent'] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  const pending = dispenses?.filter((d: any) => d.status !== 'dispensed') ?? [];
  const dispensed = dispenses?.filter((d: any) => d.status === 'dispensed') ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Pharmacy — Dispensing Queue</h2>
        <Link className="btn btn-secondary" to="/pharmacy/inventory">Inventory & stock</Link>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      <h4>IPD ward orders awaiting pharmacy ({ipdOrders?.length ?? 0})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {ipdOrders?.map((o: any) => <IpdOrderRow key={o.id} order={o} dispensingId={dispensingId} onDispense={sendToWard} />)}
        {ipdOrders?.length === 0 && <p className="text-muted">No inpatient orders waiting.</p>}
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <>
          <h4>Awaiting dispense ({pending.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pending.map((d: any) => (
              <div key={d.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)' }}>
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{d.prescriptions?.visits?.patients?.full_name} ({d.prescriptions?.visits?.patients?.uhid})</strong>
                    {d.prescriptions?.visits?.patients?.known_allergies && (
                      <span className="tag" style={{ marginLeft: 6, background: '#f6dede', color: '#8a2c2c', fontSize: 11 }}>
                        Allergy: {d.prescriptions.visits.patients.known_allergies}
                      </span>
                    )}
                  </div>
                  <span className="tag tag-outline">{d.status.replace(/_/g, ' ')}</span>
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                  {d.prescriptions?.prescription_items?.map((it: any) => {
                    const short = it.drugs && it.drugs.stock_qty < it.quantity;
                    return (
                      <li key={it.id} style={short ? { color: '#b64545' } : undefined}>
                        {it.drugs?.name ?? it.drug_name_freetext} × {it.quantity} — {it.dosage} {it.frequency}
                        {it.drugs && <span className="text-muted"> ({it.drugs.stock_qty} in stock{short ? ' — insufficient' : ''})</span>}
                      </li>
                    );
                  })}
                </ul>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => markDispensed(d.id, d.prescription_id)}
                  disabled={dispensingId === d.id}
                >
                  {dispensingId === d.id ? 'Dispensing…' : 'Mark dispensed'}
                </button>
              </div>
            ))}
            {pending.length === 0 && <p className="text-muted">Nothing waiting — the queue is clear.</p>}
          </div>

          <h4>Recently dispensed</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {dispensed.slice(0, 10).map((d: any) => (
              <div key={d.id} className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span>{d.prescriptions?.visits?.patients?.full_name} ({d.prescriptions?.visits?.patients?.uhid})</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="text-muted" style={{ fontSize: 12 }}>{d.dispensed_at ? new Date(d.dispensed_at).toLocaleString() : ''}</span>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => undoOpdDispense(d)} disabled={undoingId === d.id}>
                      {undoingId === d.id ? 'Undoing…' : 'Undo'}
                    </button>
                  </div>
                </div>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }} className="text-muted">
                  {d.prescriptions?.prescription_items?.map((it: any) => (
                    <li key={it.id}>{it.drugs?.name ?? it.drug_name_freetext} × {it.quantity} — {it.dosage} {it.frequency}</li>
                  ))}
                </ul>
              </div>
            ))}
            {dispensed.length === 0 && <p className="text-muted">No dispenses yet.</p>}
          </div>

          <h4>Recently sent to ward</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {recentlySentToWard?.map((o: any) => (
              <div key={o.id} className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span>
                    {o.admissions?.visits?.patients?.full_name} ({o.admissions?.visits?.patients?.uhid}) — {o.drug_name} × {o.dispensed_quantity ?? '—'}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="text-muted" style={{ fontSize: 12 }}>{o.dispensed_at ? new Date(o.dispensed_at).toLocaleString() : ''}</span>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => undoWardDispense(o)} disabled={undoingId === o.id}>
                      {undoingId === o.id ? 'Undoing…' : 'Undo'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {recentlySentToWard?.length === 0 && <p className="text-muted">Nothing sent to ward yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}