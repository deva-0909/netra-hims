import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { BillPaymentControls } from '../components/BillPaymentControls';

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Billing</h2>
        <Link className="btn btn-secondary" to="/billing/collections">Today's collections</Link>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Bill #</th><th>Patient</th><th>Module</th><th>Total</th><th>Payment</th></tr></thead>
          <tbody>
            {bills?.map((b: any) => (
              <tr key={b.id}>
                <td>{b.bill_number}</td>
                <td>
                  {b.patients?.full_name} <span className="text-muted">({b.patients?.uhid})</span>
                </td>
                <td>{b.visits?.clinic_module ?? '—'}</td>
                <td>₹{Number(b.total_amount).toFixed(2)}</td>
                <td><BillPaymentControls bill={b} patient={b.patients} onChanged={() => qc.invalidateQueries({ queryKey: ['all-bills'] })} /></td>
              </tr>
            ))}
            {bills?.length === 0 && <tr><td colSpan={5} className="text-muted">No bills yet. Generate one from a visit's Billing tab — <Link to="/patients">open a patient</Link> to start.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
