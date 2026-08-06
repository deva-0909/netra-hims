import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { FileUploadField } from '../components/FileUploadField';
import { printIncidentReport } from '../lib/printIncidentReport';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';

const INCIDENT_TYPES = ['adverse_event', 'near_miss', 'needle_stick', 'fall', 'medication_error', 'equipment_failure', 'other'];
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

// ---------------- Incident Reports ----------------

function ReportIncidentForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ incident_type: 'near_miss', severity: 'minor', department: '', description: '', immediate_action_taken: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('incident_reports').insert({
      incident_type: form.incident_type, severity: form.severity, department: form.department || null,
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

  const decide = async (status: string) => {
    await supabase.from('incident_reports').update({
      status, review_notes: reviewNotes || null, reviewed_by: profile?.id,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', incident.id);
    qc.invalidateQueries({ queryKey: ['incident-reports'] });
  };

  return (
    <tr>
      <td>{new Date(incident.incident_date).toLocaleDateString()}</td>
      <td>{incident.incident_type.replace(/_/g, ' ')}</td>
      <td><span className="tag tag-outline" style={SEVERITY_STYLE[incident.severity]}>{incident.severity}</span></td>
      <td className="text-muted" style={{ maxWidth: 260 }}>{incident.description}</td>
      <td><span className="tag tag-outline" style={STATUS_STYLE[incident.status]}>{incident.status.replace(/_/g, ' ')}</span></td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {incident.status !== 'closed' && (
            <>
              <input className="input" style={{ width: 140 }} placeholder="Review notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              {incident.status === 'open' && <button className="btn btn-ghost" onClick={() => decide('under_review')}>Review</button>}
              <button className="btn btn-ghost" onClick={() => decide('closed')}>Close</button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => printIncidentReport(incident)}>Print</button>
        </div>
      </td>
    </tr>
  );
}

function IncidentReportsTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incident-reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('incident_reports').select('*').order('incident_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Adverse events, near-misses and safety incidents — visible only to quality_manager and admin.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Report incident</button>}
      </div>
      {showForm && <ReportIncidentForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Description</th><th>Status</th><th /></tr></thead>
          <tbody>
            {incidents?.map((i: any) => <IncidentRow key={i.id} incident={i} />)}
            {incidents?.length === 0 && <tr><td colSpan={6} className="text-muted">No incidents reported.</td></tr>}
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
  const { data: licenses, isLoading } = useQuery({
    queryKey: ['regulatory-licenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regulatory_licenses').select('*').order('expiry_date');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>AERB laser licences, biomedical waste authorization, fire NOC, NABH accreditation and other statutory registrations.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add license</button>}
      </div>
      {showForm && <AddLicenseForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Type</th><th>Number</th><th>Authority</th><th>Expiry</th><th>Status</th><th>Document</th></tr></thead>
          <tbody>
            {licenses?.map((l: any) => {
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
                  <td><span className="tag tag-outline" style={STATUS_STYLE[l.status]}>{l.status.replace(/_/g, ' ')}</span></td>
                  <td>{l.document_url ? <a href={l.document_url} target="_blank" rel="noreferrer">view</a> : '—'}</td>
                </tr>
              );
            })}
            {licenses?.length === 0 && <tr><td colSpan={6} className="text-muted">No licenses on file.</td></tr>}
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
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
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

  const decide = async (status: string) => {
    await supabase.from('patient_grievances').update({
      status, resolution_notes: resolutionNotes || null, resolved_by: profile?.id,
      resolved_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', grievance.id);
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
            <button className="btn btn-ghost" onClick={() => decide('closed')}>Close</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function GrievancesTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: grievances, isLoading } = useQuery({
    queryKey: ['patient-grievances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('patient_grievances').select('*, patients(full_name, uhid)').order('received_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Patient-facing complaints — billing, waiting time, staff conduct, clinical care — tracked separately from internal safety incidents. Visible only to quality_manager and admin.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log grievance</button>}
      </div>
      {showForm && <ReportGrievanceForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Complainant</th><th>Type</th><th>Description</th><th>Status</th><th /></tr></thead>
          <tbody>
            {grievances?.map((g: any) => <GrievanceRow key={g.id} grievance={g} />)}
            {grievances?.length === 0 && <tr><td colSpan={6} className="text-muted">No grievances logged.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export function QualityCompliancePage() {
  const [tab, setTab] = useState<'incidents' | 'grievances' | 'licenses'>('incidents');
  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'incidents', label: 'Incident Reports' },
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

      {tab === 'incidents' && <IncidentReportsTab />}
      {tab === 'grievances' && <GrievancesTab />}
      {tab === 'licenses' && <RegulatoryLicensesTab />}
    </div>
  );
}
