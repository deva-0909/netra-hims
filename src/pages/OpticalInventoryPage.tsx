import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';

const CATEGORIES = ['frame', 'lens', 'contact_lens', 'accessory'];
const WRITEOFF_REASONS = ['damaged', 'lost_or_stolen', 'count_correction', 'other'];

function RestockRow({ item }: { item: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [writeoffOpen, setWriteoffOpen] = useState(false);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [writeoffQty, setWriteoffQty] = useState('');
  const [writeoffReason, setWriteoffReason] = useState('damaged');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowStock = item.stock_qty <= item.reorder_level;

  const submit = async () => {
    const amount = Number(qty);
    if (!amount || amount <= 0) return;
    setSaving(true);
    setError(null);
    const { error: receiptError } = await supabase.from('eyewear_stock_receipts').insert({
      item_id: item.id,
      quantity_received: amount,
      note: note || null,
      received_by: profile?.id,
    });
    if (receiptError) {
      setSaving(false);
      setError(receiptError.message);
      return;
    }
    const { error: stockError } = await supabase.from('eyewear_items').update({ stock_qty: item.stock_qty + amount }).eq('id', item.id);
    setSaving(false);
    if (stockError) {
      setError(`Order logged, but stock count didn't update: ${stockError.message}`);
      return;
    }
    setQty('');
    setNote('');
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['eyewear-items'] });
  };

  const submitWriteoff = async () => {
    const amount = Number(writeoffQty);
    if (!amount || amount <= 0) return;
    setSaving(true);
    setError(null);
    const { error: receiptError } = await supabase.from('eyewear_stock_receipts').insert({
      item_id: item.id,
      quantity_received: -amount,
      adjustment_reason: writeoffReason,
      note: note || null,
      received_by: profile?.id,
    });
    if (receiptError) {
      setSaving(false);
      setError(receiptError.message);
      return;
    }
    const { error: stockError } = await supabase.from('eyewear_items').update({ stock_qty: Math.max(0, item.stock_qty - amount) }).eq('id', item.id);
    setSaving(false);
    if (stockError) {
      setError(`Write-off logged, but stock count didn't update: ${stockError.message}`);
      return;
    }
    setWriteoffQty('');
    setNote('');
    setWriteoffOpen(false);
    qc.invalidateQueries({ queryKey: ['eyewear-items'] });
  };

  return (
    <tr>
      <td>{item.brand} {item.model}</td>
      <td>{item.category.replace(/_/g, ' ')}</td>
      <td>
        <span className={lowStock ? 'tag tag-outline' : ''} style={lowStock ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>
          {item.stock_qty}
        </span>
      </td>
      <td>{item.reorder_level}</td>
      <td>₹{Number(item.unit_price).toFixed(2)}</td>
      <td>
        {open ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 80 }} type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <input className="input" style={{ width: 140 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        ) : writeoffOpen ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 80 }} type="number" min={1} max={item.stock_qty} placeholder="Qty" value={writeoffQty} onChange={(e) => setWriteoffQty(e.target.value)} />
            <select className="input" style={{ width: 150 }} value={writeoffReason} onChange={(e) => setWriteoffReason(e.target.value)}>
              {WRITEOFF_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
            <input className="input" style={{ width: 140 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary" onClick={submitWriteoff} disabled={saving}>{saving ? 'Saving…' : 'Confirm write-off'}</button>
            <button className="btn btn-ghost" onClick={() => setWriteoffOpen(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn ${lowStock ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOpen(true)}>
              {lowStock ? 'Reorder now' : 'Restock'}
            </button>
            {item.stock_qty > 0 && <button className="btn btn-ghost" onClick={() => setWriteoffOpen(true)}>Write off</button>}
          </div>
        )}
        {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
      </td>
    </tr>
  );
}

function AddItemForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: 'frame', brand: '', model: '', stock_qty: '0', unit_price: '', reorder_level: '5' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('eyewear_items').insert({
      category: form.category,
      brand: form.brand,
      model: form.model || null,
      stock_qty: Number(form.stock_qty) || 0,
      unit_price: Number(form.unit_price) || 0,
      reorder_level: Number(form.reorder_level) || 5,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['eyewear-items'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add item to catalog</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Brand *</label><input className="input" value={form.brand} onChange={(e) => set('brand', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Model</label><input className="input" value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Opening stock</label><input className="input" type="number" value={form.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Unit price (₹)</label><input className="input" type="number" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Reorder level</label><input className="input" type="number" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add item'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function OpticalInventoryPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['eyewear-items', debouncedSearch],
    queryFn: async () => {
      let q = supabase.from('eyewear_items').select('*').order('brand');
      if (debouncedSearch.trim()) q = q.or(`brand.ilike.%${sanitizeSearchTerm(debouncedSearch)}%,model.ilike.%${sanitizeSearchTerm(debouncedSearch)}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: recentReceipts } = useQuery({
    queryKey: ['eyewear-stock-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eyewear_stock_receipts').select('*, eyewear_items(brand, model)').order('received_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const visible = (items ?? []).filter((d: any) => !lowStockOnly || d.stock_qty <= d.reorder_level);
  const lowStockCount = (items ?? []).filter((d: any) => d.stock_qty <= d.reorder_level).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Optical Inventory</h2>
        {!showAddForm && <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add item</button>}
      </div>

      {showAddForm && <AddItemForm onDone={() => setShowAddForm(false)} />}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Search catalog</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Brand or model" />
        </div>
        <label className="radio">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} />
          Low stock only {lowStockCount > 0 && <span className="tag tag-outline" style={{ marginLeft: 6 }}>{lowStockCount}</span>}
        </label>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Reorder at</th><th>Unit price</th><th /></tr></thead>
          <tbody>
            {visible.map((it: any) => <RestockRow key={it.id} item={it} />)}
            {visible.length === 0 && <tr><td colSpan={6} className="text-muted">No items match.</td></tr>}
          </tbody>
        </table>
      )}

      <h4 style={{ marginTop: 'var(--space-6)' }}>Recent stock activity</h4>
      {recentReceipts?.length ? (
        <ul style={{ paddingLeft: 18, fontSize: 13 }}>
          {recentReceipts.map((r: any) => (
            <li key={r.id}>
              {r.quantity_received > 0 ? `+${r.quantity_received}` : r.quantity_received} {r.eyewear_items?.brand} {r.eyewear_items?.model} — {new Date(r.received_at).toLocaleString()}
              {r.adjustment_reason ? ` · ${r.adjustment_reason.replace(/_/g, ' ')}` : ''} {r.note ? `(${r.note})` : ''}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No stock activity yet.</p>}
    </div>
  );
}
