import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { recordPoInvoice, recordPoPayment } from '../lib/poPayments';

const STATUS_TAG_STYLE: Record<string, React.CSSProperties> = {
  unbilled: {},
  unpaid: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  partially_paid: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  paid: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
};

/** Vendor invoice + payment tracking for a purchase order — the outbound
 * mirror of BillPaymentControls (money owed to a vendor instead of money
 * owed by a patient), with the same partial-payment history pattern. */
export function VendorPaymentControls({ po, onChanged }: { po: any; onChanged: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(po.invoice_number ?? '');
  const [invoiceAmount, setInvoiceAmount] = useState(po.invoice_amount ? String(po.invoice_amount) : '');
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: payments } = useQuery({
    queryKey: ['po-payments', po.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('po_payments').select('*').eq('po_id', po.id).order('paid_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invoiceAmountNum = Number(po.invoice_amount ?? 0);
  const amountPaid = Number(po.amount_paid ?? 0);
  const remaining = invoiceAmountNum - amountPaid;

  const submitInvoice = async () => {
    const value = Number(invoiceAmount);
    if (!value) return;
    setSaving(true);
    setError(null);
    const { error: invoiceError } = await recordPoInvoice(po.id, invoiceNumber, value, amountPaid);
    setSaving(false);
    if (invoiceError) { setError(invoiceError); return; }
    setInvoiceOpen(false);
    onChanged();
  };

  const submitPayment = async () => {
    const value = Number(payAmount);
    if (!value) return;
    setSaving(true);
    setError(null);
    const { error: payError } = await recordPoPayment(po.id, value, amountPaid, invoiceAmountNum, payMethod, payNotes, profile?.id);
    setSaving(false);
    if (payError) { setError(payError); return; }
    setPayAmount('');
    setPayNotes('');
    setPayOpen(false);
    qc.invalidateQueries({ queryKey: ['po-payments', po.id] });
    onChanged();
  };

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="tag tag-outline" style={STATUS_TAG_STYLE[po.payment_status]}>{po.payment_status.replace(/_/g, ' ')}</span>
        {po.invoice_number && <span className="text-muted" style={{ fontSize: 12 }}>invoice {po.invoice_number}</span>}
        {invoiceAmountNum > 0 && <span className="text-muted" style={{ fontSize: 12 }}>paid ₹{amountPaid.toFixed(2)} / ₹{invoiceAmountNum.toFixed(2)}</span>}
        {!invoiceOpen && <button className="btn btn-ghost" onClick={() => setInvoiceOpen(true)}>{po.invoice_number ? 'Update invoice' : 'Record vendor invoice'}</button>}
        {invoiceAmountNum > 0 && remaining > 0 && !payOpen && <button className="btn btn-ghost" onClick={() => { setPayAmount(remaining.toFixed(2)); setPayOpen(true); }}>Record payment</button>}
      </div>

      {invoiceOpen && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 140 }} placeholder="Invoice #" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          <input className="input" style={{ width: 120 }} type="number" placeholder="Invoice amount" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
          <button className="btn btn-primary" onClick={submitInvoice} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
          <button className="btn btn-ghost" onClick={() => setInvoiceOpen(false)}>Cancel</button>
        </div>
      )}

      {payOpen && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 110 }} type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          <select className="input" style={{ width: 140 }} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            {['bank_transfer', 'cheque', 'cash', 'upi', 'other'].map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
          <input className="input" style={{ width: 160 }} placeholder="Reference / notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
          <button className="btn btn-primary" onClick={submitPayment} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
          <button className="btn btn-ghost" onClick={() => setPayOpen(false)}>Cancel</button>
          <span className="text-muted" style={{ fontSize: 11 }}>Remaining: ₹{remaining.toFixed(2)}</span>
        </div>
      )}

      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}

      {payments && payments.length > 0 && (
        <ul style={{ paddingLeft: 18, fontSize: 12, marginTop: 8 }} className="text-muted">
          {payments.map((p: any) => (
            <li key={p.id}>₹{Number(p.amount).toFixed(2)} — {p.method?.replace(/_/g, ' ') ?? 'unspecified'} — {new Date(p.paid_at).toLocaleDateString()} {p.notes ? `(${p.notes})` : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
