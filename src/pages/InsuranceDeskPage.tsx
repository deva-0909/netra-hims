import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const STATUSES = ['eligibility_check', 'pre_auth_requested', 'approved', 'rejected', 'settled'];

export function InsuranceDeskPage() {
  const qc = useQueryClient();
  const { data: claims, isLoading } = useQuery({
    queryKey: ['insurance-claims'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_claims').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('insurance_claims').update({ status }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['insurance-claims'] });
  };

  return (
    <div>
      <h2>Insurance Desk</h2>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Scheme</th><th>Package</th><th>Claim / Approved</th><th>Status</th></tr></thead>
          <tbody>
            {claims?.map((c: any) => (
              <tr key={c.id}>
                <td>{c.patients?.full_name} <span className="text-muted">({c.patients?.uhid})</span></td>
                <td>{c.scheme ?? '—'}</td>
                <td>{c.package_selected ?? '—'}</td>
                <td>₹{Number(c.claim_amount ?? 0).toFixed(0)} / ₹{Number(c.approved_amount ?? 0).toFixed(0)}</td>
                <td>
                  <select className="input" value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} style={{ width: 180 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {claims?.length === 0 && <tr><td colSpan={5} className="text-muted">No insurance claims yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
