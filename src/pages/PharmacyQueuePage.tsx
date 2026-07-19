import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { dispensePrescription } from '../lib/dispensePrescription';

export function PharmacyQueuePage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  const { data: dispenses, isLoading } = useQuery({
    queryKey: ['pharmacy-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacy_dispenses')
        .select('*, prescriptions(*, visits(patient_id, patients(full_name, uhid)), prescription_items(*, drugs(name)))')
        .order('dispensed_at', { ascending: false, nullsFirst: true });
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

  const pending = dispenses?.filter((d: any) => d.status !== 'dispensed') ?? [];
  const dispensed = dispenses?.filter((d: any) => d.status === 'dispensed') ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Pharmacy â€” Dispensing Queue</h2>
        <Link className="btn btn-secondary" to="/pharmacy/inventory">Inventory & stock</Link>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loadingâ€¦</p> : (
        <>
          <h4>Awaiting dispense ({pending.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pending.map((d: any) => (
              <div key={d.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)' }}>
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{d.prescriptions?.visits?.patients?.full_name} ({d.prescriptions?.visits?.patients?.uhid})</strong>
                  <span className="tag tag-outline">{d.status.replace(/_/g, ' ')}</span>
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                  {d.prescriptions?.prescription_items?.map((it: any) => (
                    <li key={it.id}>{it.drugs?.name ?? it.drug_name_freetext} Ã— {it.quantity} â€” {it.dosage} {it.frequency}</li>
                  ))}
                </ul>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => markDispensed(d.id, d.prescription_id)}
                  disabled={dispensingId === d.id}
                >
                  {dispensingId === d.id ? 'Dispensingâ€¦' : 'Mark dispensed'}
                </button>
              </div>
            ))}
            {pending.length === 0 && <p className="text-muted">Nothing waiting â€” the queue is clear.</p>}
          </div>

          <h4>Recently dispensed</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {dispensed.slice(0, 10).map((d: any) => (
              <div key={d.id} className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{d.prescriptions?.visits?.patients?.full_name} ({d.prescriptions?.visits?.patients?.uhid})</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>{d.dispensed_at ? new Date(d.dispensed_at).toLocaleString() : ''}</span>
                </div>
              </div>
            ))}
            {dispensed.length === 0 && <p className="text-muted">No dispenses yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}