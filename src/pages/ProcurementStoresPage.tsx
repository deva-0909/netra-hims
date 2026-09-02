import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { printPurchaseOrder } from '../lib/printPurchaseOrder';
import { printGoodsReceivedNote } from '../lib/printGoodsReceivedNote';
import { VendorPaymentControls } from '../components/VendorPaymentControls';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';

const VENDOR_CATEGORIES = ['equipment', 'pharmacy', 'optical', 'general_supplies', 'services', 'other'];
const STORES_CATEGORIES = ['linen', 'stationery', 'surgical_consumable', 'ppe', 'cleaning_supplies', 'other'];
const WRITEOFF_REASONS = ['expired', 'damaged', 'lost_or_stolen', 'count_correction', 'other'];
const ITEM_TYPES = [
  { value: 'general_store', label: 'General store item' },
  { value: 'drug', label: 'Pharmacy drug' },
  { value: 'eyewear', label: 'Optical/eyewear item' },
  { value: 'other', label: 'Other (not stock-tracked)' },
];
const GST_SLABS = ['0', '5', '12', '18', '28'];

// Requires admin sign-off above this value to issue a PO — enforced by
// trg_enforce_po_issue_threshold in the database, this constant just keeps
// the UI's error/hint text in sync with it.
const PO_APPROVAL_THRESHOLD = 50000;

function useDepartmentNames(): string[] {
  const { data } = useQuery({
    queryKey: ['departments-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('name').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
  return (data ?? []).map((d: any) => d.name);
}

function lineAmount(l: { quantity: string | number; unit_price: string | number; tax_percent?: string | number }) {
  const qty = Number(l.quantity) || 0;
  const price = Number(l.unit_price) || 0;
  const tax = Number(l.tax_percent ?? 0) || 0;
  return qty * price * (1 + tax / 100);
}

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

function EditVendorForm({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: vendor.name ?? '', category: vendor.category ?? 'general_supplies', contact_person: vendor.contact_person ?? '',
    phone: vendor.phone ?? '', email: vendor.email ?? '', address: vendor.address ?? '', gstin: vendor.gstin ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('vendors').update({
      name: form.name, category: form.category, contact_person: form.contact_person || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null, gstin: form.gstin || null,
    }).eq('id', vendor.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['vendors-all'] });
    qc.invalidateQueries({ queryKey: ['vendors'] });
    onDone();
  };

  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--color-accent-100)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 180px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Contact person</label><input className="input" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>GSTIN</label><input className="input" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 100%', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
          {error && <span style={{ color: '#b64545', fontSize: 12 }}>{error}</span>}
        </div>
      </td>
    </tr>
  );
}

function VendorsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = async (v: any) => {
    await supabase.from('vendors').update({ active: !v.active }).eq('id', v.id);
    qc.invalidateQueries({ queryKey: ['vendors-all'] });
    qc.invalidateQueries({ queryKey: ['vendors'] });
  };

  const term = search.trim().toLowerCase();
  const filtered = (vendors ?? []).filter((v: any) => !term || v.name?.toLowerCase().includes(term) || v.contact_person?.toLowerCase().includes(term) || v.category?.toLowerCase().includes(term));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Suppliers for equipment AMC/CMC, drugs, eyewear, consumables and services.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add vendor</button>}
      </div>
      {showForm && <AddVendorForm onDone={() => setShowForm(false)} />}
      <div className="field" style={{ maxWidth: 300, marginBottom: 12 }}>
        <label>Search</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, contact or category" />
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Contact</th><th>Phone / Email</th><th>GSTIN</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((v: any) => (
              editingId === v.id ? <EditVendorForm key={v.id} vendor={v} onDone={() => setEditingId(null)} /> : (
                <tr key={v.id} style={v.active ? undefined : { opacity: 0.6 }}>
                  <td>{v.name}</td>
                  <td>{v.category.replace(/_/g, ' ')}</td>
                  <td>{v.contact_person ?? '—'}</td>
                  <td className="text-muted">{v.phone ?? '—'} {v.email ? `· ${v.email}` : ''}</td>
                  <td>{v.gstin ?? '—'}</td>
                  <td><span className={`tag ${v.active ? 'tag-accent' : 'tag-outline'}`}>{v.active ? 'active' : 'inactive'}</span></td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" onClick={() => setEditingId(v.id)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => toggleActive(v)}>{v.active ? 'Deactivate' : 'Reactivate'}</button>
                  </td>
                </tr>
              )
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No vendors match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Purchase Orders ----------------

interface POLine {
  item_type: string;
  ref_id: string;
  item_description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  tax_percent: string;
}

const emptyLine = (): POLine => ({ item_type: 'general_store', ref_id: '', item_description: '', quantity: '1', unit: '', unit_price: '', tax_percent: '0' });

function describeRefItem(type: string, item: any): string {
  if (type === 'general_store') return item.item_name;
  if (type === 'drug') return `${item.name}${item.strength ? ' ' + item.strength : ''}${item.form ? ` (${item.form})` : ''}`;
  if (type === 'eyewear') return `${item.brand} ${item.model}`;
  return '';
}

function CreatePOForm({ vendors, requisitions, onDone }: { vendors: any[]; requisitions: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ po_number: '', vendor_id: '', expected_delivery_date: '', notes: '' });
  const [lines, setLines] = useState<POLine[]>([emptyLine()]);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const setLine = (i: number, k: keyof POLine, v: string) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const { data: storeItems } = useQuery({
    queryKey: ['general-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('general_stores_inventory').select('id, item_name, unit').order('item_name');
      if (error) throw error;
      return data;
    },
  });
  const { data: drugsList } = useQuery({
    queryKey: ['drugs-for-po'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drugs').select('id, name, form, strength').order('name');
      if (error) throw error;
      return data;
    },
  });
  const { data: eyewearList } = useQuery({
    queryKey: ['eyewear-for-po'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eyewear_items').select('id, brand, model').order('brand');
      if (error) throw error;
      return data;
    },
  });

  const itemsForType = (type: string): any[] => (type === 'general_store' ? storeItems : type === 'drug' ? drugsList : type === 'eyewear' ? eyewearList : []) ?? [];

  const selectRefItem = (i: number, id: string) => {
    const type = lines[i].item_type;
    const item = itemsForType(type).find((it) => it.id === id);
    setLines((prev) => prev.map((l, idx) => (idx === i ? {
      ...l,
      ref_id: id,
      item_description: item ? describeRefItem(type, item) : l.item_description,
      unit: item && type === 'general_store' ? (item.unit ?? '') : l.unit,
    } : l)));
  };

  const toggleRequisition = (id: string) => {
    setSelectedReqIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const req = requisitions.find((r) => r.id === id);
      if (req) setLines((ls) => [...ls, { ...emptyLine(), item_type: 'other', item_description: req.item_description, quantity: String(req.quantity), unit: req.unit ?? '' }]);
      return [...prev, id];
    });
  };

  const total = lines.reduce((sum, l) => sum + lineAmount(l), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.item_description.trim() && Number(l.quantity) > 0);
    if (!form.po_number.trim() || !form.vendor_id || validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
      po_number: form.po_number, vendor_id: form.vendor_id, expected_delivery_date: form.expected_delivery_date || null,
      status: 'draft', notes: form.notes || null, created_by: profile?.id, requisition_id: selectedReqIds[0] || null,
    }).select().single();
    if (poError || !po) { setSaving(false); setError(poError?.message ?? 'Could not create purchase order.'); return; }
    const { error: itemsError } = await supabase.from('purchase_order_items').insert(
      validLines.map((l) => ({
        po_id: po.id,
        item_type: l.item_type,
        stores_item_id: l.item_type === 'general_store' && l.ref_id ? l.ref_id : null,
        drug_id: l.item_type === 'drug' && l.ref_id ? l.ref_id : null,
        eyewear_item_id: l.item_type === 'eyewear' && l.ref_id ? l.ref_id : null,
        item_description: l.item_description, quantity: Number(l.quantity),
        unit: l.unit || null, unit_price: l.unit_price ? Number(l.unit_price) : null,
        tax_percent: Number(l.tax_percent) || 0,
      })),
    );
    if (itemsError) { setSaving(false); setError(itemsError.message); return; }
    if (selectedReqIds.length > 0) {
      await supabase.from('po_requisition_links').insert(selectedReqIds.map((rid) => ({ po_id: po.id, requisition_id: rid })));
      await supabase.from('purchase_requisitions').update({ status: 'converted_to_po' }).in('id', selectedReqIds);
      qc.invalidateQueries({ queryKey: ['requisitions'] });
      qc.invalidateQueries({ queryKey: ['requisitions-approved'] });
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Create purchase order</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>Created as a draft — a separate "Issue" step sends it to the vendor (orders of &#8377;{PO_APPROVAL_THRESHOLD.toLocaleString()}+ need admin to issue).</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}><label>PO number *</label><input className="input" value={form.po_number} onChange={(e) => set('po_number', e.target.value)} placeholder="PO-2026-0001" required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Vendor *</label>
          <select className="input" value={form.vendor_id} onChange={(e) => set('vendor_id', e.target.value)} required>
            <option value="">Select…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Expected delivery</label><input className="input" type="date" value={form.expected_delivery_date} onChange={(e) => set('expected_delivery_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>

      {requisitions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Consolidate approved requisitions (optional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            {requisitions.map((r) => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={selectedReqIds.includes(r.id)} onChange={() => toggleRequisition(r.id)} />
                {r.item_description} ({r.quantity}{r.unit ? ` ${r.unit}` : ''})
              </label>
            ))}
          </div>
        </div>
      )}

      <h5 style={{ marginTop: 14, marginBottom: 6 }}>Line items</h5>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 150px' }}>
            <label>Item type</label>
            <select className="input" value={l.item_type} onChange={(e) => { setLine(i, 'item_type', e.target.value); setLine(i, 'ref_id', ''); }}>
              {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {l.item_type !== 'other' && (
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label>Linked item</label>
              <select className="input" value={l.ref_id} onChange={(e) => selectRefItem(i, e.target.value)}>
                <option value="">— type manually —</option>
                {itemsForType(l.item_type).map((it: any) => <option key={it.id} value={it.id}>{describeRefItem(l.item_type, it)}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ flex: '2 1 200px' }}><label>Description</label><input className="input" value={l.item_description} onChange={(e) => setLine(i, 'item_description', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 80px' }}><label>Qty</label><input className="input" type="number" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 80px' }}><label>Unit</label><input className="input" value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} placeholder="box / pc" /></div>
          <div className="field" style={{ flex: '1 1 100px' }}><label>Unit price (₹)</label><input className="input" type="number" value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 80px' }}>
            <label>GST %</label>
            <select className="input" value={l.tax_percent} onChange={(e) => setLine(i, 'tax_percent', e.target.value)}>
              {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
          <div className="text-muted" style={{ fontSize: 12, flex: '1 1 90px', paddingBottom: 8 }}>&#8377;{lineAmount(l).toFixed(2)}</div>
          {lines.length > 1 && <button type="button" className="btn btn-ghost" style={{ paddingBottom: 8 }} onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>}
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => setLines((prev) => [...prev, emptyLine()])}>+ Add line</button>
      <div style={{ marginTop: 6, fontWeight: 600, fontSize: 14 }}>Total: &#8377;{total.toFixed(2)}</div>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create PO (draft)'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ReceivePOForm({ po, items, stores, onDone }: { po: any; items: any[]; stores: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [received, setReceived] = useState<Record<string, string>>(
    Object.fromEntries(items.map((it) => [it.id, String(it.quantity - it.received_quantity)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const receivedLines: { item_description: string; unit: string | null; quantity_received: number }[] = [];
    for (const it of items) {
      const qty = Number(received[it.id] || 0);
      if (qty <= 0) continue;
      const newReceived = Math.min(it.quantity, it.received_quantity + qty);
      const { error: itemError } = await supabase.from('purchase_order_items').update({ received_quantity: newReceived }).eq('id', it.id);
      if (itemError) { setSaving(false); setError(itemError.message); return; }
      receivedLines.push({ item_description: it.item_description, unit: it.unit, quantity_received: qty });

      if (it.item_type === 'general_store' && it.stores_item_id) {
        const storeItem = stores.find((s) => s.id === it.stores_item_id);
        if (storeItem) await supabase.from('general_stores_inventory').update({ stock_qty: Number(storeItem.stock_qty) + qty }).eq('id', it.stores_item_id);
      } else if (it.item_type === 'drug' && it.drug_id) {
        const { data: drug } = await supabase.from('drugs').select('stock_qty').eq('id', it.drug_id).maybeSingle();
        if (drug) await supabase.from('drugs').update({ stock_qty: Number(drug.stock_qty) + qty }).eq('id', it.drug_id);
        await supabase.from('stock_receipts').insert({ drug_id: it.drug_id, quantity_received: qty, note: `Received via PO ${po.po_number}`, received_by: profile?.id });
      } else if (it.item_type === 'eyewear' && it.eyewear_item_id) {
        const { data: eyewear } = await supabase.from('eyewear_items').select('stock_qty').eq('id', it.eyewear_item_id).maybeSingle();
        if (eyewear) await supabase.from('eyewear_items').update({ stock_qty: Number(eyewear.stock_qty) + qty }).eq('id', it.eyewear_item_id);
        await supabase.from('eyewear_stock_receipts').insert({ item_id: it.eyewear_item_id, quantity_received: qty, note: `Received via PO ${po.po_number}`, received_by: profile?.id });
      }
    }
    const { data: refreshedItems } = await supabase.from('purchase_order_items').select('quantity, received_quantity').eq('po_id', po.id);
    const allReceived = (refreshedItems ?? []).every((it: any) => it.received_quantity >= it.quantity);
    const someReceived = (refreshedItems ?? []).some((it: any) => it.received_quantity > 0);
    await supabase.from('purchase_orders').update({ status: allReceived ? 'received' : someReceived ? 'partially_received' : po.status }).eq('id', po.id);
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    if (receivedLines.length > 0) printGoodsReceivedNote(po, receivedLines, profile?.full_name ?? null);
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
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm receipt & print GRN'}</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function CancelPOForm({ po, onDone }: { po: any; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('purchase_orders').update({
      status: 'cancelled', cancel_reason: reason, cancelled_by: profile?.id, cancelled_at: new Date().toISOString(),
    }).eq('id', po.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
      <input className="input" style={{ flex: '1 1 220px' }} placeholder="Reason for cancellation (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn btn-primary" onClick={submit} disabled={saving || !reason.trim()}>{saving ? 'Cancelling…' : 'Confirm cancel'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Back</button>
      {error && <span style={{ color: '#b64545', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function PORow({ po }: { po: any }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

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
  const { data: linkedRequisitions } = useQuery({
    queryKey: ['po-requisition-links', po.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('po_requisition_links').select('purchase_requisitions(item_description, quantity, unit)').eq('po_id', po.id);
      if (error) throw error;
      return data;
    },
  });

  const total = (items ?? []).reduce((sum: number, it: any) => sum + lineAmount(it), 0);

  const issuePO = async () => {
    setIssuing(true);
    setIssueError(null);
    const { error } = await supabase.from('purchase_orders').update({ status: 'issued' }).eq('id', po.id);
    setIssuing(false);
    if (error) { setIssueError(error.message); return; }
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
  };

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
                <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>GST</th><th>Amount</th><th>Received</th></tr></thead>
                <tbody>
                  {items?.map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.item_description}</td>
                      <td>{it.quantity} {it.unit ?? ''}</td>
                      <td>{it.unit_price ? `₹${Number(it.unit_price).toLocaleString()}` : '—'}</td>
                      <td>{Number(it.tax_percent) > 0 ? `${it.tax_percent}%` : '—'}</td>
                      <td>₹{lineAmount(it).toFixed(2)}</td>
                      <td>{it.received_quantity}/{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td><td style={{ fontWeight: 600 }}>₹{total.toFixed(2)}</td><td /></tr></tfoot>
              </table>
              {linkedRequisitions && linkedRequisitions.length > 0 && (
                <p className="text-muted" style={{ fontSize: 12 }}>
                  From requisitions: {linkedRequisitions.map((l: any) => `${l.purchase_requisitions.item_description} (${l.purchase_requisitions.quantity}${l.purchase_requisitions.unit ? ` ${l.purchase_requisitions.unit}` : ''})`).join(', ')}
                </p>
              )}
              {po.notes && <p className="text-muted" style={{ fontSize: 13 }}>{po.notes}</p>}

              {po.status === 'draft' && (
                <div style={{ marginBottom: 8 }}>
                  <button className="btn btn-primary" onClick={issuePO} disabled={issuing}>{issuing ? 'Issuing…' : 'Issue PO to vendor'}</button>
                  {issueError && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{issueError}</div>}
                </div>
              )}

              {(po.status === 'draft' || po.status === 'issued' || po.status === 'partially_received') && (
                showCancel
                  ? <CancelPOForm po={po} onDone={() => setShowCancel(false)} />
                  : <button className="btn btn-ghost" onClick={() => setShowCancel(true)} style={{ marginBottom: 8 }}>{po.status === 'partially_received' ? 'Cancel remainder' : 'Cancel PO'}</button>
              )}

              {po.status === 'cancelled' && (
                <p style={{ color: '#8a2c2c', fontSize: 13 }}>Cancelled {po.cancelled_at ? new Date(po.cancelled_at).toLocaleString() : ''} — {po.cancel_reason}</p>
              )}

              {(po.status === 'issued' || po.status === 'partially_received') && (showReceive
                ? <ReceivePOForm po={po} items={items ?? []} stores={stores ?? []} onDone={() => setShowReceive(false)} />
                : <button className="btn btn-secondary" onClick={() => setShowReceive(true)}>Receive shipment</button>)}

              <h5 style={{ marginTop: 16, marginBottom: 4 }}>Vendor invoice & payment</h5>
              <p className="text-muted" style={{ fontSize: 12, marginTop: -4 }}>PO total (incl. GST): ₹{total.toFixed(2)}</p>
              <VendorPaymentControls po={po} onChanged={() => qc.invalidateQueries({ queryKey: ['purchase-orders'] })} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const PO_STATUSES = ['draft', 'issued', 'partially_received', 'received', 'cancelled'];
type POStatusFilter = 'active' | 'all' | (typeof PO_STATUSES)[number];

function PurchaseOrdersTab() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatusFilter>('active');
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

  const term = search.trim().toLowerCase();
  const filtered = (pos ?? []).filter((po: any) => {
    if (statusFilter === 'active' && (po.status === 'received' || po.status === 'cancelled')) return false;
    if (statusFilter !== 'active' && statusFilter !== 'all' && po.status !== statusFilter) return false;
    if (!term) return true;
    return po.po_number?.toLowerCase().includes(term) || po.vendors?.name?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Created as a draft, then issued to the vendor — receiving updates drug/eyewear/general-store stock automatically when the line is linked to one.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Create PO</button>}
      </div>
      {showForm && <CreatePOForm vendors={vendors ?? []} requisitions={approvedRequisitions ?? []} onDone={() => setShowForm(false)} />}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="PO # or vendor" />
        </div>
        <div className="seg" style={{ maxWidth: 560 }}>
          {(['active', 'all', ...PO_STATUSES] as POStatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>PO #</th><th>Vendor</th><th>Order date</th><th>Expected</th><th>Status</th><th>Payment</th><th /></tr></thead>
          <tbody>
            {filtered.map((po: any) => <PORow key={po.id} po={po} />)}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No purchase orders match.</td></tr>}
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
  const departments = useDepartmentNames();
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
        <div className="field" style={{ flex: '1 1 200px' }}><label>Department</label><SelectOrOtherInput value={form.department} options={departments} onChange={(v) => set('department', v)} placeholder="Department name" /></div>
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

function RequisitionRow({ r }: { r: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const isOwnRequest = r.requested_by === profile?.id;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['requisitions'] });
    qc.invalidateQueries({ queryKey: ['requisitions-approved'] });
  };

  const approve = async () => {
    setActionError(null);
    const { error } = await supabase.from('purchase_requisitions').update({ status: 'approved', approved_by: profile?.id, approved_at: new Date().toISOString() }).eq('id', r.id);
    if (error) { setActionError(error.message); return; }
    refresh();
  };

  const reject = async () => {
    if (!reason.trim()) return;
    setActionError(null);
    const { error } = await supabase.from('purchase_requisitions').update({ status: 'rejected', approved_by: profile?.id, approved_at: new Date().toISOString(), rejection_reason: reason }).eq('id', r.id);
    if (error) { setActionError(error.message); return; }
    setRejecting(false);
    refresh();
  };

  return (
    <tr>
      <td>
        {r.item_description}
        {(r.estimated_cost || r.notes) && (
          <div className="text-muted" style={{ fontSize: 11 }}>
            {r.estimated_cost ? `est. ₹${Number(r.estimated_cost).toLocaleString()}` : ''}{r.estimated_cost && r.notes ? ' · ' : ''}{r.notes ?? ''}
          </div>
        )}
      </td>
      <td>{r.department ?? '—'}</td>
      <td>{r.quantity} {r.unit ?? ''}</td>
      <td><span className="tag tag-outline" style={r.urgency === 'urgent' ? { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' } : undefined}>{r.urgency}</span></td>
      <td>{r.profiles?.full_name ?? '—'}</td>
      <td>
        <span className="tag tag-outline" style={STATUS_STYLE[r.status]}>{r.status.replace(/_/g, ' ')}</span>
        {r.status === 'rejected' && r.rejection_reason && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{r.rejection_reason}</div>}
      </td>
      <td>
        {r.status === 'pending' && isOwnRequest && <span className="text-muted" style={{ fontSize: 11 }}>Needs another store_keeper's sign-off</span>}
        {r.status === 'pending' && !isOwnRequest && !rejecting && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-ghost" onClick={approve}>Approve</button>
            <button className="btn btn-ghost" onClick={() => setRejecting(true)}>Reject</button>
          </div>
        )}
        {rejecting && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input className="input" style={{ width: 160 }} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn btn-ghost" onClick={reject} disabled={!reason.trim()}>Confirm</button>
            <button className="btn btn-ghost" onClick={() => setRejecting(false)}>Cancel</button>
          </div>
        )}
        {actionError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 2 }}>{actionError}</div>}
      </td>
    </tr>
  );
}

const REQ_STATUSES = ['pending', 'approved', 'rejected', 'converted_to_po', 'cancelled'];
type ReqStatusFilter = 'open' | 'all' | (typeof REQ_STATUSES)[number];

function RequisitionsTab() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReqStatusFilter>('open');
  const { data: reqs, isLoading } = useQuery({
    queryKey: ['requisitions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_requisitions').select('*, profiles(full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (reqs ?? []).filter((r: any) => {
    if (statusFilter === 'open' && r.status !== 'pending') return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!term) return true;
    return r.item_description?.toLowerCase().includes(term) || r.department?.toLowerCase().includes(term) || r.profiles?.full_name?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Requests for stock — approve, then create a matching PO from the Purchase Orders tab.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log requisition</button>}
      </div>
      {showForm && <AddRequisitionForm onDone={() => setShowForm(false)} />}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, department or requester" />
        </div>
        <div className="seg" style={{ maxWidth: 560 }}>
          {(['open', 'all', ...REQ_STATUSES] as ReqStatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Item</th><th>Dept.</th><th>Qty</th><th>Urgency</th><th>Requested by</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((r: any) => <RequisitionRow key={r.id} r={r} />)}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No requisitions match.</td></tr>}
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

function EditStoreItemForm({ item, onDone }: { item: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    item_name: item.item_name ?? '', category: item.category ?? 'surgical_consumable', unit: item.unit ?? '',
    reorder_level: String(item.reorder_level ?? 0), unit_price: item.unit_price != null ? String(item.unit_price) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.item_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('general_stores_inventory').update({
      item_name: form.item_name, category: form.category, unit: form.unit || null,
      reorder_level: Number(form.reorder_level) || 0, unit_price: form.unit_price ? Number(form.unit_price) : null,
    }).eq('id', item.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    onDone();
  };

  return (
    <tr>
      <td colSpan={5} style={{ background: 'var(--color-accent-100)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Item name</label><input className="input" value={form.item_name} onChange={(e) => set('item_name', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {STORES_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 90px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Unit</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Reorder level</label><input className="input" type="number" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Unit price (₹)</label><input className="input" type="number" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} /></div>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
          {error && <span style={{ color: '#b64545', fontSize: 12 }}>{error}</span>}
        </div>
      </td>
    </tr>
  );
}

function IssueStockForm({ item, onDone }: { item: any; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const departments = useDepartmentNames();
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
      <div style={{ width: 200 }}><SelectOrOtherInput value={department} options={departments} onChange={setDepartment} placeholder="Department" /></div>
      <input className="input" style={{ width: 80 }} type="number" min={1} max={item.stock_qty} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

function WriteOffStoreForm({ item, onDone }: { item: any; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState(WRITEOFF_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amount = Number(qty);
    if (!amount || amount <= 0 || amount > item.stock_qty) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('stock_issue_notes').insert({
      item_id: item.id, is_writeoff: true, adjustment_reason: reason, quantity_issued: amount, issued_by: profile?.id,
    });
    if (insertError) { setSaving(false); setError(insertError.message); return; }
    const { error: updateError } = await supabase.from('general_stores_inventory').update({ stock_qty: item.stock_qty - amount }).eq('id', item.id);
    setSaving(false);
    if (updateError) { setError(`Write-off logged, but stock count didn't update: ${updateError.message}`); return; }
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    qc.invalidateQueries({ queryKey: ['stock-issues'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="input" style={{ width: 140 }} value={reason} onChange={(e) => setReason(e.target.value)}>
        {WRITEOFF_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
      </select>
      <input className="input" style={{ width: 80 }} type="number" min={1} max={item.stock_qty} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm write-off'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

function StoreItemRow({ item }: { item: any }) {
  const [issuing, setIssuing] = useState(false);
  const [writingOff, setWritingOff] = useState(false);
  const [editing, setEditing] = useState(false);
  const lowStock = item.stock_qty <= item.reorder_level;

  if (editing) return <EditStoreItemForm item={item} onDone={() => setEditing(false)} />;

  return (
    <tr>
      <td>{item.item_name}</td>
      <td>{item.category.replace(/_/g, ' ')}</td>
      <td><span className={lowStock ? 'tag tag-outline' : ''} style={lowStock ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>{item.stock_qty} {item.unit ?? ''}</span></td>
      <td>{item.reorder_level}</td>
      <td>
        {issuing && <IssueStockForm item={item} onDone={() => setIssuing(false)} />}
        {writingOff && <WriteOffStoreForm item={item} onDone={() => setWritingOff(false)} />}
        {!issuing && !writingOff && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" onClick={() => setIssuing(true)} disabled={item.stock_qty <= 0}>Issue stock</button>
            <button className="btn btn-ghost" onClick={() => setWritingOff(true)} disabled={item.stock_qty <= 0}>Write off</button>
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function GeneralStoresTab() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
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

  const term = search.trim().toLowerCase();
  const filtered = (items ?? []).filter((it: any) => {
    if (lowStockOnly && it.stock_qty > it.reorder_level) return false;
    if (!term) return true;
    return it.item_name?.toLowerCase().includes(term) || it.category?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Linen, stationery, surgical consumables, PPE and cleaning supplies — everything pharmacy/optical inventory doesn't cover.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add item</button>}
      </div>
      {showForm && <AddStoreItemForm onDone={() => setShowForm(false)} />}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item name or category" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, paddingBottom: 8 }}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} /> Low stock only
        </label>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Reorder at</th><th /></tr></thead>
          <tbody>
            {filtered.map((it: any) => <StoreItemRow key={it.id} item={it} />)}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-muted">No items match.</td></tr>}
          </tbody>
        </table>
      )}
      <h4 style={{ marginTop: 'var(--space-6)' }}>Recent stock activity</h4>
      {recentIssues?.length ? (
        <ul style={{ paddingLeft: 18, fontSize: 13 }}>
          {recentIssues.map((r: any) => (
            <li key={r.id}>
              -{r.quantity_issued} {r.general_stores_inventory?.item_name}{' '}
              {r.is_writeoff ? <span style={{ color: '#8a2c2c' }}>written off ({r.adjustment_reason?.replace(/_/g, ' ')})</span> : `to ${r.department}`}
              {' '}— {new Date(r.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No stock activity yet.</p>}
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
