import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { printLabReport } from '../lib/printLabReport';
import { printSpecimenLabel } from '../lib/printSpecimenLabel';
import { computeLabResultFlag } from '../lib/computeLabResultFlag';

const CATEGORIES = ['hematology', 'biochemistry', 'microbiology', 'serology', 'urine', 'hormone', 'other'];
const SPECIMEN_TYPES = ['blood', 'urine', 'swab', 'stool', 'csf', 'other'];
const RESULT_TYPES = ['numeric', 'qualitative'];
const PRIORITIES = ['routine', 'urgent', 'stat'];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  ordered: {}, sample_collected: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
  in_progress: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  resulted: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  verified: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  completed: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  cancelled: { background: '#e8e8e8', color: '#555' },
};
const FLAG_STYLE: Record<string, React.CSSProperties> = {
  normal: {}, low: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  high: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  critical: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3', fontWeight: 700 },
};

// ---------------- Test Catalog ----------------

function AddTestForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    test_code: '', test_name: '', category: 'other', specimen_type: 'blood', result_type: 'numeric',
    unit: '', reference_low: '', reference_high: '', reference_text: '', turnaround_hours: '', price: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.test_code.trim() || !form.test_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('lab_test_catalog').insert({
      test_code: form.test_code, test_name: form.test_name, category: form.category, specimen_type: form.specimen_type,
      result_type: form.result_type, unit: form.unit || null,
      reference_low: form.reference_low ? Number(form.reference_low) : null, reference_high: form.reference_high ? Number(form.reference_high) : null,
      reference_text: form.reference_text || null, turnaround_hours: form.turnaround_hours ? Number(form.turnaround_hours) : null,
      price: form.price ? Number(form.price) : null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['lab-test-catalog'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add test</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Code *</label><input className="input" value={form.test_code} onChange={(e) => set('test_code', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Name *</label><input className="input" value={form.test_name} onChange={(e) => set('test_name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 150px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Specimen</label>
          <select className="input" value={form.specimen_type} onChange={(e) => set('specimen_type', e.target.value)}>
            {SPECIMEN_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Result type</label>
          <select className="input" value={form.result_type} onChange={(e) => set('result_type', e.target.value)}>
            {RESULT_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {form.result_type === 'numeric' ? (
          <>
            <div className="field" style={{ flex: '1 1 100px' }}><label>Unit</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></div>
            <div className="field" style={{ flex: '1 1 100px' }}><label>Ref. low</label><input className="input" type="number" value={form.reference_low} onChange={(e) => set('reference_low', e.target.value)} /></div>
            <div className="field" style={{ flex: '1 1 100px' }}><label>Ref. high</label><input className="input" type="number" value={form.reference_high} onChange={(e) => set('reference_high', e.target.value)} /></div>
          </>
        ) : (
          <div className="field" style={{ flex: '1 1 200px' }}><label>Reference (e.g. "Negative")</label><input className="input" value={form.reference_text} onChange={(e) => set('reference_text', e.target.value)} /></div>
        )}
        <div className="field" style={{ flex: '1 1 130px' }}><label>Turnaround (hrs)</label><input className="input" type="number" value={form.turnaround_hours} onChange={(e) => set('turnaround_hours', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Price (₹)</label><input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add test'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function EditTestForm({ test, onDone }: { test: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    test_name: test.test_name, category: test.category, unit: test.unit ?? '',
    reference_low: test.reference_low != null ? String(test.reference_low) : '', reference_high: test.reference_high != null ? String(test.reference_high) : '',
    reference_text: test.reference_text ?? '', price: test.price != null ? String(test.price) : '', turnaround_hours: test.turnaround_hours != null ? String(test.turnaround_hours) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('lab_test_catalog').update({
      test_name: form.test_name, category: form.category, unit: form.unit || null,
      reference_low: form.reference_low ? Number(form.reference_low) : null, reference_high: form.reference_high ? Number(form.reference_high) : null,
      reference_text: form.reference_text || null, price: form.price ? Number(form.price) : null,
      turnaround_hours: form.turnaround_hours ? Number(form.turnaround_hours) : null,
    }).eq('id', test.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['lab-test-catalog'] });
    onDone();
  };

  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--color-accent-100)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Name</label><input className="input" value={form.test_name} onChange={(e) => set('test_name', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 130px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {test.result_type === 'numeric' ? (
            <>
              <div className="field" style={{ flex: '1 1 90px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Unit</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></div>
              <div className="field" style={{ flex: '1 1 90px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Ref. low</label><input className="input" type="number" value={form.reference_low} onChange={(e) => set('reference_low', e.target.value)} /></div>
              <div className="field" style={{ flex: '1 1 90px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Ref. high</label><input className="input" type="number" value={form.reference_high} onChange={(e) => set('reference_high', e.target.value)} /></div>
            </>
          ) : (
            <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Reference</label><input className="input" value={form.reference_text} onChange={(e) => set('reference_text', e.target.value)} /></div>
          )}
          <div className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>TAT (hrs)</label><input className="input" type="number" value={form.turnaround_hours} onChange={(e) => set('turnaround_hours', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Price (₹)</label><input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
          {error && <span style={{ color: '#b64545', fontSize: 12 }}>{error}</span>}
        </div>
      </td>
    </tr>
  );
}

function TestCatalogTab({ isLabTech }: { isLabTech: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { data: tests, isLoading } = useQuery({
    queryKey: ['lab-test-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lab_test_catalog').select('*').order('test_name');
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = async (t: any) => {
    await supabase.from('lab_test_catalog').update({ active: !t.active }).eq('id', t.id);
    qc.invalidateQueries({ queryKey: ['lab-test-catalog'] });
  };

  const term = search.trim().toLowerCase();
  const filtered = (tests ?? []).filter((t: any) => !term || t.test_name.toLowerCase().includes(term) || t.test_code.toLowerCase().includes(term) || t.category.toLowerCase().includes(term));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>The test menu — code, category, specimen, reference range and price.</p>
        {isLabTech && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add test</button>}
      </div>
      {showForm && <AddTestForm onDone={() => setShowForm(false)} />}
      <div className="field" style={{ maxWidth: 300, marginBottom: 12 }}>
        <label>Search</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, code or category" />
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Specimen</th><th>Reference</th><th>Price</th>{isLabTech && <th />}</tr></thead>
          <tbody>
            {filtered.map((t: any) => (
              editingId === t.id ? <EditTestForm key={t.id} test={t} onDone={() => setEditingId(null)} /> : (
                <tr key={t.id} style={t.active ? undefined : { opacity: 0.6 }}>
                  <td>{t.test_code}</td>
                  <td>{t.test_name}</td>
                  <td>{t.category}</td>
                  <td>{t.specimen_type}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {t.result_type === 'qualitative' ? (t.reference_text ?? '—') : (t.reference_low != null || t.reference_high != null ? `${t.reference_low ?? '—'}–${t.reference_high ?? '—'} ${t.unit ?? ''}` : '—')}
                  </td>
                  <td>{t.price ? `₹${Number(t.price).toLocaleString()}` : '—'}</td>
                  {isLabTech && (
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost" onClick={() => setEditingId(t.id)}>Edit</button>
                      <button className="btn btn-ghost" onClick={() => toggleActive(t)}>{t.active ? 'Deactivate' : 'Reactivate'}</button>
                    </td>
                  )}
                </tr>
              )
            ))}
            {filtered.length === 0 && <tr><td colSpan={isLabTech ? 7 : 6} className="text-muted">No tests match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Orders ----------------

async function syncOrderStatus(orderId: string, qc: ReturnType<typeof useQueryClient>) {
  const { data: items } = await supabase.from('lab_order_items').select('status').eq('lab_order_id', orderId);
  const statuses = (items ?? []).map((i: any) => i.status);
  let status = 'ordered';
  if (statuses.length > 0 && statuses.every((s) => s === 'cancelled')) status = 'cancelled';
  else if (statuses.filter((s) => s !== 'cancelled').every((s) => s === 'verified') && statuses.some((s) => s === 'verified')) status = 'completed';
  else if (statuses.some((s) => s === 'resulted' || s === 'verified')) status = 'in_progress';
  else if (statuses.some((s) => s === 'sample_collected')) status = 'sample_collected';
  await supabase.from('lab_orders').update({ status }).eq('id', orderId);
  qc.invalidateQueries({ queryKey: ['lab-orders'] });
}

function NewLabOrderForm({ patient, onDone }: { patient: any; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [priority, setPriority] = useState('routine');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tests } = useQuery({
    queryKey: ['lab-test-catalog-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lab_test_catalog').select('*').eq('active', true).order('category').order('test_name');
      if (error) throw error;
      return data;
    },
  });

  const toggleTest = (id: string) => setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTestIds.length === 0) return;
    setSaving(true);
    setError(null);
    const { data: order, error: orderError } = await supabase.from('lab_orders').insert({
      patient_id: patient.id, ordered_by: profile?.id, priority, clinical_notes: notes || null,
    }).select().single();
    if (orderError || !order) { setSaving(false); setError(orderError?.message ?? 'Could not create order.'); return; }
    const { error: itemsError } = await supabase.from('lab_order_items').insert(
      selectedTestIds.map((test_id) => ({ lab_order_id: order.id, test_id })),
    );
    setSaving(false);
    if (itemsError) { setError(itemsError.message); return; }
    qc.invalidateQueries({ queryKey: ['lab-orders'] });
    onDone();
  };

  const byCategory = CATEGORIES.map((c) => ({ category: c, tests: (tests ?? []).filter((t: any) => t.category === c) })).filter((g) => g.tests.length > 0);

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Order tests for {patient.full_name} ({patient.uhid})</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 10 }}>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Priority</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Clinical notes</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      {byCategory.map((g) => (
        <div key={g.category} style={{ marginBottom: 8 }}>
          <strong style={{ fontSize: 12, textTransform: 'capitalize' }}>{g.category}</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            {g.tests.map((t: any) => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={selectedTestIds.includes(t.id)} onChange={() => toggleTest(t.id)} /> {t.test_name}
              </label>
            ))}
          </div>
        </div>
      ))}
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving || selectedTestIds.length === 0}>{saving ? 'Ordering…' : `Order ${selectedTestIds.length || ''} test(s)`}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function LabOrderItemRow({ item, patient, isLabTech }: { item: any; patient: any; isLabTech: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [specimenId, setSpecimenId] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [resultFlag, setResultFlag] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const test = item.lab_test_catalog;
  const patientGender = patient?.gender ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lab-order-items', item.lab_order_id] });
    syncOrderStatus(item.lab_order_id, qc);
  };

  const collectSample = async () => {
    setError(null);
    const assignedSpecimenId = specimenId.trim() || `SP-${Date.now().toString(36).toUpperCase()}`;
    const { error: err } = await supabase.from('lab_order_items').update({
      status: 'sample_collected', specimen_id: assignedSpecimenId, sample_collected_at: new Date().toISOString(), sample_collected_by: profile?.id,
    }).eq('id', item.id);
    if (err) { setError(err.message); return; }
    if (patient) printSpecimenLabel(assignedSpecimenId, patient.full_name, patient.uhid, test?.test_name ?? '');
    refresh();
  };

  const saveResult = async () => {
    if (!resultValue.trim()) return;
    setError(null);
    const numeric = test?.result_type === 'numeric' ? Number(resultValue) : null;
    const flag = test?.result_type === 'numeric' ? (resultFlag || computeLabResultFlag(test, patientGender, numeric ?? 0)) : null;
    const { error: err } = await supabase.from('lab_order_items').update({
      status: 'resulted', result_value: resultValue, result_numeric: numeric, result_flag: flag,
      result_notes: resultNotes || null, resulted_by: profile?.id, resulted_at: new Date().toISOString(),
    }).eq('id', item.id);
    if (err) { setError(err.message); return; }
    refresh();
  };

  const verify = async () => {
    setError(null);
    const { error: err } = await supabase.from('lab_order_items').update({ status: 'verified', verified_by: profile?.id, verified_at: new Date().toISOString() }).eq('id', item.id);
    if (err) { setError(err.message); return; }
    refresh();
  };

  const cancel = async () => {
    setError(null);
    const { error: err } = await supabase.from('lab_order_items').update({ status: 'cancelled' }).eq('id', item.id);
    if (err) { setError(err.message); return; }
    refresh();
  };

  const suggestedFlag = test?.result_type === 'numeric' && resultValue ? computeLabResultFlag(test, patientGender, Number(resultValue)) : null;

  return (
    <tr>
      <td>{test?.test_name} <span className="text-muted" style={{ fontSize: 11 }}>({test?.specimen_type})</span></td>
      <td><span className="tag tag-outline" style={STATUS_STYLE[item.status]}>{item.status.replace(/_/g, ' ')}</span></td>
      <td>
        {item.status === 'resulted' || item.status === 'verified' ? (
          <span>{item.result_value ?? item.result_numeric} {test?.unit ?? ''} {item.result_flag && <span className="tag tag-outline" style={{ marginLeft: 4, ...FLAG_STYLE[item.result_flag] }}>{item.result_flag}</span>}</span>
        ) : '—'}
      </td>
      <td>
        {!isLabTech ? null : (
          <>
            {item.status === 'ordered' && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="input" style={{ width: 120 }} placeholder="Specimen ID" value={specimenId} onChange={(e) => setSpecimenId(e.target.value)} />
                <button className="btn btn-ghost" onClick={collectSample}>Collect sample</button>
                <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
              </div>
            )}
            {item.status === 'sample_collected' && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="text-muted" style={{ fontSize: 11 }}>{item.specimen_id}</span>
                {patient && <button type="button" className="btn btn-ghost" onClick={() => printSpecimenLabel(item.specimen_id, patient.full_name, patient.uhid, test?.test_name ?? '')}>Reprint label</button>}
                <input className="input" style={{ width: 100 }} placeholder={test?.result_type === 'qualitative' ? (test?.reference_text ?? 'Result') : 'Value'} value={resultValue} onChange={(e) => setResultValue(e.target.value)} />
                {test?.result_type === 'numeric' && (
                  <select className="input" style={{ width: 110 }} value={resultFlag} onChange={(e) => setResultFlag(e.target.value)}>
                    <option value="">{suggestedFlag ? `auto: ${suggestedFlag}` : 'flag…'}</option>
                    <option value="normal">normal</option><option value="low">low</option><option value="high">high</option><option value="critical">critical</option>
                  </select>
                )}
                <input className="input" style={{ width: 140 }} placeholder="Notes" value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} />
                <button className="btn btn-ghost" onClick={saveResult} disabled={!resultValue.trim()}>Save result</button>
                <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
              </div>
            )}
            {item.status === 'resulted' && <button className="btn btn-ghost" onClick={verify}>Verify</button>}
          </>
        )}
        {error && <div style={{ color: '#b64545', fontSize: 11 }}>{error}</div>}
      </td>
    </tr>
  );
}

function LabOrderRow({ order, isLabTech }: { order: any; isLabTech: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { data: items } = useQuery({
    queryKey: ['lab-order-items', order.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('lab_order_items').select('*, lab_test_catalog(*)').eq('lab_order_id', order.id);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {order.patients?.full_name}</button> <span className="text-muted" style={{ fontSize: 11 }}>({order.patients?.uhid})</span></td>
        <td>{new Date(order.order_date).toLocaleDateString()}</td>
        <td><span className="tag tag-outline" style={order.priority === 'stat' ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : order.priority === 'urgent' ? { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' } : undefined}>{order.priority}</span></td>
        <td><span className="tag tag-outline" style={STATUS_STYLE[order.status]}>{order.status.replace(/_/g, ' ')}</span></td>
        <td><button className="btn btn-ghost" onClick={async () => { const { data } = await supabase.from('lab_order_items').select('*, lab_test_catalog(*)').eq('lab_order_id', order.id); printLabReport(order, data ?? [], order.patients); }}>Print</button></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              {order.clinical_notes && <p className="text-muted" style={{ fontSize: 13 }}>{order.clinical_notes}</p>}
              <table className="table">
                <thead><tr><th>Test</th><th>Status</th><th>Result</th><th /></tr></thead>
                <tbody>
                  {items?.map((it: any) => <LabOrderItemRow key={it.id} item={it} patient={order.patients} isLabTech={isLabTech} />)}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const ORDER_STATUSES = ['ordered', 'sample_collected', 'in_progress', 'completed', 'cancelled'];
type OrderStatusFilter = 'open' | 'all' | (typeof ORDER_STATUSES)[number];

function OrdersTab({ isLabTech, canOrder }: { isLabTech: boolean; canOrder: boolean }) {
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('open');

  const { data: matches } = useQuery({
    queryKey: ['lab-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1 && !selectedPatient,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedQuery);
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['lab-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lab_orders').select('*, patients(full_name, uhid, gender)').order('order_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (orders ?? []).filter((o: any) => {
    if (statusFilter === 'open' && (o.status === 'completed' || o.status === 'cancelled')) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!term) return true;
    return o.patients?.full_name?.toLowerCase().includes(term) || o.patients?.uhid?.toLowerCase().includes(term);
  });

  return (
    <div>
      {canOrder && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <h4 style={{ marginTop: 0 }}>New order</h4>
          <div className="field" style={{ maxWidth: 320, position: 'relative' }}>
            <label>Patient</label>
            <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
              onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
            {!selectedPatient && matches && matches.length > 0 && (
              <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
              </div>
            )}
          </div>
          {selectedPatient && <NewLabOrderForm patient={selectedPatient} onDone={() => { setSelectedPatient(null); setPatientQuery(''); }} />}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient name or UHID" />
        </div>
        <div className="seg" style={{ maxWidth: 560 }}>
          {(['open', 'all', ...ORDER_STATUSES] as OrderStatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Ordered</th><th>Priority</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((o: any) => <LabOrderRow key={o.id} order={o} isLabTech={isLabTech} />)}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-muted">No lab orders match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export function LaboratoryPage() {
  const { profile } = useAuth();
  const isLabTech = profile?.role === 'lab_technician' || profile?.role === 'admin';
  const canOrder = isLabTech || profile?.role === 'doctor' || profile?.role === 'nurse';
  const [tab, setTab] = useState<'orders' | 'catalog'>('orders');

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Laboratory</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Test orders, sample tracking, results and the test catalog.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {[{ key: 'orders', label: 'Orders & Results' }, { key: 'catalog', label: 'Test Catalog' }].map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key as typeof tab)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab isLabTech={isLabTech} canOrder={canOrder} />}
      {tab === 'catalog' && <TestCatalogTab isLabTech={isLabTech} />}
    </div>
  );
}
