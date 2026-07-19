import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

interface ItemDraft { description: string; category: string; quantity: string; unit_price: string; }
const emptyItem: ItemDraft = { description: '', category: 'consultation', quantity: '1', unit_price: '' };

function genBillNumber() {
  return `BILL-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

export function BillingStage({ visitId, patientId }: { visitId: string; patientId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<ItemDraft[]>([{ ...emptyItem }]);
  const [discount, setDiscount] = useState('0');
  const [insuranceCovered, setInsuranceCovered] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const { data: bills } = useQuery({
    queryKey: ['bills', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('bills').select('*, bill_items(*)').eq('visit_id', visitId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - Number(discount || 0) - Number(insuranceCovered || 0));

  const updateItem = (i: number, key: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  };

  const saveBill = async () => {
    const valid = items.filter((it) => it.description.trim());
    if (valid.length === 0) return;
    setSaving(true);
    const { data: bill, error } = await supabase.from('bills').insert({
      visit_id: visitId,
      patient_id: patientId,
      bill_number: genBillNumber(),
      subtotal,
      discount: Number(discount) || 0,
      insurance_covered: Number(insuranceCovered) || 0,
      total_amount: total,
      payment_method: paymentMethod,
      generated_by: profile?.id,
    }).select().single();
    if (error || !bill) { setSaving(false); return; }
    const itemRows = valid.map((it) => ({
      bill_id: bill.id,
      description: it.description,
      category: it.category,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));
    await supabase.from('bill_items').insert(itemRows);
    setSaving(false);
    setItems([{ ...emptyItem }]);
    setDiscount('0'); setInsuranceCovered('0');
    qc.invalidateQueries({ queryKey: ['bills', visitId] });
  };

  const markPaid = async (billId: string, amount: number) => {
    await supabase.from('bills').update({ payment_status: 'paid', amount_paid: amount }).eq('id', billId);
    qc.invalidateQueries({ queryKey: ['bills', visitId] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>Generate bill</h4>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <input className="input" style={{ flex: '2 1 200px' }} placeholder="Description" value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
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
          <div className="field"><label>Insurance covered</label><input className="input" type="number" value={insuranceCovered} onChange={(e) => setInsuranceCovered(e.target.value)} /></div>
          <div className="field">
            <label>Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {['cash', 'card', 'upi', 'insurance', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-heading)', fontSize: 20 }}>
          Total: ₹{total.toFixed(2)} <span className="text-muted" style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>(subtotal ₹{subtotal.toFixed(2)})</span>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }} onClick={saveBill} disabled={saving}>{saving ? 'Saving…' : 'Generate bill'}</button>
      </div>

      <div>
        <h4>Bill history</h4>
        {bills?.length ? bills.map((b: any) => (
          <div key={b.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{b.bill_number}</strong> · ₹{Number(b.total_amount).toFixed(2)}
                <span className={`tag ${b.payment_status === 'paid' ? 'tag-accent' : 'tag-outline'}`} style={{ marginLeft: 8 }}>{b.payment_status}</span>
              </div>
              {b.payment_status !== 'paid' && (
                <button className="btn btn-ghost" onClick={() => markPaid(b.id, Number(b.total_amount))}>Mark paid</button>
              )}
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {b.bill_items?.map((it: any) => <li key={it.id}>{it.description} × {it.quantity} — ₹{Number(it.amount).toFixed(2)}</li>)}
            </ul>
          </div>
        )) : <p className="text-muted">No bills yet.</p>}
      </div>
    </div>
  );
}
