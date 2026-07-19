import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export function BillingQueuePage() {
  const qc = useQueryClient();
  const { data: bills, isLoading } = useQuery({
    queryKey: ['all-bills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bills')
        .select('*, patients(full_name, uhid), visits(clinic_module)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markPaid = async (id: string, amount: number) => {
    await supabase.from('bills').update({ payment_status: 'paid', amount_paid: amount }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['all-bills'] });
  };

  return (
    <div>
      <h2>Billing</h2>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Bill #</th><th>Patient</th><th>Module</th><th>Total</th><th>Status</th><th /></tr></thead>
          <tbody>
            {bills?.map((b: any) => (
              <tr key={b.id}>
                <td>{b.bill_number}</td>
                <td>
                  {b.patients?.full_name} <span className="text-muted">({b.patients?.uhid})</span>
                </td>
                <td>{b.visits?.clinic_module ?? '—'}</td>
                <td>₹{Number(b.total_amount).toFixed(2)}</td>
                <td><span className={`tag ${b.payment_status === 'paid' ? 'tag-accent' : 'tag-outline'}`}>{b.payment_status.replace(/_/g, ' ')}</span></td>
                <td>
                  {b.payment_status !== 'paid' && (
                    <button className="btn btn-ghost" onClick={() => markPaid(b.id, Number(b.total_amount))}>Mark paid</button>
                  )}
                </td>
              </tr>
            ))}
            {bills?.length === 0 && <tr><td colSpan={6} className="text-muted">No bills yet. Generate one from a visit's Billing tab — <Link to="/patients">open a patient</Link> to start.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
