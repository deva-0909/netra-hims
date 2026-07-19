import { useState } from 'react';
import { recordPayment, refundBill } from '../lib/billingPayment';

const STATUS_TAG_CLASS: Record<string, string> = {
  paid: 'tag-accent',
  partially_paid: 'tag-outline',
  unpaid: 'tag-outline',
  refunded: 'tag-neutral',
};

export function BillPaymentControls({ bill, onChanged }: { bill: any; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = Number(bill.total_amount) - Number(bill.amount_paid ?? 0);

  const submitPayment = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    setError(null);
    const { error: payError } = await recordPayment(bill.id, value, Number(bill.amount_paid ?? 0), Number(bill.total_amount), method);
    setSaving(false);
    if (payError) {
      setError(payError);
      return;
    }
    setAmount('');
    setOpen(false);
    onChanged();
  };

  const handleRefund = async () => {
    setSaving(true);
    setError(null);
    const { error: refundError } = await refundBill(bill.id);
    setSaving(false);
    if (refundError) {
      setError(refundError);
      return;
    }
    onChanged();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`tag ${STATUS_TAG_CLASS[bill.payment_status] ?? 'tag-outline'}`}>{bill.payment_status.replace(/_/g, ' ')}</span>
        <span className="text-muted" style={{ fontSize: 12 }}>
          paid ₹{Number(bill.amount_paid ?? 0).toFixed(2)} / ₹{Number(bill.total_amount).toFixed(2)}
        </span>
        {bill.payment_status !== 'paid' && bill.payment_status !== 'refunded' && !open && (
          <button className="btn btn-ghost" onClick={() => { setAmount(balance.toFixed(2)); setOpen(true); }}>Record payment</button>
        )}
        {(bill.payment_status === 'paid' || bill.payment_status === 'partially_paid') && (
          <button className="btn btn-ghost" onClick={handleRefund} disabled={saving}>Refund</button>
        )}
      </div>

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

      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
