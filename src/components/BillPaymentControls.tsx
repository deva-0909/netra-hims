import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { recordPayment, refundBill } from '../lib/billingPayment';
import { printInvoice } from '../lib/printInvoice';
import { useAuth } from '../lib/AuthContext';

const STATUS_TAG_CLASS: Record<string, string> = {
  paid: 'tag-accent',
  partially_paid: 'tag-outline',
  unpaid: 'tag-outline',
  partially_refunded: 'tag-outline',
  refunded: 'tag-neutral',
};

function TransactionHistory({ billId }: { billId: string }) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['bill-transactions', billId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*, profiles!payment_transactions_recorded_by_fkey(full_name)')
        .eq('bill_id', billId)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>Loading…</p>;
  if (!transactions?.length) return <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No transactions recorded yet.</p>;

  return (
    <ul style={{ paddingLeft: 18, fontSize: 12, marginTop: 6 }}>
      {transactions.map((t: any) => (
        <li key={t.id}>
          {t.transaction_type === 'refund' ? 'Refund' : 'Payment'} of ₹{Number(t.amount).toFixed(2)} ({t.method})
          {' '}— {new Date(t.recorded_at).toLocaleString()}{t.profiles?.full_name ? ` · ${t.profiles.full_name}` : ''}
          {t.notes ? ` · ${t.notes}` : ''}
        </li>
      ))}
    </ul>
  );
}

export function BillPaymentControls({ bill, patient, onChanged }: { bill: any; patient?: { full_name: string; uhid: string }; onChanged: () => void }) {
  const { profile } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountPaid = Number(bill.amount_paid ?? 0);
  const amountRefunded = Number(bill.amount_refunded ?? 0);
  const balance = Number(bill.total_amount) - amountPaid;
  const refundableBalance = amountPaid - amountRefunded;

  const submitPayment = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    setError(null);
    const { error: payError } = await recordPayment(bill.id, value, amountPaid, Number(bill.total_amount), method, profile?.id);
    setSaving(false);
    if (payError) {
      setError(payError);
      return;
    }
    setAmount('');
    setOpen(false);
    onChanged();
  };

  const submitRefund = async () => {
    const value = Number(refundAmount);
    if (!value || value <= 0) return;
    if (!refundReason.trim()) {
      setError('A reason is required to record a refund.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: refundError } = await refundBill(bill.id, amountPaid, amountRefunded, value, refundReason, profile?.id);
    setSaving(false);
    if (refundError) {
      setError(refundError);
      return;
    }
    setRefundAmount('');
    setRefundReason('');
    setRefundOpen(false);
    onChanged();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`tag ${STATUS_TAG_CLASS[bill.payment_status] ?? 'tag-outline'}`}>{bill.payment_status.replace(/_/g, ' ')}</span>
        <span className="text-muted" style={{ fontSize: 12 }}>
          paid ₹{amountPaid.toFixed(2)} / ₹{Number(bill.total_amount).toFixed(2)}
          {amountRefunded > 0 && ` · refunded ₹${amountRefunded.toFixed(2)}`}
        </span>
        {bill.payment_status !== 'paid' && bill.payment_status !== 'refunded' && bill.payment_status !== 'partially_refunded' && !open && (
          <button className="btn btn-ghost" onClick={() => { setAmount(balance.toFixed(2)); setOpen(true); }}>Record payment</button>
        )}
        {refundableBalance > 0 && !refundOpen && (
          <button className="btn btn-ghost" onClick={() => { setRefundAmount(refundableBalance.toFixed(2)); setRefundOpen(true); }}>Refund</button>
        )}
        {patient && (
          <button className="btn btn-ghost" onClick={() => printInvoice(bill, patient)}>Print invoice</button>
        )}
        <button className="btn btn-ghost" onClick={() => setShowHistory((s) => !s)}>{showHistory ? 'Hide history' : 'View history'}</button>
      </div>

      {showHistory && <TransactionHistory billId={bill.id} />}

      {open && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 110 }} type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select className="input" style={{ width: 120 }} value={method} onChange={(e) => setMethod(e.target.value)}>
            {['cash', 'card', 'upi', 'insurance', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn btn-primary" onClick={submitPayment} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <span className="text-muted" style={{ fontSize: 11 }}>Balance due: ₹{balance.toFixed(2)}</span>
        </div>
      )}

      {refundOpen && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 110 }} type="number" placeholder="Amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          <input className="input" style={{ width: 200 }} placeholder="Reason (required)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <button className="btn btn-primary" onClick={submitRefund} disabled={saving}>{saving ? 'Saving…' : 'Confirm refund'}</button>
          <button className="btn btn-ghost" onClick={() => setRefundOpen(false)}>Cancel</button>
          <span className="text-muted" style={{ fontSize: 11 }}>Refundable: ₹{refundableBalance.toFixed(2)}</span>
        </div>
      )}

      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
