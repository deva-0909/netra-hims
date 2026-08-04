import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const BI_RESULT_STYLE: Record<string, React.CSSProperties> = {
  pending: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  pass: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  fail: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
};
const WASTE_CATEGORIES = ['yellow', 'red', 'white', 'blue'];
const WASTE_CATEGORY_STYLE: Record<string, React.CSSProperties> = {
  yellow: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  red: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  white: { background: '#eef0f0', color: '#444', borderColor: '#d5d9d9' },
  blue: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
};
const HOUSEKEEPING_FREQUENCIES = ['daily', 'weekly', 'monthly'];
const FREQUENCY_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysUntil = (dateStr: string) => Math.round((new Date(dateStr).getTime() - new Date(todayISO()).getTime()) / 86400000);
function dueStyle(days: number): React.CSSProperties {
  if (days < 0) return { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' };
  if (days <= 2) return { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' };
  return { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' };
}
function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `due in ${days}d`;
}

// ---------------- Sterilization Cycles ----------------

function LogCycleForm({ sterilizers, onDone }: { sterilizers: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ equipment_id: '', load_description: '', biological_indicator_result: 'pending', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('sterilization_cycles').insert({
      equipment_id: form.equipment_id || null, load_description: form.load_description || null,
      biological_indicator_result: form.biological_indicator_result, notes: form.notes || null, performed_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['sterilization-cycles'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log sterilization cycle</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Sterilizer</label>
          <select className="input" value={form.equipment_id} onChange={(e) => set('equipment_id', e.target.value)}>
            <option value="">—</option>
            {sterilizers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.asset_tag})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Load description</label><input className="input" value={form.load_description} onChange={(e) => set('load_description', e.target.value)} placeholder="OT instrument set #3" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Biological indicator</label>
          <select className="input" value={form.biological_indicator_result} onChange={(e) => set('biological_indicator_result', e.target.value)}>
            <option value="pending">pending</option><option value="pass">pass</option><option value="fail">fail</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log cycle'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function SterilizationTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: sterilizers } = useQuery({
    queryKey: ['sterilizer-equipment'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipment_assets').select('id, asset_tag, name').eq('category', 'sterilization').eq('status', 'active');
      if (error) throw error;
      return data;
    },
  });
  const { data: cycles, isLoading } = useQuery({
    queryKey: ['sterilization-cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sterilization_cycles').select('*, profiles(full_name), equipment_assets(name, asset_tag)').order('cycle_date', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Every autoclave/ETO load, with its biological indicator result — a failed BI means that load can't be released for use.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log cycle</button>}
      </div>
      {showForm && <LogCycleForm sterilizers={sterilizers ?? []} onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Sterilizer</th><th>Load</th><th>BI result</th><th>Performed by</th></tr></thead>
          <tbody>
            {cycles?.map((c: any) => (
              <tr key={c.id}>
                <td>{new Date(c.cycle_date).toLocaleString()}</td>
                <td>{c.equipment_assets?.name ?? '—'}</td>
                <td className="text-muted">{c.load_description ?? '—'}</td>
                <td><span className="tag tag-outline" style={BI_RESULT_STYLE[c.biological_indicator_result]}>{c.biological_indicator_result}</span></td>
                <td>{c.profiles?.full_name ?? '—'}</td>
              </tr>
            ))}
            {cycles?.length === 0 && <tr><td colSpan={5} className="text-muted">No cycles logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Biomedical Waste ----------------

function LogWasteForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ log_date: todayISO(), category: 'yellow', quantity_kg: '', handed_over_to: '', manifest_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('biomedical_waste_log').insert({
      log_date: form.log_date, category: form.category, quantity_kg: form.quantity_kg ? Number(form.quantity_kg) : null,
      handed_over_to: form.handed_over_to || null, manifest_number: form.manifest_number || null, notes: form.notes || null,
      collected_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['biomedical-waste'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log biomedical waste</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Date</label><input className="input" type="date" value={form.log_date} onChange={(e) => set('log_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {WASTE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Quantity (kg)</label><input className="input" type="number" value={form.quantity_kg} onChange={(e) => set('quantity_kg', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Handed over to</label><input className="input" value={form.handed_over_to} onChange={(e) => set('handed_over_to', e.target.value)} placeholder="Authorized BMW vendor" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Manifest #</label><input className="input" value={form.manifest_number} onChange={(e) => set('manifest_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log waste'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function BiomedicalWasteTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: logs, isLoading } = useQuery({
    queryKey: ['biomedical-waste'],
    queryFn: async () => {
      const { data, error } = await supabase.from('biomedical_waste_log').select('*, profiles(full_name)').order('log_date', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>BMW Rules colour-coded segregation log, with the manifest trail to the authorized disposal vendor.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log waste</button>}
      </div>
      {showForm && <LogWasteForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Category</th><th>Qty (kg)</th><th>Handed to</th><th>Manifest #</th><th>Logged by</th></tr></thead>
          <tbody>
            {logs?.map((l: any) => (
              <tr key={l.id}>
                <td>{l.log_date}</td>
                <td><span className="tag tag-outline" style={WASTE_CATEGORY_STYLE[l.category]}>{l.category}</span></td>
                <td>{l.quantity_kg ?? '—'}</td>
                <td>{l.handed_over_to ?? '—'}</td>
                <td>{l.manifest_number ?? '—'}</td>
                <td>{l.profiles?.full_name ?? '—'}</td>
              </tr>
            ))}
            {logs?.length === 0 && <tr><td colSpan={6} className="text-muted">No waste logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Housekeeping ----------------

function AddScheduleForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ area: '', frequency: 'daily', next_due_date: todayISO(), assigned_to: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.area.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('housekeeping_schedules').insert({
      area: form.area, frequency: form.frequency, next_due_date: form.next_due_date,
      assigned_to: form.assigned_to || null, notes: form.notes || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['housekeeping-schedules'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add housekeeping schedule</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Area *</label><input className="input" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="OT 1, Waiting hall, Wards" required /></div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Frequency</label>
          <select className="input" value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>
            {HOUSEKEEPING_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Next due</label><input className="input" type="date" value={form.next_due_date} onChange={(e) => set('next_due_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Assigned to</label><input className="input" value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add schedule'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function HousekeepingTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['housekeeping-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('housekeeping_schedules').select('*').eq('active', true).order('next_due_date');
      if (error) throw error;
      return data;
    },
  });

  const markDone = async (s: any) => {
    const next = new Date();
    next.setDate(next.getDate() + FREQUENCY_DAYS[s.frequency]);
    await supabase.from('housekeeping_schedules').update({ last_done_date: todayISO(), next_due_date: next.toISOString().slice(0, 10) }).eq('id', s.id);
    qc.invalidateQueries({ queryKey: ['housekeeping-schedules'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Cleaning schedules by area — marking one done rolls its due date forward automatically.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add schedule</button>}
      </div>
      {showForm && <AddScheduleForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Area</th><th>Frequency</th><th>Last done</th><th>Next due</th><th>Assigned to</th><th /></tr></thead>
          <tbody>
            {schedules?.map((s: any) => {
              const days = daysUntil(s.next_due_date);
              return (
                <tr key={s.id}>
                  <td>{s.area}</td>
                  <td>{s.frequency}</td>
                  <td>{s.last_done_date ?? '—'}</td>
                  <td><span className="tag tag-outline" style={dueStyle(days)}>{s.next_due_date} · {dueLabel(days)}</span></td>
                  <td>{s.assigned_to ?? '—'}</td>
                  <td><button className="btn btn-ghost" onClick={() => markDone(s)}>Mark done</button></td>
                </tr>
              );
            })}
            {schedules?.length === 0 && <tr><td colSpan={6} className="text-muted">No housekeeping schedules yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export function CssdHousekeepingPage() {
  const [tab, setTab] = useState<'sterilization' | 'waste' | 'housekeeping'>('sterilization');
  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'sterilization', label: 'Sterilization Cycles' },
    { key: 'waste', label: 'Biomedical Waste' },
    { key: 'housekeeping', label: 'Housekeeping' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>CSSD & Housekeeping</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Sterile services, biomedical waste segregation, and cleaning schedules.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sterilization' && <SterilizationTab />}
      {tab === 'waste' && <BiomedicalWasteTab />}
      {tab === 'housekeeping' && <HousekeepingTab />}
    </div>
  );
}
