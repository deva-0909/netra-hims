import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const STATUSES = ['eligibility_check', 'pre_auth_requested', 'approved', 'rejected', 'settled'];

export function InsuranceDeskPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: claims, isLoading } = useQuery({
    queryKey: ['insurance-claims'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_claims').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('insurance_claims').update({ status }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['insurance-claims'] });
  };

  return (
    <div>
      <h2>Insurance Desk</h2>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loadingâ€¦</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Scheme</th><th>Package</th><th>Claim / Approved</th><th>Document</th><th>Status</th></tr></thead>
          <tbody>
            {claims?.map((c: any) => (
              <tr key={c.id}>
                <td>{c.patients?.full_name} <span className="text-muted">({c.patients?.uhid})</span></td>
                <td>{c.scheme ?? 'â€”'}</td>
                <td>{c.package_selected ?? 'â€”'}</td>
                <td>â‚¹{Number(c.claim_amount ?? 0).toFixed(0)} / â‚¹{Number(c.approved_amount ?? 0).toFixed(0)}</td>
                <td>{c.document_url ? <a href={c.document_url} target="_blank" rel="noreferrer">View</a> : <span className="text-muted">â€”</span>}</td>
                <td>
                  <select className="input" value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} style={{ width: 180 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {claims?.length === 0 && <tr><td colSpan={6} className="text-muted">No insurance claims yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}