import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { FileUploadField } from '../components/FileUploadField';
import { printIncidentReport } from '../lib/printIncidentReport';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';

const INCIDENT_TYPES = ['adverse_event', 'near_miss', 'needle_stick', 'fall', 'medication_error', 'equipment_failure', 'other'];
const INFECTION_TYPES = ['surgical_site_infection', 'urinary_tract_infection', 'bloodstream_infection', 'respiratory_infection', 'other'];
const INFECTION_SEVERITIES = ['mild', 'moderate', 'severe'];
const INFECTION_OUTCOMES = ['ongoing', 'resolved', 'transferred', 'death'];
const GRIEVANCE_TYPES = ['billing', 'waiting_time', 'staff_behavior', 'clinical_care', 'facility', 'other'];
const GRIEVANCE_STATUS_STYLE: Record<string, React.CSSProperties> = {
  open: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  under_review: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
  resolved: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  closed: { background: '#e8e8e8', color: '#555' },
};
const SEVERITIES = ['minor', 'moderate', 'major', 'critical'];
const LICENSE_TYPES = ['aerb_laser', 'biomedical_waste_authorization', 'fire_noc', 'pollution_control', 'trade_license', 'nabh_accreditation', 'drug_license', 'other'];

const SEVERITY_STYLE: Record<string, React.CSSProperties> = {
  minor: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  moderate: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  major: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  critical: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3', fontWeight: 700 },
};
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  open: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  under_review: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
  closed: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  active: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  expired: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  renewal_pending: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysUntil = (dateStr: string) => Math.round((new Date(dateStr).getTime() - new Date(todayISO()).getTime()) / 86400000);

// regulatory_licenses.status is set at creation and never auto-updates — the
// real status is always derived from expiry_date, same as CommandCenterPage
// already does for its compliance-alerts widget.
function computeLicenseStatus(days: number): 'expired' | 'renewal_pending' | 'active' {
  if (days < 0) return 'expired';
  if (days <= 60) return 'renewal_pending';
  return 'active';
}

// ---------------- Incident Reports ----------------

function ReportIncidentForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [form, setForm] = useState({ incident_type: 'near_miss', severity: 'minor', department: '', description: '', immediate_action_taken: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: matches } = useQuery({
    queryKey: ['incident-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedQuery);
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('incident_reports').insert({
      incident_type: form.incident_type, severity: form.severity, department: form.department || null,
      patient_id: selectedPatient?.id ?? null,
      description: form.description, immediate_action_taken: form.immediate_action_taken || null, reported_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['incident-reports'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Report an incident</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>Log on behalf of whoever reported it — adverse events, near-misses, needle-stick injuries, falls, medication errors.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Type</label>
          <select className="input" value={form.incident_type} onChange={(e) => set('incident_type', e.target.value)}>
            {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Severity</label>
          <select className="input" value={form.severity} onChange={(e) => set('severity', e.target.value)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 220px', position: 'relative' }}>
          <label>Patient (optional)</label>
          <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
            </div>
          )}
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>What happened? *</label><textarea className="input" value={form.description} onChange={(e) => set('description', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Immediate action taken</label><textarea className="input" value={form.immediate_action_taken} onChange={(e) => set('immediate_action_taken', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function IncidentRow({ incident }: { incident: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState(incident.review_notes ?? '');
  const [rootCause, setRootCause] = useState(incident.root_cause ?? '');
  const [correctiveAction, setCorrectiveAction] = useState(incident.corrective_action ?? '');
  const [targetDate, setTargetDate] = useState(incident.target_date ?? '');
  const [actionError, setActionError] = useState<string | null>(null);

  const decide = async (status: string) => {
    setActionError(null);
    const { error } = await supabase.from('incident_reports').update({
      status, review_notes: reviewNotes || null, reviewed_by: profile?.id,
      root_cause: rootCause || null, corrective_action: correctiveAction || null, target_date: targetDate || null,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', incident.id);
    if (error) { setActionError(error.message); return; }
    qc.invalidateQueries({ queryKey: ['incident-reports'] });
  };

  return (
    <tr>
      <td>{new Date(incident.incident_date).toLocaleDateString()}</td>
      <td>{incident.incident_type.replace(/_/g, ' ')}</td>
      <td><span className="tag tag-outline" style={SEVERITY_STYLE[incident.severity]}>{incident.severity}</span></td>
      <td className="text-muted" style={{ maxWidth: 260 }}>
        {incident.description}
        {incident.patients && <div style={{ fontSize: 11 }}>Patient: {incident.patients.full_name} ({incident.patients.uhid})</div>}
      </td>
      <td><span className="tag tag-outline" style={STATUS_STYLE[incident.status]}>{incident.status.replace(/_/g, ' ')}</span></td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {incident.status !== 'closed' && (
            <>
              <input className="input" style={{ width: 140 }} placeholder="Review notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              {incident.severity === 'critical' && (
                <>
                  <input className="input" style={{ width: 160 }} placeholder="Root cause (required to close)" value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
                  <input className="input" style={{ width: 160 }} placeholder="Corrective action (required to close)" value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
                  <input className="input" style={{ width: 130 }} type="date" title="Target date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </>
              )}
              {incident.status === 'open' && <button className="btn btn-ghost" onClick={() => decide('under_review')}>Review</button>}
              <button className="btn btn-ghost" onClick={() => decide('closed')}>Close</button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => printIncidentReport(incident)}>Print</button>
        </div>
        {actionError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 2 }}>{actionError}</div>}
      </td>
    </tr>
  );
}

const INCIDENT_STATUSES = ['open', 'under_review', 'closed'];
type IncidentStatusFilter = 'open' | 'all' | (typeof INCIDENT_STATUSES)[number];

function IncidentReportsTab() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<IncidentStatusFilter>('open');
  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incident-reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('incident_reports').select('*, patients(full_name, uhid)').order('incident_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (incidents ?? []).filter((i: any) => {
    if (statusFilter === 'open' && i.status === 'closed') return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    if (!term) return true;
    return i.description?.toLowerCase().includes(term) || i.department?.toLowerCase().includes(term) || i.incident_type?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Adverse events, near-misses and safety incidents — visible only to quality_manager and admin.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Report incident</button>}
      </div>
      {showForm && <ReportIncidentForm onDone={() => setShowForm(false)} />}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 240, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Description, department or type" />
        </div>
        <div className="field" style={{ maxWidth: 160, marginBottom: 0 }}>
          <label>Severity</label>
          <select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="seg" style={{ maxWidth: 320 }}>
          {(['open', 'all', ...INCIDENT_STATUSES] as IncidentStatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Description</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((i: any) => <IncidentRow key={i.id} incident={i} />)}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-muted">No incidents match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Infection Surveillance ----------------

function ReportInfectionForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [form, setForm] = useState({ infection_type: 'surgical_site_infection', onset_date: todayISO(), severity: 'mild', organism_identified: '', management: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: matches } = useQuery({
    queryKey: ['infection-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedQuery);
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('infection_surveillance_records').insert({
      patient_id: selectedPatient.id, infection_type: form.infection_type, onset_date: form.onset_date, severity: form.severity,
      organism_identified: form.organism_identified || null, management: form.management || null, notes: form.notes || null, reported_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['infection-surveillance'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Report a healthcare-associated infection</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px', position: 'relative' }}>
          <label>Patient *</label>
          <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" required={!selectedPatient} />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
            </div>
          )}
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Type</label>
          <select className="input" value={form.infection_type} onChange={(e) => set('infection_type', e.target.value)}>
            {INFECTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Onset date</label><input className="input" type="date" value={form.onset_date} onChange={(e) => set('onset_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Severity</label>
          <select className="input" value={form.severity} onChange={(e) => set('severity', e.target.value)}>
            {INFECTION_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Organism identified</label><input className="input" value={form.organism_identified} onChange={(e) => set('organism_identified', e.target.value)} placeholder="e.g. culture pending, MRSA…" /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Management</label><textarea className="input" value={form.management} onChange={(e) => set('management', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function InfectionRow({ record }: { record: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [outcomeDraft, setOutcomeDraft] = useState(record.outcome);
  const [error, setError] = useState<string | null>(null);

  const decide = async (status: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('infection_surveillance_records').update({
      status, outcome: outcomeDraft, reviewed_by: profile?.id,
    }).eq('id', record.id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['infection-surveillance'] });
  };

  const toggleNabh = async () => {
    await supabase.from('infection_surveillance_records').update({ reported_to_nabh: !record.reported_to_nabh }).eq('id', record.id);
    qc.invalidateQueries({ queryKey: ['infection-surveillance'] });
  };

  return (
    <tr>
      <td>{new Date(record.onset_date).toLocaleDateString()}</td>
      <td>{record.patients?.full_name} <span className="text-muted">({record.patients?.uhid})</span></td>
      <td>{record.infection_type.replace(/_/g, ' ')}</td>
      <td><span className="tag tag-outline" style={record.severity === 'severe' ? SEVERITY_STYLE.major : record.severity === 'moderate' ? SEVERITY_STYLE.moderate : SEVERITY_STYLE.minor}>{record.severity}</span></td>
      <td className="text-muted">{record.organism_identified ?? '—'}</td>
      <td><span className="tag tag-outline" style={STATUS_STYLE[record.status]}>{record.status.replace(/_/g, ' ')}</span></td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {record.status !== 'closed' && (
            <>
              <select className="input" style={{ width: 120 }} value={outcomeDraft} onChange={(e) => setOutcomeDraft(e.target.value)}>
                {INFECTION_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {record.status === 'open' && <button className="btn btn-ghost" onClick={() => decide('under_review')}>Review</button>}
              <button className="btn btn-ghost" onClick={() => decide('closed')}>Close</button>
            </>
          )}
          <button className={`btn ${record.reported_to_nabh ? 'btn-secondary' : 'btn-ghost'}`} onClick={toggleNabh}>{record.reported_to_nabh ? 'Reported to NABH ✓' : 'Mark reported to NABH'}</button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 2 }}>{error}</div>}
      </td>
    </tr>
  );
}

function InfectionSurveillanceTab() {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IncidentStatusFilter>('open');
  const { data: records, isLoading } = useQuery({
    queryKey: ['infection-surveillance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('infection_surveillance_records').select('*, patients(full_name, uhid)').order('onset_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (records ?? []).filter((r: any) => {
    if (statusFilter === 'open' && r.status === 'closed') return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCount = (records ?? []).filter((r: any) => r.onset_date?.startsWith(thisMonth)).length;
  const ssiCount = (records ?? []).filter((r: any) => r.infection_type === 'surgical_site_infection' && r.onset_date?.startsWith(thisMonth)).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
          Healthcare-associated infection surveillance for NABH reporting. This month: {thisMonthCount} total, {ssiCount} surgical site.
        </p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Report infection</button>}
      </div>
      {showForm && <ReportInfectionForm onDone={() => setShowForm(false)} />}
      <div className="seg" style={{ maxWidth: 320, marginBottom: 12 }}>
        {(['open', 'all', ...INCIDENT_STATUSES] as IncidentStatusFilter[]).map((f) => (
          <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
          </label>
        ))}
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Onset</th><th>Patient</th><th>Type</th><th>Severity</th><th>Organism</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((r: any) => <InfectionRow key={r.id} record={r} />)}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No infection records match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Regulatory Licenses ----------------

function AddLicenseForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ license_type: 'aerb_laser', license_number: '', issuing_authority: '', issue_date: '', expiry_date: '', notes: '' });
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.expiry_date) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('regulatory_licenses').insert({
      license_type: form.license_type, license_number: form.license_number || null, issuing_authority: form.issuing_authority || null,
      issue_date: form.issue_date || null, expiry_date: form.expiry_date, document_url: docUrl, notes: form.notes || null, created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['regulatory-licenses'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add license / registration</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Type</label>
          <select className="input" value={form.license_type} onChange={(e) => set('license_type', e.target.value)}>
            {LICENSE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>License number</label><input className="input" value={form.license_number} onChange={(e) => set('license_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Issuing authority</label><input className="input" value={form.issuing_authority} onChange={(e) => set('issuing_authority', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Issue date</label><input className="input" type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Expiry date *</label><input className="input" type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Certificate document</label>
          <FileUploadField value={docUrl} onChange={setDocUrl} folder="compliance" />
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add license'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function RegulatoryLicensesTab() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const { data: licenses, isLoading } = useQuery({
    queryKey: ['regulatory-licenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regulatory_licenses').select('*').order('expiry_date');
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (licenses ?? []).filter((l: any) => {
    if (expiringOnly && daysUntil(l.expiry_date) > 60) return false;
    if (!term) return true;
    return l.license_type?.toLowerCase().includes(term) || l.license_number?.toLowerCase().includes(term) || l.issuing_authority?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>AERB laser licences, biomedical waste authorization, fire NOC, NABH accreditation and other statutory registrations.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add license</button>}
      </div>
      {showForm && <AddLicenseForm onDone={() => setShowForm(false)} />}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type, number or authority" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, paddingBottom: 8 }}>
          <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} /> Expiring within 60 days
        </label>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Type</th><th>Number</th><th>Authority</th><th>Expiry</th><th>Status</th><th>Document</th></tr></thead>
          <tbody>
            {filtered.map((l: any) => {
              const days = daysUntil(l.expiry_date);
              return (
                <tr key={l.id}>
                  <td>{l.license_type.replace(/_/g, ' ')}</td>
                  <td>{l.license_number ?? '—'}</td>
                  <td>{l.issuing_authority ?? '—'}</td>
                  <td>
                    <span className="tag tag-outline" style={days < 0 ? SEVERITY_STYLE.critical : days <= 60 ? STATUS_STYLE.renewal_pending : STATUS_STYLE.active}>
                      {l.expiry_date} {days < 0 ? `(${Math.abs(days)}d overdue)` : `(${days}d left)`}
                    </span>
                  </td>
                  <td><span className="tag tag-outline" style={STATUS_STYLE[computeLicenseStatus(days)]}>{computeLicenseStatus(days).replace(/_/g, ' ')}</span></td>
                  <td>{l.document_url ? <a href={l.document_url} target="_blank" rel="noreferrer">view</a> : '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-muted">No licenses match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Patient Grievances ----------------

function ReportGrievanceForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [form, setForm] = useState({ complainant_name: '', complaint_type: 'other', department: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: matches } = useQuery({
    queryKey: ['grievance-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedQuery);
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('patient_grievances').insert({
      patient_id: selectedPatient?.id ?? null,
      complainant_name: form.complainant_name || selectedPatient?.full_name || null,
      complaint_type: form.complaint_type,
      department: form.department || null,
      description: form.description,
      received_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['patient-grievances'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log a patient grievance</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>Any staff member can log a complaint received at their desk — billing disputes, waiting time, staff conduct, clinical care concerns.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px', position: 'relative' }}>
          <label>Patient (optional)</label>
          <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
            </div>
          )}
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Complainant name</label><input className="input" value={form.complainant_name} onChange={(e) => set('complainant_name', e.target.value)} placeholder="If different from patient / anonymous" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Type</label>
          <select className="input" value={form.complaint_type} onChange={(e) => set('complaint_type', e.target.value)}>
            {GRIEVANCE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>What happened? *</label><textarea className="input" value={form.description} onChange={(e) => set('description', e.target.value)} required /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Log grievance'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function GrievanceRow({ grievance }: { grievance: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [resolutionNotes, setResolutionNotes] = useState(grievance.resolution_notes ?? '');
  const [actionError, setActionError] = useState<string | null>(null);

  const decide = async (status: string) => {
    setActionError(null);
    const { error } = await supabase.from('patient_grievances').update({
      status, resolution_notes: resolutionNotes || null, resolved_by: profile?.id,
      resolved_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', grievance.id);
    if (error) { setActionError(error.message); return; }
    qc.invalidateQueries({ queryKey: ['patient-grievances'] });
  };

  return (
    <tr>
      <td>{new Date(grievance.received_at).toLocaleDateString()}</td>
      <td>{grievance.patients?.full_name ?? grievance.complainant_name ?? '—'}</td>
      <td>{grievance.complaint_type.replace(/_/g, ' ')}</td>
      <td className="text-muted" style={{ maxWidth: 260 }}>{grievance.description}</td>
      <td><span className="tag tag-outline" style={GRIEVANCE_STATUS_STYLE[grievance.status]}>{grievance.status.replace(/_/g, ' ')}</span></td>
      <td>
        {grievance.status !== 'closed' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" style={{ width: 160 }} placeholder="Resolution notes" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} />
            {grievance.status === 'open' && <button className="btn btn-ghost" onClick={() => decide('under_review')}>Review</button>}
            {grievance.status !== 'resolved' && <button className="btn btn-ghost" onClick={() => decide('resolved')}>Resolve</button>}
            {grievance.status === 'resolved' && <button className="btn btn-ghost" onClick={() => decide('closed')} disabled={!resolutionNotes.trim()}>Close</button>}
          </div>
        )}
        {actionError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 2 }}>{actionError}</div>}
      </td>
    </tr>
  );
}

const GRIEVANCE_STATUSES = ['open', 'under_review', 'resolved', 'closed'];
type GrievanceStatusFilter = 'open' | 'all' | (typeof GRIEVANCE_STATUSES)[number];

function GrievancesTab() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GrievanceStatusFilter>('open');
  const { data: grievances, isLoading } = useQuery({
    queryKey: ['patient-grievances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('patient_grievances').select('*, patients(full_name, uhid)').order('received_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (grievances ?? []).filter((g: any) => {
    if (statusFilter === 'open' && (g.status === 'resolved' || g.status === 'closed')) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && g.status !== statusFilter) return false;
    if (!term) return true;
    return g.description?.toLowerCase().includes(term) || g.complainant_name?.toLowerCase().includes(term) || g.patients?.full_name?.toLowerCase().includes(term) || g.department?.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Patient-facing complaints — billing, waiting time, staff conduct, clinical care — tracked separately from internal safety incidents. Visible only to quality_manager and admin.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log grievance</button>}
      </div>
      {showForm && <ReportGrievanceForm onDone={() => setShowForm(false)} />}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Complainant, patient, department or description" />
        </div>
        <div className="seg" style={{ maxWidth: 400 }}>
          {(['open', 'all', ...GRIEVANCE_STATUSES] as GrievanceStatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Complainant</th><th>Type</th><th>Description</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((g: any) => <GrievanceRow key={g.id} grievance={g} />)}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-muted">No grievances match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Overview / KPIs ----------------

function monthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

function lastNMonthLabels(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.unshift(d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' }));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

function QualityOverviewTab() {
  const { data: incidents } = useQuery({
    queryKey: ['incident-reports-all-kpi'],
    queryFn: async () => {
      const { data, error } = await supabase.from('incident_reports').select('incident_date, severity').order('incident_date');
      if (error) throw error;
      return data;
    },
  });
  const { data: grievances } = useQuery({
    queryKey: ['patient-grievances-all-kpi'],
    queryFn: async () => {
      const { data, error } = await supabase.from('patient_grievances').select('received_at, resolved_at, status');
      if (error) throw error;
      return data;
    },
  });
  const { data: licenses } = useQuery({
    queryKey: ['regulatory-licenses-all-kpi'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regulatory_licenses').select('expiry_date');
      if (error) throw error;
      return data;
    },
  });

  const months = lastNMonthLabels(6);
  const bySeverityByMonth: Record<string, Record<string, number>> = {};
  for (const m of months) bySeverityByMonth[m] = { minor: 0, moderate: 0, major: 0, critical: 0 };
  for (const i of incidents ?? []) {
    const m = monthLabel(i.incident_date);
    if (bySeverityByMonth[m]) bySeverityByMonth[m][i.severity] = (bySeverityByMonth[m][i.severity] ?? 0) + 1;
  }

  const resolvedGrievances = (grievances ?? []).filter((g: any) => g.resolved_at);
  const avgTatDays = resolvedGrievances.length > 0
    ? resolvedGrievances.reduce((sum: number, g: any) => sum + (new Date(g.resolved_at).getTime() - new Date(g.received_at).getTime()) / 86400000, 0) / resolvedGrievances.length
    : null;
  const openGrievanceCount = (grievances ?? []).filter((g: any) => g.status === 'open' || g.status === 'under_review').length;

  const totalLicenses = (licenses ?? []).length;
  const compliantLicenses = (licenses ?? []).filter((l: any) => daysUntil(l.expiry_date) >= 0).length;
  const complianceRate = totalLicenses > 0 ? Math.round((compliantLicenses / totalLicenses) * 100) : null;

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 'var(--space-4)' }}>Trends across incidents, grievance turnaround and license compliance.</p>
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <div className="card elev-md" style={{ padding: 'var(--space-4)', minWidth: 200 }}>
          <div className="text-muted" style={{ fontSize: 12 }}>Grievance resolution TAT (avg)</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{avgTatDays != null ? `${avgTatDays.toFixed(1)}d` : '—'}</div>
          <div className="text-muted" style={{ fontSize: 11 }}>{openGrievanceCount} currently open/under review</div>
        </div>
        <div className="card elev-md" style={{ padding: 'var(--space-4)', minWidth: 200 }}>
          <div className="text-muted" style={{ fontSize: 12 }}>License compliance rate</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{complianceRate != null ? `${complianceRate}%` : '—'}</div>
          <div className="text-muted" style={{ fontSize: 11 }}>{compliantLicenses}/{totalLicenses} not expired</div>
        </div>
        <div className="card elev-md" style={{ padding: 'var(--space-4)', minWidth: 200 }}>
          <div className="text-muted" style={{ fontSize: 12 }}>Incidents (last 6 months)</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{(incidents ?? []).filter((i: any) => months.includes(monthLabel(i.incident_date))).length}</div>
          <div className="text-muted" style={{ fontSize: 11 }}>{(incidents ?? []).filter((i: any) => i.severity === 'critical').length} critical all-time</div>
        </div>
      </div>

      <h4>Incident count by severity, per month</h4>
      <table className="table">
        <thead><tr><th>Month</th><th>Minor</th><th>Moderate</th><th>Major</th><th>Critical</th></tr></thead>
        <tbody>
          {months.map((m) => (
            <tr key={m}>
              <td>{m}</td>
              <td>{bySeverityByMonth[m].minor}</td>
              <td>{bySeverityByMonth[m].moderate}</td>
              <td>{bySeverityByMonth[m].major}</td>
              <td>{bySeverityByMonth[m].critical > 0 ? <span className="tag tag-outline" style={SEVERITY_STYLE.critical}>{bySeverityByMonth[m].critical}</span> : 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Page ----------------

export function QualityCompliancePage() {
  const [tab, setTab] = useState<'overview' | 'incidents' | 'infections' | 'grievances' | 'licenses'>('overview');
  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'incidents', label: 'Incident Reports' },
    { key: 'infections', label: 'Infection Surveillance' },
    { key: 'grievances', label: 'Patient Grievances' },
    { key: 'licenses', label: 'Regulatory Licenses' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Quality & Compliance</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Incident reporting and the statutory registrations that keep the hospital compliant.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <QualityOverviewTab />}
      {tab === 'incidents' && <IncidentReportsTab />}
      {tab === 'infections' && <InfectionSurveillanceTab />}
      {tab === 'grievances' && <GrievancesTab />}
      {tab === 'licenses' && <RegulatoryLicensesTab />}
    </div>
  );
}
