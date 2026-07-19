import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

export function PharmacyQueuePage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: dispenses, isLoading } = useQuery({
    queryKey: ['pharmacy-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacy_dispenses')
        .select('*, prescriptions(*, visits(patient_id, patients(full_name, uhid)), prescription_items(*))')
        .order('dispensed_at', { ascending: false, nullsFirst: true });
      if (error) throw error;
      return data;
    },
  });

  const markDispensed = async (id: string) => {
    await supabase.from('pharmacy_dispenses').update({ status: 'dispensed', dispensed_at: new Date().toISOString(), dispensed_by: profile?.id }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
  };

  return (
    <div>
      <h2>Pharmacy — Dispensing Queue</h2>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {dispenses?.map((d: any) => (
            <div key={d.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)' }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{d.prescriptions?.visits?.patients?.full_name} ({d.prescriptions?.visits?.patients?.uhid})</strong>
                <span className={`tag ${d.status === 'dispensed' ? 'tag-accent' : 'tag-outline'}`}>{d.status.replace(/_/g, ' ')}</span>
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                {d.prescriptions?.prescription_items?.map((it: any) => (
                  <li key={it.id}>{it.drug_name_freetext} — {it.dosage} {it.frequency}</li>
                ))}
              </ul>
              {d.status !== 'dispensed' && (
                <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => markDispensed(d.id)}>Mark dispensed</button>
              )}
            </div>
          ))}
          {dispenses?.length === 0 && <p className="text-muted">No prescriptions in queue.</p>}
        </div>
      )}
    </div>
  );
}
