import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { printRecordRequestReceipt } from '../lib/printRecordRequestReceipt';
import { fetchClaimFileData } from '../lib/fetchClaimFileData';
import { printClaimFile } from '../lib/printClaimFile';

const REQUESTOR_TYPES = ['patient', 'insurance', 'legal', 'referring_doctor', 'other'];
const STATUSES = ['requested', 'approved', 'issued', 'rejected'];

// The compiled record file is the same content for every requestor — it's
// literally the same file that already goes out for an insurance claim
// (fetchClaimFileData/printClaimFile) — only the printed heading changes so
// the document identifies itself correctly for why it's actually being
// disclosed.
const DOCUMENT_TITLE: Record<string, string> = {
  patient: 'Medical Record File — Patient Copy',
  insurance: 'Medical Record File — Insurance',
  legal: 'Medical Record File — Legal Request',
  referring_doctor: 'Medical Record File — Referral',
  other: 'Medical Record File',
};

function VisitPicker({ patientId, value, onChange }: { patientId: string; value: string; onChange: (visitId: string) => void }) {
  const { data: visits } = useQuery({
    queryKey: ['mrd-patient-visits', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('visits').select('id, clinic_module, created_at, token_number').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Not visit-specific —</option>
      {visits?.map((v: any) => (
        <option key={v.id} value={v.id}>{v.clinic_module} — {new Date(v.created_at).toLocaleDateString()}{v.token_number ? ` (${v.token_number})` : ''}</option>
      ))}
    </select>
  );
}

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [visitId, setVisitId] = useState('');
  const [form, setForm] = useState({ requestor_type: 'patient', requestor_name: '', purpose: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['mrd-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${sanitizeSearchTerm(debouncedQuery)}%,uhid.ilike.%${sanitizeSearchTerm(debouncedQuery)}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('record_requests').insert({
      patient_id: selectedPatient.id,
      visit_id: visitId || null,
      requestor_type: form.requestor_type,
      requestor_name: form.requestor_name || null,
      purpose: form.purpose || null,
      notes: form.notes || null,
      authorized_by: profile?.id,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['record-requests'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log record request</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 240px', position: 'relative' }}>
          <label>Patient *</label>
          <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => { setSelectedPatient(p); setVisitId(''); }}>{p.full_name} — {p.uhid}</div>)}
            </div>
          )}
        </div>
        {selectedPatient && (
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label>Visit (optional — needed to generate the record file)</label>
            <VisitPicker patientId={selectedPatient.id} value={visitId} onChange={setVisitId} />
          </div>
        )}
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Requestor type</label>
          <select className="input" value={form.requestor_type} onChange={(e) => set('requestor_type', e.target.value)}>
            {REQUESTOR_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Requestor name</label><input className="input" value={form.requestor_name} onChange={(e) => set('requestor_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Purpose</label><input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="e.g. insurance claim, legal proceeding, referral" /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving || !selectedPatient}>{saving ? 'Saving…' : 'Log request'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function RequestRow({ r, onStatusChange }: { r: any; onStatusChange: (id: string, status: string) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [attaching, setAttaching] = useState(false);
  const [pendingVisitId, setPendingVisitId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const attachVisit = async () => {
    if (!pendingVisitId) return;
    const { error } = await supabase.from('record_requests').update({ visit_id: pendingVisitId }).eq('id', r.id);
    if (error) { setRowError(error.message); return; }
    setAttaching(false);
    qc.invalidateQueries({ queryKey: ['record-requests'] });
  };

  const generateFile = async () => {
    if (!r.visit_id) return;
    setGenerating(true);
    setRowError(null);
    try {
      const data = await fetchClaimFileData(r.visit_id);
      printClaimFile(data, DOCUMENT_TITLE[r.requestor_type] ?? 'Medical Record File');
    } catch (e: any) {
      setRowError(e.message ?? 'Could not generate the record file.');
    }
    setGenerating(false);
  };

  return (
    <tr>
      <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${r.patient_id}`)}>
        {r.patients?.full_name} <span className="text-muted">({r.patients?.uhid})</span>
      </td>
      <td>{r.requestor_type.replace(/_/g, ' ')}{r.requestor_name ? ` — ${r.requestor_name}` : ''}</td>
      <td>{r.purpose ?? '—'}</td>
      <td>{new Date(r.created_at).toLocaleDateString()}</td>
      <td>
        <select className="input" value={r.status} onChange={(e) => onStatusChange(r.id, e.target.value)} style={{ width: 150 }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => printRecordRequestReceipt(r)}>Print receipt</button>
          {r.visit_id ? (
            <button className="btn btn-secondary" onClick={generateFile} disabled={generating}>{generating ? 'Preparing…' : 'Generate record file'}</button>
          ) : attaching ? (
            <>
              <VisitPicker patientId={r.patient_id} value={pendingVisitId} onChange={setPendingVisitId} />
              <button className="btn btn-ghost" onClick={attachVisit} disabled={!pendingVisitId}>Attach</button>
              <button className="btn btn-ghost" onClick={() => setAttaching(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => setAttaching(true)}>Attach visit to generate file</button>
          )}
        </div>
        {rowError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{rowError}</div>}
      </td>
    </tr>
  );
}

const REQUEST_STATUS_FILTERS = ['open', 'all', ...STATUSES];

export function MrdRecordRequestsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['record-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('record_requests').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const payload: Record<string, any> = { status };
    if (status === 'issued') payload.issued_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('record_requests').update(payload).eq('id', id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['record-requests'] });
  };

  const term = search.trim().toLowerCase();
  const filtered = (requests ?? []).filter((r: any) => {
    if (statusFilter === 'open' && (r.status === 'issued' || r.status === 'rejected')) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!term) return true;
    return r.patients?.full_name?.toLowerCase().includes(term) || r.patients?.uhid?.toLowerCase().includes(term) || r.requestor_name?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Record Request Register</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log request</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>Every disclosure of a patient's record outside the hospital — to the patient, an insurer, a legal request, or a referring doctor — logged with who authorized it.</p>

      {showForm && <NewRequestForm onDone={() => setShowForm(false)} />}
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient name, UHID or requestor" />
        </div>
        <div className="seg" style={{ maxWidth: 480 }}>
          {REQUEST_STATUS_FILTERS.map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f}
            </label>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Requestor</th><th>Purpose</th><th>Logged</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((r: any) => <RequestRow key={r.id} r={r} onStatusChange={updateStatus} />)}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-muted">No record requests match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
