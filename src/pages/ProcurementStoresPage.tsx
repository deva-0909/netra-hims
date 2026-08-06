import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { printPurchaseOrder } from '../lib/printPurchaseOrder';
import { VendorPaymentControls } from '../components/VendorPaymentControls';

const VENDOR_CATEGORIES = ['equipment', 'pharmacy', 'optical', 'general_supplies', 'services', 'other'];
const STORES_CATEGORIES = ['linen', 'stationery', 'surgical_consumable', 'ppe', 'cleaning_supplies', 'other'];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: {}, issued: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
  partially_received: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  received: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  cancelled: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  pending: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  approved: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  rejected: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  converted_to_po: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
  unbilled: {},
  unpaid: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  partially_paid: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  paid: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
};

// ---------------- Vendors ----------------

function AddVendorForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', category: 'general_supplies', contact_person: '', phone: '', email: '', address: '', gstin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('vendors').insert({
      name: form.name, category: form.category, contact_person: form.contact_person || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null,
      gstin: form.gstin || null, created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['vendors'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add vendor</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Name *</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Contact person</label><input className="input" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>GSTIN</label><input className="input" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add vendor'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function VendorsTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Suppliers for equipment AMC/CMC, drugs, eyewear, consumables and services.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add vendor</button>}
      </div>
      {showForm && <AddVendorForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Contact</th><th>Phone / Email</th><th>GSTIN</th></tr></thead>
          <tbody>
            {vendors?.map((v: any) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.category.replace(/_/g, ' ')}</td>
                <td>{v.contact_person ?? '—'}</td>
                <td className="text-muted">{v.phone ?? '—'} {v.email ? `· ${v.email}` : ''}</td>
                <td>{v.gstin ?? '—'}</td>
              </tr>
            ))}
            {vendors?.length === 0 && <tr><td colSpan={5} className="text-muted">No vendors registered yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Purchase Orders ----------------

interface POLine { item_description: string; quantity: string; unit: string; unit_price: string }

function CreatePOForm({ vendors, requisitions, onDone }: { vendors: any[]; requisitions: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ po_number: '', vendor_id: '', expected_delivery_date: '', notes: '', requisition_id: '' });
  const [lines, setLines] = useState<POLine[]>([{ item_description: '', quantity: '1', unit: '', unit_price: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const setLine = (i: number, k: keyof POLine, v: string) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const linkRequisition = (id: string) => {
    set('requisition_id', id);
    const req = requisitions.find((r) => r.id === id);
    if (req) setLines([{ item_description: req.item_description, quantity: String(req.quantity), unit: req.unit ?? '', unit_price: '' }]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.item_description.trim() && Number(l.quantity) > 0);
    if (!form.po_number.trim() || !form.vendor_id || validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
      po_number: form.po_number, vendor_id: form.vendor_id, expected_delivery_date: form.expected_delivery_date || null,
      status: 'issued', notes: form.notes || null, created_by: profile?.id, requisition_id: form.requisition_id || null,
    }).select().single();
    if (poError || !po) { setSaving(false); setError(poError?.message ?? 'Could not create purchase order.'); return; }
    const { error: itemsError } = await supabase.from('purchase_order_items').insert(
      validLines.map((l) => ({
        po_id: po.id, item_description: l.item_description, quantity: Number(l.quantity),
        unit: l.unit || null, unit_price: l.unit_price ? Number(l.unit_price) : null,
      })),
    );
    setSaving(false);
    if (itemsError) { setError(itemsError.message); return; }
    if (form.requisition_id) {
      await supabase.from('purchase_requisitions').update({ status: 'converted_to_po' }).eq('id', form.requisition_id);
      qc.invalidateQueries({ queryKey: ['requisitions'] });
      qc.invalidateQueries({ queryKey: ['requisitions-approved'] });
    }
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Create purchase order</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}><label>PO number *</label><input className="input" value={form.po_number} onChange={(e) => set('po_number', e.target.value)} placeholder="PO-2026-0001" required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Vendor *</label>
          <select className="input" value={form.vendor_id} onChange={(e) => set('vendor_id', e.target.value)} required>
            <option value="">Select…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Link to requisition (optional)</label>
          <select className="input" value={form.requisition_id} onChange={(e) => linkRequisition(e.target.value)}>
            <option value="">— none —</option>
            {requisitions.map((r) => <option key={r.id} value={r.id}>{r.item_description} ({r.quantity}{r.unit ? ` ${r.unit}` : ''})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Expected delivery</label><input className="input" type="date" value={form.expected_delivery_date} onChange={(e) => set('expected_delivery_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>

      <h5 style={{ marginTop: 14, marginBottom: 6 }}>Line items</h5>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 220px' }}><label>Item</label><input className="input" value={l.item_description} onChange={(e) => setLine(i, 'item_description', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 90px' }}><label>Qty</label><input className="input" type="number" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 90px' }}><label>Unit</label><input className="input" value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} placeholder="box / pc" /></div>
          <div className="field" style={{ flex: '1 1 110px' }}><label>Unit price (₹)</label><input className="input" type="number" value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} /></div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => setLines((prev) => [...prev, { item_description: '', quantity: '1', unit: '', unit_price: '' }])}>+ Add line</button>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create & issue PO'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ReceivePOForm({ po, items, stores, onDone }: { po: any; items: any[]; stores: any[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [received, setReceived] = useState<Record<string, string>>(
    Object.fromEntries(items.map((it) => [it.id, String(it.quantity - it.received_quantity)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    for (const it of items) {
      const qty = Number(received[it.id] || 0);
      if (qty <= 0) continue;
      const newReceived = Math.min(it.quantity, it.received_quantity + qty);
      const { error: itemError } = await supabase.from('purchase_order_items').update({ received_quantity: newReceived }).eq('id', it.id);
      if (itemError) { setSaving(false); setError(itemError.message); return; }
      if (it.stores_item_id) {
        const storeItem = stores.find((s) => s.id === it.stores_item_id);
        if (storeItem) {
          await supabase.from('general_stores_inventory').update({ stock_qty: Number(storeItem.stock_qty) + qty }).eq('id', it.stores_item_id);
        }
      }
    }
    const { data: refreshedItems } = await supabase.from('purchase_order_items').select('quantity, received_quantity').eq('po_id', po.id);
    const allReceived = (refreshedItems ?? []).every((it: any) => it.received_quantity >= it.quantity);
    const someReceived = (refreshedItems ?? []).some((it: any) => it.received_quantity > 0);
    await supabase.from('purchase_orders').update({ status: allReceived ? 'received' : someReceived ? 'partially_received' : po.status }).eq('id', po.id);
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    onDone();
  };

  return (
    <div style={{ padding: 'var(--space-3)', background: 'var(--color-accent-100)' }}>
      <h5 style={{ marginTop: 0 }}>Receive shipment</h5>
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ flex: '1 1 240px', fontSize: 13 }}>{it.item_description} <span className="text-muted">({it.received_quantity}/{it.quantity} {it.unit ?? ''} received)</span></div>
          <input className="input" style={{ width: 100 }} type="number" min={0} max={it.quantity - it.received_quantity}
            value={received[it.id] ?? '0'} onChange={(e) => setReceived((prev) => ({ ...prev, [it.id]: e.target.value }))} />
        </div>
      ))}
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm receipt'}</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function PORow({ po }: { po: any }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const { data: items } = useQuery({
    queryKey: ['po-items', po.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_order_items').select('*').eq('po_id', po.id);
      if (error) throw error;
      return data;
    },
  });
  const { data: stores } = useQuery({
    queryKey: ['general-stores'],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('general_stores_inventory').select('*');
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {po.po_number}</button></td>
        <td>{po.vendors?.name}</td>
        <td>{po.order_date}</td>
        <td>{po.expected_delivery_date ?? '—'}</td>
        <td><span className="tag tag-outline" style={STATUS_STYLE[po.status]}>{po.status.replace(/_/g, ' ')}</span></td>
        <td><span className="tag tag-outline" style={STATUS_STYLE[po.payment_status]}>{po.payment_status.replace(/_/g, ' ')}</span></td>
        <td><button className="btn btn-ghost" onClick={() => printPurchaseOrder(po)}>Print PO</button></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <table className="table" style={{ marginBottom: 8 }}>
                <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Received</th></tr></thead>
                <tbody>
                  {items?.map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.item_description}</td>
                      <td>{it.quantity} {it.unit ?? ''}</td>
                      <td>{it.unit_price ? `₹${Number(it.unit_price).toLocaleString()}` : '—'}</td>
                      <td>{it.received_quantity}/{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {po.notes && <p className="text-muted" style={{ fontSize: 13 }}>{po.notes}</p>}
              {po.status !== 'received' && po.status !== 'cancelled' && (showReceive
                ? <ReceivePOForm po={po} items={items ?? []} stores={stores ?? []} onDone={() => setShowReceive(false)} />
                : <button className="btn btn-secondary" onClick={() => setShowReceive(true)}>Receive shipment</button>)}

              <h5 style={{ marginTop: 16, marginBottom: 4 }}>Vendor invoice & payment</h5>
              <VendorPaymentControls po={po} onChanged={() => qc.invalidateQueries({ queryKey: ['purchase-orders'] })} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PurchaseOrdersTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: pos, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_orders').select('*, vendors(name)').order('order_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
  const { data: approvedRequisitions } = useQuery({
    queryKey: ['requisitions-approved'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_requisitions').select('*').eq('status', 'approved').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Orders issued to vendors — receive shipments here to update stock automatically.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Create PO</button>}
      </div>
      {showForm && <CreatePOForm vendors={vendors ?? []} requisitions={approvedRequisitions ?? []} onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>PO #</th><th>Vendor</th><th>Order date</th><th>Expected</th><th>Status</th><th>Payment</th><th /></tr></thead>
          <tbody>
            {pos?.map((po: any) => <PORow key={po.id} po={po} />)}
            {pos?.length === 0 && <tr><td colSpan={7} className="text-muted">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Requisitions ----------------

function AddRequisitionForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ department: '', item_description: '', quantity: '1', unit: '', estimated_cost: '', urgency: 'routine', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_description.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('purchase_requisitions').insert({
      requested_by: profile?.id, department: form.department || null, item_description: form.item_description,
      quantity: Number(form.quantity) || 1, unit: form.unit || null,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null, urgency: form.urgency, notes: form.notes || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['requisitions'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log a requisition</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>For a request that came in from a department (call, email, in person).</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Item *</label><input className="input" value={form.item_description} onChange={(e) => set('item_description', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 90px' }}><label>Qty</label><input className="input" type="number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 90px' }}><label>Unit</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Est. cost (₹)</label><input className="input" type="number" value={form.estimated_cost} onChange={(e) => set('estimated_cost', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label>Urgency</label>
          <select className="input" value={form.urgency} onChange={(e) => set('urgency', e.target.value)}>
            <option value="routine">routine</option><option value="urgent">urgent</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log requisition'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function RequisitionsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: reqs, isLoading } = useQuery({
    queryKey: ['requisitions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_requisitions').select('*, profiles(full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const decide = async (id: string, status: string) => {
    await supabase.from('purchase_requisitions').update({ status, approved_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['requisitions'] });
    qc.invalidateQueries({ queryKey: ['requisitions-approved'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Requests for stock — approve, then create a matching PO from the Purchase Orders tab.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log requisition</button>}
      </div>
      {showForm && <AddRequisitionForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Item</th><th>Dept.</th><th>Qty</th><th>Urgency</th><th>Requested by</th><th>Status</th><th /></tr></thead>
          <tbody>
            {reqs?.map((r: any) => (
              <tr key={r.id}>
                <td>{r.item_description}</td>
                <td>{r.department ?? '—'}</td>
                <td>{r.quantity} {r.unit ?? ''}</td>
                <td><span className="tag tag-outline" style={r.urgency === 'urgent' ? { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' } : undefined}>{r.urgency}</span></td>
                <td>{r.profiles?.full_name ?? '—'}</td>
                <td><span className="tag tag-outline" style={STATUS_STYLE[r.status]}>{r.status.replace(/_/g, ' ')}</span></td>
                <td>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost" onClick={() => decide(r.id, 'approved')}>Approve</button>
                      <button className="btn btn-ghost" onClick={() => decide(r.id, 'rejected')}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {reqs?.length === 0 && <tr><td colSpan={7} className="text-muted">No requisitions logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- General Stores ----------------

function AddStoreItemForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ item_name: '', category: 'surgical_consumable', unit: '', stock_qty: '0', reorder_level: '10', unit_price: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('general_stores_inventory').insert({
      item_name: form.item_name, category: form.category, unit: form.unit || null,
      stock_qty: Number(form.stock_qty) || 0, reorder_level: Number(form.reorder_level) || 0,
      unit_price: form.unit_price ? Number(form.unit_price) : null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add store item</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Item name *</label><input className="input" value={form.item_name} onChange={(e) => set('item_name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {STORES_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 90px' }}><label>Unit</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="box / pc" /></div>
        <div className="field" style={{ flex: '1 1 100px' }}><label>Opening stock</label><input className="input" type="number" value={form.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Reorder level</label><input className="input" type="number" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Unit price (₹)</label><input className="input" type="number" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add item'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function IssueStockForm({ item, onDone }: { item: any; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [department, setDepartment] = useState('');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amount = Number(qty);
    if (!amount || amount <= 0 || amount > item.stock_qty || !department.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('stock_issue_notes').insert({
      item_id: item.id, department, quantity_issued: amount, issued_by: profile?.id,
    });
    if (insertError) { setSaving(false); setError(insertError.message); return; }
    const { error: updateError } = await supabase.from('general_stores_inventory').update({ stock_qty: item.stock_qty - amount }).eq('id', item.id);
    setSaving(false);
    if (updateError) { setError(`Issue logged, but stock count didn't update: ${updateError.message}`); return; }
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    qc.invalidateQueries({ queryKey: ['stock-issues'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="input" style={{ width: 140 }} placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />
      <input className="input" style={{ width: 80 }} type="number" min={1} max={item.stock_qty} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

function StoreItemRow({ item }: { item: any }) {
  const [issuing, setIssuing] = useState(false);
  const lowStock = item.stock_qty <= item.reorder_level;

  return (
    <tr>
      <td>{item.item_name}</td>
      <td>{item.category.replace(/_/g, ' ')}</td>
      <td><span className={lowStock ? 'tag tag-outline' : ''} style={lowStock ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>{item.stock_qty} {item.unit ?? ''}</span></td>
      <td>{item.reorder_level}</td>
      <td>{issuing ? <IssueStockForm item={item} onDone={() => setIssuing(false)} /> : <button className="btn btn-secondary" onClick={() => setIssuing(true)} disabled={item.stock_qty <= 0}>Issue stock</button>}</td>
    </tr>
  );
}

function GeneralStoresTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: items, isLoading } = useQuery({
    queryKey: ['general-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('general_stores_inventory').select('*').order('item_name');
      if (error) throw error;
      return data;
    },
  });
  const { data: recentIssues } = useQuery({
    queryKey: ['stock-issues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_issue_notes').select('*, general_stores_inventory(item_name)').order('created_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Linen, stationery, surgical consumables, PPE and cleaning supplies — everything pharmacy/optical inventory doesn't cover.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add item</button>}
      </div>
      {showForm && <AddStoreItemForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Reorder at</th><th /></tr></thead>
          <tbody>
            {items?.map((it: any) => <StoreItemRow key={it.id} item={it} />)}
            {items?.length === 0 && <tr><td colSpan={5} className="text-muted">No items in general stores yet.</td></tr>}
          </tbody>
        </table>
      )}
      <h4 style={{ marginTop: 'var(--space-6)' }}>Recent stock issued</h4>
      {recentIssues?.length ? (
        <ul style={{ paddingLeft: 18, fontSize: 13 }}>
          {recentIssues.map((r: any) => (
            <li key={r.id}>-{r.quantity_issued} {r.general_stores_inventory?.item_name} to {r.department} — {new Date(r.created_at).toLocaleString()}</li>
          ))}
        </ul>
      ) : <p className="text-muted">No stock issued yet.</p>}
    </div>
  );
}

// ---------------- Page ----------------

export function ProcurementStoresPage() {
  const [tab, setTab] = useState<'vendors' | 'orders' | 'requisitions' | 'stores'>('orders');
  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'orders', label: 'Purchase Orders' },
    { key: 'requisitions', label: 'Requisitions' },
    { key: 'stores', label: 'General Stores' },
    { key: 'vendors', label: 'Vendors' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Procurement & Stores</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Vendors, purchase orders and the general stores that keep the hospital supplied.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vendors' && <VendorsTab />}
      {tab === 'orders' && <PurchaseOrdersTab />}
      {tab === 'requisitions' && <RequisitionsTab />}
      {tab === 'stores' && <GeneralStoresTab />}
    </div>
  );
}
