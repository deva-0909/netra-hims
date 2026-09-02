import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { computeLabResultFlag } from '../lib/computeLabResultFlag';

const DEVICE_TYPES = ['lab_analyzer', 'autorefractor', 'tonometer', 'biometer', 'oct', 'fundus_camera', 'topographer', 'other'];
const READING_TYPES = ['lab_result', 'iop', 'refraction', 'biometry', 'other'];
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  unmatched: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  matched: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  applied: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  rejected: { background: '#e8e8e8', color: '#555' },
};

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `netra_dev_${hex}`;
}

// ---------------- Devices ----------------

function NewKeyBanner({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', borderColor: '#e0c9a3' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Device API key — copy it now</h4>
      <p className="text-muted" style={{ fontSize: 13 }}>This is shown once. Configure the instrument's HTTP integration with this key in the <code>x-device-api-key</code> header — it can't be retrieved again, only regenerated (which invalidates this one).</p>
      <code style={{ display: 'block', padding: 10, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)', fontSize: 13, wordBreak: 'break-all' }}>{apiKey}</code>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={async () => { await navigator.clipboard.writeText(apiKey); setCopied(true); }}>{copied ? 'Copied' : 'Copy key'}</button>
        <button className="btn btn-primary" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function AddDeviceForm({ onDone }: { onDone: (apiKey: string) => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ device_name: '', device_type: 'lab_analyzer', model: '', manufacturer: '', department: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.device_name.trim()) return;
    setSaving(true);
    setError(null);
    const apiKey = generateApiKey();
    const apiKeyHash = await sha256Hex(apiKey);
    const { error: insertError } = await supabase.from('device_registry').insert({
      device_name: form.device_name, device_type: form.device_type, model: form.model || null,
      manufacturer: form.manufacturer || null, department: form.department || null,
      api_key_hash: apiKeyHash, api_key_hint: apiKey.slice(-4), created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['device-registry'] });
    onDone(apiKey);
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Register a device</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Name *</label><input className="input" value={form.device_name} onChange={(e) => set('device_name', e.target.value)} placeholder="e.g. OT-1 Autorefractor" required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Type</label>
          <select className="input" value={form.device_type} onChange={(e) => set('device_type', e.target.value)}>
            {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Model</label><input className="input" value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Manufacturer</label><input className="input" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Registering…' : 'Register & generate key'}</button>
        <button className="btn btn-secondary" type="button" onClick={() => onDone('')}>Cancel</button>
      </div>
    </form>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** A device is "stale" if it hasn't even authenticated (last_seen_at) in
 * over 48h — a genuine connectivity problem, not just "hasn't sent a
 * reading" (some instruments are only used occasionally). */
function connectionStatus(device: any): { label: string; style: React.CSSProperties } {
  if (!device.active) return { label: 'inactive', style: {} };
  if (!device.last_seen_at) return { label: 'never connected', style: { background: '#e8e8e8', color: '#555' } };
  const staleHours = (Date.now() - new Date(device.last_seen_at).getTime()) / 3600000;
  if (staleHours > 48) return { label: `stale — last seen ${timeAgo(device.last_seen_at)}`, style: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } };
  return { label: `connected — seen ${timeAgo(device.last_seen_at)}`, style: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' } };
}

function DeviceRow({ device }: { device: any }) {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const toggleActive = async () => {
    await supabase.from('device_registry').update({ active: !device.active }).eq('id', device.id);
    qc.invalidateQueries({ queryKey: ['device-registry'] });
  };

  const regenerate = async () => {
    const apiKey = generateApiKey();
    const apiKeyHash = await sha256Hex(apiKey);
    await supabase.from('device_registry').update({ api_key_hash: apiKeyHash, api_key_hint: apiKey.slice(-4) }).eq('id', device.id);
    qc.invalidateQueries({ queryKey: ['device-registry'] });
    setNewKey(apiKey);
    setConfirming(false);
  };

  if (newKey) return <tr><td colSpan={7}><NewKeyBanner apiKey={newKey} onDone={() => setNewKey(null)} /></td></tr>;

  const conn = connectionStatus(device);

  return (
    <tr style={device.active ? undefined : { opacity: 0.6 }}>
      <td>{device.device_name}</td>
      <td>{device.device_type.replace(/_/g, ' ')}</td>
      <td className="text-muted">{device.model ?? '—'} {device.manufacturer ? `(${device.manufacturer})` : ''}</td>
      <td>{device.department ?? '—'}</td>
      <td>
        <span className="tag tag-outline" style={conn.style}>{conn.label}</span>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>Last reading: {timeAgo(device.last_reading_at)}</div>
      </td>
      <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>…{device.api_key_hint}</td>
      <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span className={`tag ${device.active ? 'tag-accent' : 'tag-outline'}`}>{device.active ? 'active' : 'inactive'}</span>
        <button className="btn btn-ghost" onClick={toggleActive}>{device.active ? 'Deactivate' : 'Reactivate'}</button>
        {confirming ? (
          <>
            <button className="btn btn-ghost" onClick={regenerate}>Confirm regenerate</button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : <button className="btn btn-ghost" onClick={() => setConfirming(true)}>Regenerate key</button>}
      </td>
    </tr>
  );
}

function DevicesTab({ canManage }: { canManage: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { data: devices, isLoading } = useQuery({
    queryKey: ['device-registry'],
    queryFn: async () => {
      const { data, error } = await supabase.from('device_registry').select('*').order('device_name');
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (devices ?? []).filter((d: any) => !term || d.device_name.toLowerCase().includes(term) || d.device_type.toLowerCase().includes(term) || d.department?.toLowerCase().includes(term));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Instruments that push readings in via API — each gets its own key, not a shared login.</p>
        {canManage && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Register device</button>}
      </div>
      {showForm && (newKey ? <NewKeyBanner apiKey={newKey} onDone={() => { setNewKey(null); setShowForm(false); }} /> : <AddDeviceForm onDone={(k) => { if (k) setNewKey(k); else setShowForm(false); }} />)}
      <div className="field" style={{ maxWidth: 300, marginBottom: 12 }}>
        <label>Search</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, type or department" />
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Model</th><th>Department</th><th>Connection</th><th>Key</th><th /></tr></thead>
          <tbody>
            {filtered.map((d: any) => <DeviceRow key={d.id} device={d} />)}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No devices registered.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Incoming Readings ----------------

function MatchPatientControl({ reading }: { reading: any }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['device-reading-patient-search', debounced],
    enabled: debounced.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debounced);
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const match = async (patientId: string) => {
    setError(null);
    const { error: err } = await supabase.from('device_readings').update({ matched_patient_id: patientId, status: 'matched' }).eq('id', reading.id);
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ['device-readings'] });
  };

  return (
    <div style={{ position: 'relative', maxWidth: 280 }}>
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Match to patient (device sent: "${reading.patient_identifier ?? '—'}")`} />
      {matches && matches.length > 0 && (
        <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 180, overflowY: 'auto', padding: 4 }}>
          {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => match(p.id)}>{p.full_name} — {p.uhid}</div>)}
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

function ApplyLabResult({ reading, patient }: { reading: any; patient: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [itemId, setItemId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: items } = useQuery({
    queryKey: ['open-lab-items-for-patient', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lab_order_items').select('*, lab_test_catalog(*), lab_orders!inner(patient_id)').eq('lab_orders.patient_id', patient.id).in('status', ['ordered', 'sample_collected']);
      if (error) throw error;
      return data;
    },
  });

  const suggestedId = items?.find((it: any) => it.lab_test_catalog?.test_code === reading.raw_payload?.test_code)?.id;
  const selectedId = itemId || suggestedId || '';

  const apply = async () => {
    const item = items?.find((it: any) => it.id === selectedId);
    if (!item) return;
    setSaving(true);
    setError(null);
    const value = reading.raw_payload?.value;
    const numeric = item.lab_test_catalog?.result_type === 'numeric' && value != null ? Number(value) : null;
    const flag = numeric != null ? computeLabResultFlag(item.lab_test_catalog, patient.gender, numeric) : null;
    const { error: itemError } = await supabase.from('lab_order_items').update({
      status: 'resulted', result_value: String(value ?? ''), result_numeric: numeric, result_flag: flag,
      result_notes: `Auto-received from device reading`, resulted_by: profile?.id, resulted_at: new Date().toISOString(),
      device_reading_id: reading.id,
    }).eq('id', item.id);
    if (itemError) { setSaving(false); setError(itemError.message); return; }
    const { error: readingError } = await supabase.from('device_readings').update({
      status: 'applied', applied_by: profile?.id, applied_at: new Date().toISOString(), matched_lab_order_item_id: item.id,
    }).eq('id', reading.id);
    setSaving(false);
    if (readingError) { setError(readingError.message); return; }
    qc.invalidateQueries({ queryKey: ['device-readings'] });
  };

  if (!items || items.length === 0) return <p className="text-muted" style={{ fontSize: 12 }}>No open lab order for this patient to apply this reading to.</p>;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="input" style={{ width: 220 }} value={selectedId} onChange={(e) => setItemId(e.target.value)}>
        <option value="">Select lab order item…</option>
        {items.map((it: any) => <option key={it.id} value={it.id}>{it.lab_test_catalog?.test_name}</option>)}
      </select>
      <button className="btn btn-primary" onClick={apply} disabled={!selectedId || saving}>{saving ? 'Applying…' : 'Apply to lab result'}</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function ApplyOphthalmicReading({ reading, patient }: { reading: any; patient: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [visitId, setVisitId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: visits } = useQuery({
    queryKey: ['recent-visits-for-patient', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('visits').select('id, clinic_module, checked_in_at, stage').eq('patient_id', patient.id).order('checked_in_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const apply = async () => {
    if (!visitId) return;
    setSaving(true);
    setError(null);
    const p = reading.raw_payload ?? {};
    let insertError: any = null;
    if (reading.reading_type === 'iop') {
      ({ error: insertError } = await supabase.from('iop_readings').insert({ visit_id: visitId, iop_od: p.iop_od ?? null, iop_os: p.iop_os ?? null, method: p.method ?? 'device', performed_by: profile?.id }));
    } else if (reading.reading_type === 'refraction') {
      ({ error: insertError } = await supabase.from('refractions').insert({
        visit_id: visitId, sphere_od: p.sphere_od ?? null, cylinder_od: p.cylinder_od ?? null, axis_od: p.axis_od ?? null,
        sphere_os: p.sphere_os ?? null, cylinder_os: p.cylinder_os ?? null, axis_os: p.axis_os ?? null, method: p.method ?? 'device', performed_by: profile?.id,
      }));
    } else if (reading.reading_type === 'biometry') {
      ({ error: insertError } = await supabase.from('imaging_records').insert({
        visit_id: visitId, imaging_type: p.imaging_type ?? 'biometry', axial_length_od: p.axial_length_od ?? null, axial_length_os: p.axial_length_os ?? null,
        k1_od: p.k1_od ?? null, k2_od: p.k2_od ?? null, k1_os: p.k1_os ?? null, k2_os: p.k2_os ?? null,
        iol_power_od: p.iol_power_od ?? null, iol_power_os: p.iol_power_os ?? null, iol_formula: p.iol_formula ?? null, performed_by: profile?.id,
      }));
    }
    if (insertError) { setSaving(false); setError(insertError.message); return; }
    const { error: readingError } = await supabase.from('device_readings').update({
      status: 'applied', applied_by: profile?.id, applied_at: new Date().toISOString(), matched_visit_id: visitId,
    }).eq('id', reading.id);
    setSaving(false);
    if (readingError) { setError(readingError.message); return; }
    qc.invalidateQueries({ queryKey: ['device-readings'] });
  };

  if (!visits || visits.length === 0) return <p className="text-muted" style={{ fontSize: 12 }}>No visits found for this patient to attach this reading to.</p>;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="input" style={{ width: 260 }} value={visitId} onChange={(e) => setVisitId(e.target.value)}>
        <option value="">Select visit…</option>
        {visits.map((v: any) => <option key={v.id} value={v.id}>{v.clinic_module} — {v.checked_in_at ? new Date(v.checked_in_at).toLocaleDateString() : ''} ({v.stage})</option>)}
      </select>
      <button className="btn btn-primary" onClick={apply} disabled={!visitId || saving}>{saving ? 'Applying…' : 'Apply to visit'}</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function ReadingRow({ reading, role }: { reading: any; role: string | undefined }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const canApplyLab = reading.reading_type === 'lab_result' && (role === 'lab_technician' || role === 'admin');
  const canApplyOphthalmic = (reading.reading_type === 'iop' || reading.reading_type === 'refraction' || reading.reading_type === 'biometry') && (role === 'optometrist' || role === 'doctor' || role === 'admin');

  const reject = async () => {
    await supabase.from('device_readings').update({ status: 'rejected' }).eq('id', reading.id);
    qc.invalidateQueries({ queryKey: ['device-readings'] });
  };

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {reading.device_registry?.device_name}</button></td>
        <td>{reading.reading_type.replace(/_/g, ' ')}</td>
        <td>{reading.patients?.full_name ?? <span className="text-muted">{reading.patient_identifier ?? '—'}</span>}</td>
        <td>{new Date(reading.received_at).toLocaleString()}</td>
        <td><span className="tag tag-outline" style={STATUS_STYLE[reading.status]}>{reading.status}</span></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <pre style={{ fontSize: 12, background: 'var(--color-accent-100)', padding: 8, borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>{JSON.stringify(reading.raw_payload, null, 2)}</pre>

              {reading.status === 'unmatched' && <MatchPatientControl reading={reading} />}
              {reading.status === 'matched' && reading.patients && (
                <>
                  {canApplyLab && <ApplyLabResult reading={reading} patient={reading.patients} />}
                  {canApplyOphthalmic && <ApplyOphthalmicReading reading={reading} patient={reading.patients} />}
                  {!canApplyLab && !canApplyOphthalmic && <p className="text-muted" style={{ fontSize: 12 }}>Matched to {reading.patients.full_name} — applying this reading needs {reading.reading_type === 'lab_result' ? 'a lab technician' : 'a doctor or optometrist'}.</p>}
                </>
              )}
              {(reading.status === 'unmatched' || reading.status === 'matched') && (
                <div style={{ marginTop: 8 }}><button className="btn btn-ghost" onClick={reject}>Reject reading</button></div>
              )}
              {reading.status === 'applied' && <p className="text-muted" style={{ fontSize: 12 }}>Applied {reading.applied_at ? new Date(reading.applied_at).toLocaleString() : ''}.</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const READING_STATUSES = ['unmatched', 'matched', 'applied', 'rejected'];
type ReadingStatusFilter = 'open' | 'all' | (typeof READING_STATUSES)[number];

function ReadingsTab() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReadingStatusFilter>('open');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: readings, isLoading } = useQuery({
    queryKey: ['device-readings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('device_readings').select('*, device_registry(device_name), patients(full_name, uhid, gender)').order('received_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (readings ?? []).filter((r: any) => {
    if (statusFilter === 'open' && (r.status === 'applied' || r.status === 'rejected')) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.reading_type !== typeFilter) return false;
    if (!term) return true;
    return r.device_registry?.device_name?.toLowerCase().includes(term) || r.patients?.full_name?.toLowerCase().includes(term) || r.patient_identifier?.toLowerCase().includes(term);
  });

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>Readings pushed in by instruments — match to a patient, then apply into the chart or lab result. Nothing is written into a clinical record automatically.</p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 240, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Device, patient or ID sent" />
        </div>
        <div className="field" style={{ maxWidth: 160, marginBottom: 0 }}>
          <label>Type</label>
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            {READING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="seg" style={{ maxWidth: 400 }}>
          {(['open', 'all', ...READING_STATUSES] as ReadingStatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f}
            </label>
          ))}
        </div>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Device</th><th>Type</th><th>Patient</th><th>Received</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((r: any) => <ReadingRow key={r.id} reading={r} role={profile?.role} />)}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-muted">No readings match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Failed Submissions (retry queue) ----------------

function RetryFailureForm({ failure, onDone }: { failure: any; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const rawBody = failure.raw_body ?? {};
  const [readingType, setReadingType] = useState(READING_TYPES.includes(rawBody.reading_type) ? rawBody.reading_type : 'other');
  const [patientIdentifier, setPatientIdentifier] = useState(rawBody.patient_identifier ?? '');
  const [payloadText, setPayloadText] = useState(JSON.stringify(rawBody.payload ?? {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = async () => {
    setError(null);
    let payload: any;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError('Payload must be valid JSON.');
      return;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      setError('Payload must be a JSON object.');
      return;
    }
    setSaving(true);
    let matchedPatientId: string | null = null;
    let status = 'unmatched';
    if (patientIdentifier.trim()) {
      const { data: patients } = await supabase.from('patients').select('id').is('merged_into', null).ilike('uhid', patientIdentifier.trim());
      if (patients && patients.length === 1) { matchedPatientId = patients[0].id; status = 'matched'; }
    }
    const { error: insertError } = await supabase.from('device_readings').insert({
      device_id: failure.device_id, reading_type: readingType, patient_identifier: patientIdentifier.trim() || null,
      raw_payload: payload, status, matched_patient_id: matchedPatientId,
    });
    if (insertError) { setSaving(false); setError(insertError.message); return; }
    const { error: resolveError } = await supabase.from('device_ingest_failures').update({
      resolved: true, resolved_by: profile?.id, resolved_at: new Date().toISOString(),
    }).eq('id', failure.id);
    setSaving(false);
    if (resolveError) { setError(resolveError.message); return; }
    qc.invalidateQueries({ queryKey: ['device-ingest-failures'] });
    qc.invalidateQueries({ queryKey: ['device-readings'] });
    onDone();
  };

  return (
    <div style={{ padding: 8, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)', marginTop: 8 }}>
      <p className="text-muted" style={{ fontSize: 12, marginTop: 0 }}>Review and correct the original submission, then create the reading manually — this is recorded as a manual recovery, not a device-originated reading.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <div className="field" style={{ flex: '0 1 160px', marginBottom: 0 }}>
          <label style={{ fontSize: 11 }}>Reading type</label>
          <select className="input" value={readingType} onChange={(e) => setReadingType(e.target.value)}>
            {READING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
          <label style={{ fontSize: 11 }}>Patient identifier (UHID)</label>
          <input className="input" value={patientIdentifier} onChange={(e) => setPatientIdentifier(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 11 }}>Payload (JSON)</label>
        <textarea className="input" rows={6} style={{ fontFamily: 'monospace', fontSize: 12 }} value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={resolve} disabled={saving}>{saving ? 'Saving…' : 'Create reading & resolve'}</button>
      <button className="btn btn-ghost" onClick={onDone} style={{ marginLeft: 6 }}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function FailureRow({ failure }: { failure: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const dismiss = async () => {
    await supabase.from('device_ingest_failures').update({ resolved: true, resolved_by: profile?.id, resolved_at: new Date().toISOString() }).eq('id', failure.id);
    qc.invalidateQueries({ queryKey: ['device-ingest-failures'] });
  };

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {failure.device_registry?.device_name ?? 'Unknown device'}</button></td>
        <td>{failure.reading_type ?? '—'}</td>
        <td>{failure.error_message}</td>
        <td>{new Date(failure.occurred_at).toLocaleString()}</td>
        <td>{failure.resolved ? <span className="tag tag-accent">resolved</span> : <span className="tag tag-outline" style={{ background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' }}>open</span>}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <pre style={{ fontSize: 12, background: 'var(--color-accent-100)', padding: 8, borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>{JSON.stringify(failure.raw_body, null, 2)}</pre>
              {!failure.resolved && !retrying && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" onClick={() => setRetrying(true)}>Retry / correct & resolve</button>
                  <button className="btn btn-ghost" onClick={dismiss}>Dismiss (no reading)</button>
                </div>
              )}
              {retrying && <RetryFailureForm failure={failure} onDone={() => setRetrying(false)} />}
              {failure.resolved && <p className="text-muted" style={{ fontSize: 12 }}>Resolved {failure.resolved_at ? new Date(failure.resolved_at).toLocaleString() : ''}.</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FailuresTab() {
  const [showResolved, setShowResolved] = useState(false);
  const { data: failures, isLoading } = useQuery({
    queryKey: ['device-ingest-failures'],
    queryFn: async () => {
      const { data, error } = await supabase.from('device_ingest_failures').select('*, device_registry(device_name)').order('occurred_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (failures ?? []).filter((f: any) => showResolved || !f.resolved);
  const openCount = (failures ?? []).filter((f: any) => !f.resolved).length;

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Submissions a device sent that couldn't be processed — bad payload shape or a database error, logged once the device has authenticated. Correct and resolve, or dismiss if not actionable.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved ({openCount} open)
      </label>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Device</th><th>Type</th><th>Error</th><th>Occurred</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((f: any) => <FailureRow key={f.id} failure={f} />)}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-muted">No failed submissions.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export function DeviceIntegrationPage() {
  const { profile } = useAuth();
  const canManageDevices = profile?.role === 'biomedical_engineer' || profile?.role === 'admin';
  const [tab, setTab] = useState<'readings' | 'devices' | 'failures'>('readings');

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Device Integration</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Instruments that push readings in directly via API — lab analyzers, autorefractors, tonometers, biometers, OCT and more.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {[{ key: 'readings', label: 'Incoming Readings' }, { key: 'devices', label: 'Devices' }, { key: 'failures', label: 'Failed Submissions' }].map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key as typeof tab)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'readings' && <ReadingsTab />}
      {tab === 'devices' && <DevicesTab canManage={canManageDevices} />}
      {tab === 'failures' && <FailuresTab />}
    </div>
  );
}
