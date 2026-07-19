import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function CollectionsReportPage() {
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['collections', dateStr],
    queryFn: async () => {
      const start = startOfDay(new Date(dateStr));
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*, bills(bill_number, patients(full_name, uhid))')
        .gte('recorded_at', start.toISOString())
        .lt('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const payments = (transactions ?? []).filter((t: any) => t.transaction_type === 'payment');
  const refunds = (transactions ?? []).filter((t: any) => t.transaction_type === 'refund');

  const byMethod = payments.reduce((acc: Record<string, number>, t: any) => {
    const m = t.method ?? 'other';
    acc[m] = (acc[m] ?? 0) + Number(t.amount);
    return acc;
  }, {});

  const totalCollected = payments.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const totalRefunded = refunds.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  return (
    <div>
      <h2>Collections Report</h2>
      <div className="field" style={{ maxWidth: 200, marginBottom: 'var(--space-4)' }}>
        <label>Date</label>
        <input className="input" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div className="card-kicker">Total collected</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>₹{totalCollected.toFixed(2)}</div>
            </div>
            <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div className="card-kicker">Refunded</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>₹{totalRefunded.toFixed(2)}</div>
            </div>
            {Object.entries(byMethod).map(([method, amount]) => (
              <div key={method} className="card" style={{ padding: 'var(--space-4)' }}>
                <div className="card-kicker">{method}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600 }}>₹{amount.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <h4>Transactions</h4>
          <table className="table">
            <thead><tr><th>Time</th><th>Bill #</th><th>Patient</th><th>Type</th><th>Method</th><th>Amount</th></tr></thead>
            <tbody>
              {transactions?.map((t: any) => (
                <tr key={t.id}>
                  <td>{new Date(t.recorded_at).toLocaleTimeString()}</td>
                  <td>{t.bills?.bill_number}</td>
                  <td>{t.bills?.patients?.full_name} <span className="text-muted">({t.bills?.patients?.uhid})</span></td>
                  <td><span className={`tag ${t.transaction_type === 'refund' ? 'tag-outline' : 'tag-accent'}`}>{t.transaction_type}</span></td>
                  <td>{t.method}</td>
                  <td>₹{Number(t.amount).toFixed(2)}</td>
                </tr>
              ))}
              {transactions?.length === 0 && <tr><td colSpan={6} className="text-muted">No transactions on this date.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
