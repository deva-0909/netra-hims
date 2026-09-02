import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';

const DISCARD_REASONS = ['failed_serology', 'poor_quality', 'expired_unused', 'contaminated', 'other'];

const PRESERVATION_METHODS = ['mccarey_kaufman', 'optisol_gs', 'cryopreservation', 'other'];
const SEROLOGY_STATUSES = ['pending', 'non_reactive', 'reactive'];
const STATUSES = ['available', 'allocated', 'used', 'discarded', 'expired'];
const TERMINAL_STATUSES = ['discarded', 'used'];
type StatusFilter = 'active' | 'all' | (typeof STATUSES)[number];

function genTissueNumber() {
  return `EB-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function NewTissueForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [donorId, setDonorId] = useState('');
  const [form, setForm] = useState({ eye: 'od', retrieval_datetime: '', preservation_method: 'optisol_gs', tissue_quality_grade: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: donors } = useQuery({
    queryKey: ['eye-bank-donors-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_donors').select('id, donor_name').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorId) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('eye_bank_tissues').insert({
      donor_id: donorId,
      tissue_number: genTissueNumber(),
      eye: form.eye,
      retrieval_datetime: form.retrieval_datetime || null,
      retrieved_by: profile?.id,
      preservation_method: form.preservation_method,
      tissue_quality_grade: form.tissue_quality_grade || null,
      expiry_date: form.expiry_date || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log harvested tissue</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Donor *</label>
          <select className="input" value={donorId} onChange={(e) => setDonorId(e.target.value)} required>
            <option value="">— select donor —</option>
            {donors?.map((d: any) => <option key={d.id} value={d.id}>{d.donor_name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label>Eye</label>
          <select className="input" value={form.eye} onChange={(e) => set('eye', e.target.value)}>
            <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Retrieval date/time</label><input className="input" type="datetime-local" value={form.retrieval_datetime} onChange={(e) => set('retrieval_datetime', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Preservation method</label>
          <select className="input" value={form.preservation_method} onChange={(e) => set('preservation_method', e.target.value)}>
            {PRESERVATION_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Tissue quality grade</label><input className="input" value={form.tissue_quality_grade} onChange={(e) => set('tissue_quality_grade', e.target.value)} placeholder="e.g. ECD 2400/mm²" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Expiry date</label><input className="input" type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log tissue'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function AllocateForm({ tissue, onDone }: { tissue: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serologyCleared = tissue.serology_hiv === 'non_reactive' && tissue.serology_hbsag === 'non_reactive' && tissue.serology_hcv === 'non_reactive';
  const expired = tissue.expiry_date ? daysUntil(tissue.expiry_date) < 0 : false;
  const blocked = !serologyCleared || expired;

  const { data: matches } = useQuery({
    queryKey: ['tissue-allocate-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedQuery);
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('eye_bank_tissues').update({
      status: 'allocated', allocated_to_patient_id: selectedPatient.id, allocated_date: new Date().toISOString(),
    }).eq('id', tissue.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: 8, background: 'var(--color-accent-100)' }}>
      {blocked ? (
        <>
          <span style={{ color: '#8a2c2c', fontSize: 12 }}>
            {expired ? `Cannot allocate — this tissue expired on ${new Date(tissue.expiry_date).toLocaleDateString()}.` : 'Cannot allocate — HIV, HBsAg and HCV serology must all be non-reactive first.'}
          </span>
          <button className="btn btn-ghost" onClick={onDone}>Close</button>
        </>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <input className="input" style={{ width: 220 }} value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
              onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search recipient by name or UHID" />
            {!selectedPatient && matches && matches.length > 0 && (
              <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: 260, maxHeight: 180, overflowY: 'auto', padding: 4 }}>
                {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer', fontSize: 13 }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !selectedPatient}>{saving ? 'Saving…' : 'Confirm allocation'}</button>
          <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
          {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
        </>
      )}
    </div>
  );
}

function DiscardForm({ tissue, onDone }: { tissue: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('failed_serology');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('eye_bank_tissues').update({ status: 'discarded', discard_reason: reason }).eq('id', tissue.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: 8, background: 'var(--color-accent-100)' }}>
      <select className="input" style={{ width: 180 }} value={reason} onChange={(e) => setReason(e.target.value)}>
        {DISCARD_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
      </select>
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm discard'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function TissueRow({ tissue }: { tissue: any }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'allocate' | 'discard' | null>(null);
  const expiryDays = tissue.expiry_date ? daysUntil(tissue.expiry_date) : null;
  const isExpired = expiryDays !== null && expiryDays < 0 && tissue.status === 'available';
  const expiringSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= 3;
  const isTerminal = TERMINAL_STATUSES.includes(tissue.status);
  const serologyCleared = tissue.serology_hiv === 'non_reactive' && tissue.serology_hbsag === 'non_reactive' && tissue.serology_hcv === 'non_reactive';

  const { data: allocatedPatient } = useQuery({
    queryKey: ['tissue-allocated-patient', tissue.allocated_to_patient_id],
    enabled: !!tissue.allocated_to_patient_id,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('full_name, uhid').eq('id', tissue.allocated_to_patient_id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateField = async (field: string, value: string) => {
    if (field === 'status' && value === 'allocated') { setPendingAction('allocate'); return; }
    if (field === 'status' && value === 'discarded') { setPendingAction('discard'); return; }
    setError(null);
    const { error: updateError } = await supabase.from('eye_bank_tissues').update({ [field]: value }).eq('id', tissue.id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
  };

  return (
    <>
      <tr>
        <td>{tissue.tissue_number}</td>
        <td>{tissue.eye_bank_donors?.donor_name}</td>
        <td>{tissue.eye.toUpperCase()}</td>
        <td>
          <select className="input" value={tissue.preservation_method} onChange={(e) => updateField('preservation_method', e.target.value)} style={{ width: 150 }}>
            {PRESERVATION_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </td>
        <td>
          <select className="input" value={tissue.serology_hiv} onChange={(e) => updateField('serology_hiv', e.target.value)} style={{ width: 120 }}>
            {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HIV: {s.replace(/_/g, ' ')}</option>)}
          </select>
        </td>
        <td>
          <select className="input" value={tissue.serology_hbsag} onChange={(e) => updateField('serology_hbsag', e.target.value)} style={{ width: 130 }}>
            {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HBsAg: {s.replace(/_/g, ' ')}</option>)}
          </select>
        </td>
        <td>
          <select className="input" value={tissue.serology_hcv} onChange={(e) => updateField('serology_hcv', e.target.value)} style={{ width: 120 }}>
            {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HCV: {s.replace(/_/g, ' ')}</option>)}
          </select>
        </td>
        <td>
          <input className="input" type="date" style={{ width: 130, ...((isExpired || expiringSoon) ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : {}) }} value={tissue.expiry_date ?? ''} onChange={(e) => updateField('expiry_date', e.target.value)} disabled={isTerminal} />
          {isExpired && <div style={{ fontSize: 11, color: '#8a2c2c' }}>Expired {Math.abs(expiryDays!)}d ago</div>}
          {!isExpired && expiringSoon && <div style={{ fontSize: 11, color: '#8a2c2c' }}>{expiryDays}d left</div>}
        </td>
        <td>
          {isTerminal ? (
            <span className="tag tag-outline">{tissue.status}</span>
          ) : (
            <select className="input" value={tissue.status} onChange={(e) => updateField('status', e.target.value)} style={{ width: 130 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {!isTerminal && !serologyCleared && tissue.status === 'available' && (
            <div style={{ fontSize: 11, color: '#8a6d1a' }}>Serology incomplete — cannot allocate</div>
          )}
          {tissue.status === 'allocated' && allocatedPatient && (
            <div className="text-muted" style={{ fontSize: 11 }}>→ {allocatedPatient.full_name} ({allocatedPatient.uhid})</div>
          )}
          {tissue.status === 'discarded' && tissue.discard_reason && (
            <div className="text-muted" style={{ fontSize: 11 }}>{tissue.discard_reason.replace(/_/g, ' ')}</div>
          )}
        </td>
        {error && <td style={{ color: '#b64545', fontSize: 11 }}>{error}</td>}
      </tr>
      {pendingAction === 'allocate' && (
        <tr><td colSpan={9}><AllocateForm tissue={tissue} onDone={() => setPendingAction(null)} /></td></tr>
      )}
      {pendingAction === 'discard' && (
        <tr><td colSpan={9}><DiscardForm tissue={tissue} onDone={() => setPendingAction(null)} /></td></tr>
      )}
    </>
  );
}

export function EyeBankTissuesPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const { data: tissues, isLoading } = useQuery({
    queryKey: ['eye-bank-tissues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_tissues').select('*, eye_bank_donors(donor_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const expiringSoonCount = (tissues ?? []).filter((t: any) => t.expiry_date && t.status === 'available' && daysUntil(t.expiry_date) >= 0 && daysUntil(t.expiry_date) <= 3).length;
  const expiredCount = (tissues ?? []).filter((t: any) => t.expiry_date && t.status === 'available' && daysUntil(t.expiry_date) < 0).length;

  const term = search.trim().toLowerCase();
  const filtered = (tissues ?? []).filter((t: any) => {
    if (statusFilter === 'active' && TERMINAL_STATUSES.includes(t.status)) return false;
    if (statusFilter !== 'active' && statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!term) return true;
    return t.tissue_number?.toLowerCase().includes(term) || t.eye_bank_donors?.donor_name?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Eye Bank — Tissues</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log tissue</button>}
      </div>
      {expiredCount > 0 && (
        <div className="card" style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-3)', background: '#f6dede' }}>
          <span style={{ color: '#8a2c2c', fontSize: 13 }}>{expiredCount} tissue(s) past their expiry date and still marked available — cannot be allocated.</span>
        </div>
      )}
      {expiringSoonCount > 0 && (
        <div className="card" style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-4)', background: '#f6dede' }}>
          <span style={{ color: '#8a2c2c', fontSize: 13 }}>{expiringSoonCount} tissue(s) expiring within 3 days and still marked available.</span>
        </div>
      )}

      {showForm && <NewTissueForm onDone={() => setShowForm(false)} />}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tissue # or donor name" />
        </div>
        <div className="seg" style={{ maxWidth: 560 }}>
          {(['active', 'all', ...STATUSES] as StatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Tissue #</th><th>Donor</th><th>Eye</th><th>Preservation</th><th>HIV</th><th>HBsAg</th><th>HCV</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((t: any) => <TissueRow key={t.id} tissue={t} />)}
            {filtered.length === 0 && <tr><td colSpan={9} className="text-muted">No tissues match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
