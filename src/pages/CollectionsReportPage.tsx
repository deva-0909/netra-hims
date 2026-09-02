import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Lets a cashier actually close a day: count the physical cash drawer,
 * compare against what the system expects for that date (from
 * payment_transactions, same aggregation as the report above it), and
 * record the variance. Refunds are only tracked in total — the refund
 * transaction doesn't carry the original payment method — so system_cash
 * is gross cash payments, not net of same-day cash refunds; the variance
 * a cashier records absorbs that in practice. Immutable once submitted:
 * a day can only be closed once (closing_date is unique). */
function DayClosingPanel({ dateStr, byMethod, totalCollected, totalRefunded }: { dateStr: string; byMethod: Record<string, number>; totalCollected: number; totalRefunded: number }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: closing } = useQuery({
    queryKey: ['cashier-day-closing', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.from('cashier_day_closings').select('*, profiles(full_name)').eq('closing_date', dateStr).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const systemCash = byMethod.cash ?? 0;
  const countedValue = Number(counted) || 0;
  const variance = countedValue - systemCash;
  const netTotal = totalCollected - totalRefunded;

  const closeDay = async () => {
    if (!counted.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('cashier_day_closings').insert({
      closing_date: dateStr,
      system_cash: systemCash, system_card: byMethod.card ?? 0, system_upi: byMethod.upi ?? 0,
      system_insurance: byMethod.insurance ?? 0, system_other: byMethod.other ?? 0,
      system_refunds: totalRefunded, system_net_total: netTotal,
      counted_cash: countedValue, variance, notes: notes.trim() || null, closed_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setCounted(''); setNotes('');
    qc.invalidateQueries({ queryKey: ['cashier-day-closing', dateStr] });
  };

  if (closing) {
    return (
      <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0 }}>Day closing</h4>
        <p style={{ fontSize: 13 }}>
          Closed by {closing.profiles?.full_name ?? '—'} on {new Date(closing.closed_at).toLocaleString()}.
          {' '}Counted cash ₹{Number(closing.counted_cash).toFixed(2)} vs system ₹{Number(closing.system_cash).toFixed(2)}
          {' '}(variance {Number(closing.variance) >= 0 ? '+' : ''}₹{Number(closing.variance).toFixed(2)}).
        </p>
        {closing.notes && <p className="text-muted" style={{ fontSize: 13 }}>{closing.notes}</p>}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
      <h4 style={{ marginTop: 0 }}>Close the day</h4>
      <p className="text-muted" style={{ fontSize: 13 }}>System-expected cash for {dateStr}: ₹{systemCash.toFixed(2)}. Count the drawer and enter the actual cash on hand.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '0 1 160px', marginBottom: 0 }}>
          <label>Counted cash</label>
          <input className="input" type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 240px', marginBottom: 0 }}>
          <label>Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — reason for a variance, shift handover, etc." />
        </div>
        <button className="btn btn-primary" onClick={closeDay} disabled={saving}>{saving ? 'Closing…' : 'Close day'}</button>
      </div>
      {counted.trim() && (
        <p style={{ fontSize: 13, marginTop: 8, color: variance === 0 ? undefined : '#8a662c' }}>
          Variance: {variance >= 0 ? '+' : ''}₹{variance.toFixed(2)} {variance === 0 ? '(matches)' : variance > 0 ? '(surplus)' : '(shortfall)'}
        </p>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  );
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

          <DayClosingPanel dateStr={dateStr} byMethod={byMethod} totalCollected={totalCollected} totalRefunded={totalRefunded} />
        </>
      )}
    </div>
  );
}
