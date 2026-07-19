import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const FORMS = ['tablet', 'eye_drop', 'ointment', 'injection', 'capsule', 'syrup', 'other'];

function RestockRow({ drug }: { drug: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowStock = drug.stock_qty <= drug.reorder_level;

  const submit = async () => {
    const amount = Number(qty);
    if (!amount || amount <= 0) return;
    setSaving(true);
    setError(null);
    const { error: receiptError } = await supabase.from('stock_receipts').insert({
      drug_id: drug.id,
      quantity_received: amount,
      note: note || null,
      received_by: profile?.id,
    });
    if (receiptError) {
      setSaving(false);
      setError(receiptError.message);
      return;
    }
    const { error: stockError } = await supabase.from('drugs').update({ stock_qty: drug.stock_qty + amount }).eq('id', drug.id);
    setSaving(false);
    if (stockError) {
      setError(`Order logged, but stock count didn't update: ${stockError.message}`);
      return;
    }
    setQty('');
    setNote('');
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  return (
    <tr>
      <td>{drug.name}</td>
      <td>{drug.form?.replace(/_/g, ' ') ?? '—'}</td>
      <td>{drug.strength ?? '—'}</td>
      <td>
        <span className={lowStock ? 'tag tag-outline' : ''} style={lowStock ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>
          {drug.stock_qty}
        </span>
      </td>
      <td>{drug.reorder_level}</td>
      <td>₹{Number(drug.unit_price).toFixed(2)}</td>
      <td>
        {open ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 80 }} type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <input className="input" style={{ width: 140 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        ) : (
          <button className={`btn ${lowStock ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOpen(true)}>
            {lowStock ? 'Reorder now' : 'Restock'}
          </button>
        )}
        {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
      </td>
    </tr>
  );
}

function AddDrugForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', form_type: 'eye_drop', strength: '', stock_qty: '0', unit_price: '', reorder_level: '10' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('drugs').insert({
      name: form.name,
      form: form.form_type,
      strength: form.strength || null,
      stock_qty: Number(form.stock_qty) || 0,
      unit_price: Number(form.unit_price) || 0,
      reorder_level: Number(form.reorder_level) || 10,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['drugs'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add drug to catalog</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Name *</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Form</label>
          <select className="input" value={form.form_type} onChange={(e) => set('form_type', e.target.value)}>
            {FORMS.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Strength</label><input className="input" value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="e.g. 0.5%" /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Opening stock</label><input className="input" type="number" value={form.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Unit price (₹)</label><input className="input" type="number" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Reorder level</label><input className="input" type="number" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add drug'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function PharmacyInventoryPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: drugs, isLoading } = useQuery({
    queryKey: ['drugs', debouncedSearch],
    queryFn: async () => {
      let q = supabase.from('drugs').select('*').order('name');
      if (debouncedSearch.trim()) q = q.ilike('name', `%${debouncedSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: recentReceipts } = useQuery({
    queryKey: ['stock-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_receipts').select('*, drugs(name)').order('received_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const visible = (drugs ?? []).filter((d: any) => !lowStockOnly || d.stock_qty <= d.reorder_level);
  const lowStockCount = (drugs ?? []).filter((d: any) => d.stock_qty <= d.reorder_level).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Pharmacy Inventory</h2>
        {!showAddForm && <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add drug</button>}
      </div>

      {showAddForm && <AddDrugForm onDone={() => setShowAddForm(false)} />}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Search catalog</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Drug name" />
        </div>
        <label className="radio">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} />
          Low stock only {lowStockCount > 0 && <span className="tag tag-outline" style={{ marginLeft: 6 }}>{lowStockCount}</span>}
        </label>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Drug</th><th>Form</th><th>Strength</th><th>Stock</th><th>Reorder at</th><th>Unit price</th><th /></tr></thead>
          <tbody>
            {visible.map((d: any) => <RestockRow key={d.id} drug={d} />)}
            {visible.length === 0 && <tr><td colSpan={7} className="text-muted">No drugs match.</td></tr>}
          </tbody>
        </table>
      )}

      <h4 style={{ marginTop: 'var(--space-6)' }}>Recent stock received</h4>
      {recentReceipts?.length ? (
        <ul style={{ paddingLeft: 18, fontSize: 13 }}>
          {recentReceipts.map((r: any) => (
            <li key={r.id}>
              +{r.quantity_received} {r.drugs?.name} — {new Date(r.received_at).toLocaleString()} {r.note ? `(${r.note})` : ''}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No stock received yet.</p>}
    </div>
  );
}
