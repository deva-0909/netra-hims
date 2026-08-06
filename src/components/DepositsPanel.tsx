import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { collectDeposit, adjustDepositToBill, refundDeposit } from '../lib/deposits';

const PURPOSES = ['admission_advance', 'surgery_advance', 'general_advance', 'other'];

function DepositRow({ deposit, bills, onChanged }: { deposit: any; bills: any[]; onChanged: () => void }) {
  const { profile } = useAuth();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [billId, setBillId] = useState(bills[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heldBalance = Number(deposit.amount) - Number(deposit.adjusted_amount) - Number(deposit.refunded_amount);

  const submitAdjust = async () => {
    const bill = bills.find((b) => b.id === billId);
    const value = Number(amount);
    if (!bill || !value) return;
    setSaving(true);
    setError(null);
    const { error: adjustError } = await adjustDepositToBill(deposit, bill.id, Number(bill.amount_paid ?? 0), Number(bill.total_amount), value, profile?.id);
    setSaving(false);
    if (adjustError) { setError(adjustError); return; }
    setAmount('');
    setAdjustOpen(false);
    onChanged();
  };

  const submitRefund = async () => {
    const value = Number(amount);
    if (!value) return;
    setSaving(true);
    setError(null);
    const { error: refundError } = await refundDeposit(deposit, value, reason, profile?.id);
    setSaving(false);
    if (refundError) { setError(refundError); return; }
    setAmount('');
    setReason('');
    setRefundOpen(false);
    onChanged();
  };

  return (
    <div className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong>₹{Number(deposit.amount).toFixed(2)}</strong> — {(deposit.purpose ?? 'other').replace(/_/g, ' ')}
          <div className="text-muted" style={{ fontSize: 12 }}>
            {new Date(deposit.collected_at).toLocaleString()} · <span className="tag tag-outline">{deposit.status.replace(/_/g, ' ')}</span>
            {' '}· held ₹{heldBalance.toFixed(2)}
            {Number(deposit.adjusted_amount) > 0 && ` · adjusted ₹${Number(deposit.adjusted_amount).toFixed(2)}`}
            {Number(deposit.refunded_amount) > 0 && ` · refunded ₹${Number(deposit.refunded_amount).toFixed(2)}`}
          </div>
        </div>
        {heldBalance > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {bills.length > 0 && <button className="btn btn-ghost" onClick={() => { setAmount(heldBalance.toFixed(2)); setAdjustOpen(true); setRefundOpen(false); }}>Adjust to bill</button>}
            <button className="btn btn-ghost" onClick={() => { setAmount(heldBalance.toFixed(2)); setRefundOpen(true); setAdjustOpen(false); }}>Refund</button>
          </div>
        )}
      </div>

      {adjustOpen && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <select className="input" style={{ width: 160 }} value={billId} onChange={(e) => setBillId(e.target.value)}>
            {bills.map((b) => <option key={b.id} value={b.id}>{b.bill_number} (₹{Number(b.total_amount).toFixed(2)})</option>)}
          </select>
          <input className="input" style={{ width: 100 }} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn btn-primary" onClick={submitAdjust} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
          <button className="btn btn-ghost" onClick={() => setAdjustOpen(false)}>Cancel</button>
        </div>
      )}

      {refundOpen && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 100 }} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="input" style={{ width: 200 }} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-primary" onClick={submitRefund} disabled={saving}>{saving ? 'Saving…' : 'Confirm refund'}</button>
          <button className="btn btn-ghost" onClick={() => setRefundOpen(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

/** Advance-payment collection & disposition — a patient pays a deposit
 * before admission/surgery, and it's later adjusted against the actual bill
 * or refunded if unused. Scoped to the patient (not just this visit), since
 * a deposit collected ahead of a procedure should still be visible once the
 * procedure's own visit/bill exists. */
export function DepositsPanel({ patientId, visitId, bills }: { patientId: string; visitId: string; bills: any[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', purpose: 'admission_advance', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: deposits } = useQuery({
    queryKey: ['deposits', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deposits').select('*').eq('patient_id', patientId).order('collected_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const set = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    const value = Number(form.amount);
    if (!value || value <= 0) return;
    setSaving(true);
    setError(null);
    const { error: collectError } = await collectDeposit(patientId, visitId, value, form.purpose, form.notes, profile?.id);
    setSaving(false);
    if (collectError) { setError(collectError); return; }
    setForm({ amount: '', purpose: 'admission_advance', notes: '' });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['deposits', patientId] });
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['deposits', patientId] });

  const heldTotal = (deposits ?? []).reduce((sum: number, d: any) => sum + (Number(d.amount) - Number(d.adjusted_amount) - Number(d.refunded_amount)), 0);

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Deposits / advances {heldTotal > 0 && <span className="tag tag-accent" style={{ marginLeft: 8 }}>₹{heldTotal.toFixed(2)} held</span>}</h4>
        {!showForm && <button className="btn btn-secondary" onClick={() => setShowForm(true)}>+ Collect deposit</button>}
      </div>

      {showForm && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 1 140px' }}>
            <label>Amount (₹)</label>
            <input className="input" type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '0 1 180px' }}>
            <label>Purpose</label>
            <select className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
              {PURPOSES.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Notes</label>
            <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Collect'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}

      <div style={{ marginTop: 'var(--space-3)' }}>
        {deposits?.length ? deposits.map((d: any) => <DepositRow key={d.id} deposit={d} bills={bills} onChanged={refresh} />) : <p className="text-muted" style={{ fontSize: 13 }}>No deposits collected for this patient yet.</p>}
      </div>
    </div>
  );
}
