import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { BillPaymentControls } from '../../components/BillPaymentControls';
import { DepositsPanel } from '../../components/DepositsPanel';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { BILLING_LINE_ITEMS } from '../commonOptions';
import { advanceVisitStageTo } from '../../lib/advanceVisitStage';
import { printBillingEstimate } from '../../lib/printBillingEstimate';
import type { VisitStage } from '../../lib/types';

interface ItemDraft { description: string; category: string; quantity: string; unit_price: string; }
const emptyItem: ItemDraft = { description: '', category: 'consultation', quantity: '1', unit_price: '' };

function genBillNumber() {
  return `BILL-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

/** Correcting a mistake (wrong quantity/price) currently meant generating a
 * whole second bill alongside the wrong one — bills were create-only in the
 * UI even though RLS already permitted updates. Restricted to unpaid bills
 * so a correction can never silently invalidate a payment already recorded
 * against the old total. */
function EditBillForm({ bill, onDone }: { bill: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<ItemDraft[]>(
    bill.bill_items?.length
      ? bill.bill_items.map((it: any) => ({ description: it.description, category: it.category, quantity: String(it.quantity), unit_price: String(it.unit_price) }))
      : [{ ...emptyItem }]
  );
  const [discount, setDiscount] = useState(String(bill.discount ?? 0));
  const [tax, setTax] = useState(String(bill.tax ?? 0));
  const [insuranceCovered, setInsuranceCovered] = useState(String(bill.insurance_covered ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0) - Number(insuranceCovered || 0));

  const updateItem = (i: number, key: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  };

  const save = async () => {
    const valid = items.filter((it) => it.description.trim());
    if (valid.length === 0) return;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.from('bill_items').delete().eq('bill_id', bill.id);
    if (deleteError) { setSaving(false); setError(deleteError.message); return; }
    const itemRows = valid.map((it) => ({
      bill_id: bill.id,
      description: it.description,
      category: it.category,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));
    const { error: itemsError } = await supabase.from('bill_items').insert(itemRows);
    if (itemsError) { setSaving(false); setError(itemsError.message); return; }
    const { error: updateError } = await supabase.from('bills').update({
      subtotal, discount: Number(discount) || 0, tax: Number(tax) || 0, insurance_covered: Number(insuranceCovered) || 0, total_amount: total,
    }).eq('id', bill.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['bills'] });
    onDone();
  };

  return (
    <div style={{ padding: 8, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)', marginTop: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <div style={{ flex: '2 1 200px' }}><SelectOrOtherInput value={it.description} options={BILLING_LINE_ITEMS} onChange={(v) => updateItem(i, 'description', v)} placeholder="Description" /></div>
          <select className="input" style={{ flex: '1 1 140px' }} value={it.category} onChange={(e) => updateItem(i, 'category', e.target.value)}>
            {['consultation', 'investigation', 'pharmacy', 'optical', 'surgery', 'admission', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input" style={{ flex: '0 1 80px' }} type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
          <input className="input" style={{ flex: '0 1 120px' }} type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>+ Add line item</button>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="field"><label>Discount</label><input className="input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
        <div className="field"><label>Tax / GST</label><input className="input" type="number" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
        <div className="field"><label>Insurance covered</label><input className="input" type="number" value={insuranceCovered} onChange={(e) => setInsuranceCovered(e.target.value)} /></div>
      </div>

      <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-heading)', fontSize: 16 }}>
        Total: ₹{total.toFixed(2)} <span className="text-muted" style={{ fontSize: 12, fontFamily: 'var(--font-body)' }}>(subtotal ₹{subtotal.toFixed(2)})</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save corrections'}</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
    </div>
  );
}

export function BillingStage({ visitId, patientId, stageOrder }: { visitId: string; patientId: string; stageOrder: VisitStage[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<ItemDraft[]>([{ ...emptyItem }]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [insuranceCovered, setInsuranceCovered] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('full_name, uhid').eq('id', patientId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: hospital } = useQuery({
    queryKey: ['hospital-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bills } = useQuery({
    queryKey: ['bills', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('bills').select('*, bill_items(*)').eq('visit_id', visitId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Cross-reference with Insurance Desk instead of billing staff re-typing the same
  // number — pull the most recent approved/settled claim for this visit, if any.
  const { data: approvedClaim } = useQuery({
    queryKey: ['approved-claim', visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_claims')
        .select('*')
        .eq('visit_id', visitId)
        .in('status', ['approved', 'settled'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0) - Number(insuranceCovered || 0));

  const updateItem = (i: number, key: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  };

  const saveBill = async () => {
    const valid = items.filter((it) => it.description.trim());
    if (valid.length === 0) return;
    setSaving(true);
    setError(null);
    const { data: bill, error: billError } = await supabase.from('bills').insert({
      visit_id: visitId,
      patient_id: patientId,
      bill_number: genBillNumber(),
      subtotal,
      discount: Number(discount) || 0,
      tax: Number(tax) || 0,
      insurance_covered: Number(insuranceCovered) || 0,
      total_amount: total,
      payment_method: paymentMethod,
      generated_by: profile?.id,
    }).select().single();
    if (billError || !bill) {
      setSaving(false);
      setError(billError?.message ?? 'Could not create bill.');
      return;
    }
    const itemRows = valid.map((it) => ({
      bill_id: bill.id,
      description: it.description,
      category: it.category,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));
    const { error: itemsError } = await supabase.from('bill_items').insert(itemRows);
    setSaving(false);
    if (itemsError) {
      setError(`Bill created, but line items failed to save: ${itemsError.message}`);
      qc.invalidateQueries({ queryKey: ['bills', visitId] });
      return;
    }
    setItems([{ ...emptyItem }]);
    setDiscount('0'); setTax('0'); setInsuranceCovered('0');
    qc.invalidateQueries({ queryKey: ['bills', visitId] });
    await advanceVisitStageTo(visitId, 'billing', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <DepositsPanel patientId={patientId} visitId={visitId} bills={bills ?? []} />

      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>Generate bill</h4>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <div style={{ flex: '2 1 200px' }}><SelectOrOtherInput value={it.description} options={BILLING_LINE_ITEMS} onChange={(v) => updateItem(i, 'description', v)} placeholder="Description" /></div>
            <select className="input" style={{ flex: '1 1 140px' }} value={it.category} onChange={(e) => updateItem(i, 'category', e.target.value)}>
              {['consultation', 'investigation', 'pharmacy', 'optical', 'surgery', 'admission', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input" style={{ flex: '0 1 80px' }} type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
            <input className="input" style={{ flex: '0 1 120px' }} type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>+ Add line item</button>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Discount</label>
            <input className="input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="field">
            <label>Tax / GST</label>
            <input className="input" type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
          <div className="field">
            <label>Insurance covered</label>
            <input className="input" type="number" value={insuranceCovered} onChange={(e) => setInsuranceCovered(e.target.value)} />
          </div>
          <div className="field">
            <label>Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {['cash', 'card', 'upi', 'insurance', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {approvedClaim && Number(approvedClaim.approved_amount) !== Number(insuranceCovered) && (
          <div className="card" style={{ padding: 'var(--space-2) var(--space-3)', marginTop: 'var(--space-2)', background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Insurance Desk approved ₹{Number(approvedClaim.approved_amount).toFixed(2)} ({approvedClaim.scheme ?? 'claim'}, status {approvedClaim.status}).</span>
            <button type="button" className="btn btn-ghost" onClick={() => setInsuranceCovered(String(approvedClaim.approved_amount))}>Use this amount</button>
          </div>
        )}

        <div style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-heading)', fontSize: 20 }}>
          Total: ₹{total.toFixed(2)} <span className="text-muted" style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>(subtotal ₹{subtotal.toFixed(2)})</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button className="btn btn-primary" onClick={saveBill} disabled={saving}>{saving ? 'Saving…' : 'Generate bill'}</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => printBillingEstimate({
              patientName: patient?.full_name ?? '', patientUhid: patient?.uhid ?? '',
              hospitalName: hospital?.hospital_name, hospitalAddress: hospital?.address, hospitalPhone: hospital?.phone,
              items, discount: Number(discount) || 0, tax: Number(tax) || 0, insuranceCovered: Number(insuranceCovered) || 0,
            })}
          >
            Print estimate
          </button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <div>
        <h4>Bill history</h4>
        {bills?.length ? bills.map((b: any) => (
          <div key={b.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <strong>{b.bill_number} · ₹{Number(b.total_amount).toFixed(2)}</strong>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {b.payment_status === 'unpaid' && editingBillId !== b.id && (
                  <button className="btn btn-ghost" onClick={() => setEditingBillId(b.id)}>Correct bill</button>
                )}
                <BillPaymentControls bill={b} patient={patient ?? undefined} onChanged={() => qc.invalidateQueries({ queryKey: ['bills', visitId] })} />
              </div>
            </div>
            {editingBillId === b.id ? (
              <EditBillForm bill={b} onDone={() => setEditingBillId(null)} />
            ) : (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                {b.bill_items?.map((it: any) => <li key={it.id}>{it.description} × {it.quantity} — ₹{Number(it.amount).toFixed(2)}</li>)}
              </ul>
            )}
          </div>
        )) : <p className="text-muted">No bills yet.</p>}
      </div>
    </div>
  );
}