import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { BillPaymentControls } from '../components/BillPaymentControls';

type StatusFilter = 'all' | 'unpaid' | 'partially_paid' | 'paid' | 'refunded';

export function BillingQueuePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

  const term = search.trim().toLowerCase();
  const filtered = (bills ?? []).filter((b: any) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'unpaid' && b.payment_status !== 'unpaid') return false;
      if (statusFilter === 'partially_paid' && b.payment_status !== 'partially_paid') return false;
      if (statusFilter === 'paid' && b.payment_status !== 'paid') return false;
      if (statusFilter === 'refunded' && b.payment_status !== 'refunded' && b.payment_status !== 'partially_refunded') return false;
    }
    if (!term) return true;
    return (
      b.bill_number?.toLowerCase().includes(term) ||
      b.patients?.full_name?.toLowerCase().includes(term) ||
      b.patients?.uhid?.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Billing</h2>
        <Link className="btn btn-secondary" to="/billing/collections">Today's collections</Link>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient name, UHID or bill #" />
        </div>
        <div className="seg" style={{ maxWidth: 480 }}>
          {(['all', 'unpaid', 'partially_paid', 'paid', 'refunded'] as StatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Bill #</th><th>Patient</th><th>Module</th><th>Total</th><th>Payment</th></tr></thead>
          <tbody>
            {filtered.map((b: any) => (
              <tr key={b.id}>
                <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${b.patient_id}`)}>{b.bill_number}</td>
                <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${b.patient_id}`)}>
                  {b.patients?.full_name} <span className="text-muted">({b.patients?.uhid})</span>
                </td>
                <td>{b.visits?.clinic_module ?? '—'}</td>
                <td>₹{Number(b.total_amount).toFixed(2)}</td>
                <td><BillPaymentControls bill={b} patient={b.patients} onChanged={() => qc.invalidateQueries({ queryKey: ['all-bills'] })} /></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-muted">No bills match. Generate one from a visit's Billing tab — <Link to="/patients">open a patient</Link> to start.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
