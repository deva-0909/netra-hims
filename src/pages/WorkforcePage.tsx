import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { printDutyRoster } from '../lib/printDutyRoster';
import { getLeaveBalance, deductLeaveBalance } from '../lib/leaveBalance';
import { FileUploadField } from '../components/FileUploadField';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ---------------- My Profile (self-service + onboarding) ----------------

const SELF_EDITABLE_FIELDS: { key: string; label: string; type?: string }[] = [
  { key: 'personal_phone', label: 'Personal phone' },
  { key: 'personal_email', label: 'Personal email' },
  { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { key: 'gender', label: 'Gender' },
  { key: 'address', label: 'Address' },
  { key: 'emergency_contact_name', label: 'Emergency contact name' },
  { key: 'emergency_contact_phone', label: 'Emergency contact phone' },
  { key: 'pan_number', label: 'PAN number' },
  { key: 'aadhaar_number', label: 'Aadhaar number' },
  { key: 'bank_account_number', label: 'Bank account number' },
  { key: 'bank_ifsc', label: 'Bank IFSC' },
];

const DOCUMENT_TYPES = ['id_proof', 'address_proof', 'educational_certificate', 'offer_letter', 'other'];

function DocumentUploadForm({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [docType, setDocType] = useState('id_proof');
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docExpiry, setDocExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!docName.trim() || !docUrl) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('employee_documents').insert({
      employee_id: employeeId, document_type: docType, document_name: docName, document_url: docUrl,
      expiry_date: docExpiry || null, uploaded_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setDocName('');
    setDocUrl(null);
    qc.invalidateQueries({ queryKey: ['my-employee-documents', employeeId] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', padding: 8, background: 'var(--color-accent-100)', marginTop: 6, borderRadius: 'var(--radius-md)' }}>
      <div className="field" style={{ flex: '0 1 160px' }}>
        <label>Document type</label>
        <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Name</label><input className="input" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Aadhaar card" /></div>
      <div className="field" style={{ flex: '0 1 150px' }}><label>Expiry (if applicable)</label><input className="input" type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 200px' }}><label>File</label><FileUploadField value={docUrl} onChange={setDocUrl} folder="employee_documents" /></div>
      <button className="btn btn-primary" onClick={submit} disabled={saving || !docUrl}>{saving ? 'Saving…' : 'Save'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function MyProfileTab({ myEmployee }: { myEmployee: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(SELF_EDITABLE_FIELDS.map((f) => [f.key, myEmployee?.[f.key] ?? '']))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: documents } = useQuery({
    queryKey: ['my-employee-documents', myEmployee?.id],
    enabled: !!myEmployee?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_documents').select('*').eq('employee_id', myEmployee.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, string | null> = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    const { error: updateError } = await supabase.from('employees').update(payload).eq('id', myEmployee.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['my-employee'] });
  };

  const completeOnboarding = async () => {
    await supabase.from('employees').update({ onboarding_completed: true }).eq('id', myEmployee.id);
    qc.invalidateQueries({ queryKey: ['my-employee'] });
  };

  if (!myEmployee) {
    return <p className="text-muted">No employee record is linked to your login yet — ask HR to set one up, then this tab will show your details.</p>;
  }

  return (
    <div>
      {!myEmployee.onboarding_completed && (
        <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h4 style={{ marginTop: 0 }}>Welcome, {myEmployee.employee_code} — complete your onboarding</h4>
          <p className="text-muted" style={{ fontSize: 13 }}>Fill in your details below, upload at least one ID document, then mark onboarding complete.</p>
        </div>
      )}

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <h4 style={{ marginTop: 0 }}>My details</h4>
        <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>{myEmployee.designation} · joined {myEmployee.date_of_joining ?? '—'} · employment status and salary are managed by HR.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {SELF_EDITABLE_FIELDS.map((f) => (
            <div className="field" key={f.key} style={{ flex: '1 1 220px' }}>
              <label>{f.label}</label>
              <input className="input" type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save my details'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>My documents</h4>
          {!showUpload && <button className="btn btn-secondary" onClick={() => setShowUpload(true)}>+ Upload document</button>}
        </div>
        {showUpload && <DocumentUploadForm employeeId={myEmployee.id} onDone={() => setShowUpload(false)} />}
        {documents?.length ? (
          <ul style={{ paddingLeft: 18, fontSize: 13, marginTop: 8 }}>
            {documents.map((d: any) => (
              <li key={d.id}>{d.document_name} <span className="text-muted">({d.document_type.replace(/_/g, ' ')}{d.expiry_date ? `, expires ${d.expiry_date}` : ''})</span> — <a href={d.document_url} target="_blank" rel="noreferrer">view</a></li>
            ))}
          </ul>
        ) : <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>No documents uploaded yet.</p>}
      </div>

      {!myEmployee.onboarding_completed && (
        <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={completeOnboarding} disabled={!documents?.length}>
          {documents?.length ? 'Mark onboarding complete' : 'Upload at least one document to complete onboarding'}
        </button>
      )}
    </div>
  );
}

// ---------------- Holidays & Leave Policy ----------------

function AddHolidayForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ holiday_date: '', name: '', holiday_type: 'public' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.holiday_date || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('holidays').insert({ ...form, created_by: profile?.id });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm({ holiday_date: '', name: '', holiday_type: 'public' });
    qc.invalidateQueries({ queryKey: ['holidays'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', padding: 8, background: 'var(--color-accent-100)', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
      <div className="field"><label>Date</label><input className="input" type="date" value={form.holiday_date} onChange={(e) => set('holiday_date', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 200px' }}><label>Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Diwali" /></div>
      <div className="field">
        <label>Type</label>
        <select className="input" value={form.holiday_type} onChange={(e) => set('holiday_type', e.target.value)}>
          <option value="public">Public (hospital closed)</option>
          <option value="restricted">Restricted (optional)</option>
          <option value="optional">Optional</option>
        </select>
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add holiday'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function HolidaysTab({ isHr }: { isHr: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: holidays } = useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*').order('holiday_date');
      if (error) throw error;
      return data;
    },
  });

  const remove = async (id: string) => {
    await supabase.from('holidays').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['holidays'] });
  };

  const today = todayISO();
  const upcoming = holidays?.filter((h: any) => h.holiday_date >= today) ?? [];
  const past = holidays?.filter((h: any) => h.holiday_date < today) ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>The hospital's holiday calendar.</p>
        {isHr && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add holiday</button>}
      </div>
      {showForm && <AddHolidayForm onDone={() => setShowForm(false)} />}
      <table className="table">
        <thead><tr><th>Date</th><th>Holiday</th><th>Type</th>{isHr && <th />}</tr></thead>
        <tbody>
          {upcoming.map((h: any) => (
            <tr key={h.id}>
              <td>{new Date(h.holiday_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td>{h.name}</td>
              <td><span className="tag tag-outline">{h.holiday_type}</span></td>
              {isHr && <td><button className="btn btn-ghost" onClick={() => remove(h.id)}>Remove</button></td>}
            </tr>
          ))}
          {upcoming.length === 0 && <tr><td colSpan={isHr ? 4 : 3} className="text-muted">No upcoming holidays scheduled.</td></tr>}
        </tbody>
      </table>
      {past.length > 0 && (
        <>
          <h4 style={{ marginTop: 'var(--space-6)' }}>Past</h4>
          <table className="table">
            <tbody>
              {past.map((h: any) => (
                <tr key={h.id}><td style={{ width: 160 }}>{new Date(h.holiday_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>{h.name}</td><td className="text-muted">{h.holiday_type}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function LeavePolicyRow({ lt, isHr }: { lt: any; isHr: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(String(lt.default_annual_days));
  const [notes, setNotes] = useState(lt.policy_notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase.from('leave_types').update({ default_annual_days: Number(days) || 0, policy_notes: notes || null }).eq('id', lt.id);
    setSaving(false);
    setEditing(false);
    qc.invalidateQueries({ queryKey: ['leave-types-policy'] });
  };

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong>{lt.name}</strong>{' '}
          <span className="tag tag-outline" style={{ marginLeft: 6 }}>{editing ? days : lt.default_annual_days} days/year</span>
          {!lt.is_paid && <span className="tag tag-outline" style={{ marginLeft: 6 }}>unpaid</span>}
        </div>
        {isHr && !editing && <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>}
      </div>
      {editing ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12 }}>Days/year</label>
            <input className="input" style={{ width: 90 }} type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Policy notes — carry-forward, notice period, eligibility, etc." />
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>{lt.policy_notes || 'No policy notes recorded.'}</p>
      )}
    </div>
  );
}

function LeavePolicyTab({ isHr }: { isHr: boolean }) {
  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types-policy'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>Entitlement and rules for each leave type.</p>
      {leaveTypes?.map((lt: any) => <LeavePolicyRow key={lt.id} lt={lt} isHr={isHr} />)}
    </div>
  );
}

// ---------------- Attendance ----------------

const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off'];

function ManualAttendanceForm({ employees, onDone }: { employees: any[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ employee_id: '', log_date: todayISO(), status: 'present', check_in: '', check_out: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.log_date) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('attendance_logs').upsert({
      employee_id: form.employee_id, log_date: form.log_date, status: form.status, source: 'manual',
      check_in: form.check_in ? new Date(`${form.log_date}T${form.check_in}`).toISOString() : null,
      check_out: form.check_out ? new Date(`${form.log_date}T${form.check_out}`).toISOString() : null,
      remarks: form.remarks || null,
    }, { onConflict: 'employee_id,log_date' });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ employee_id: '', log_date: todayISO(), status: 'present', check_in: '', check_out: '', remarks: '' });
    qc.invalidateQueries({ queryKey: ['all-attendance-today'] });
    qc.invalidateQueries({ queryKey: ['my-attendance-history'] });
    qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <h5 style={{ marginTop: 0 }}>Manual entry / correction</h5>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -4 }}>Record or correct attendance for any employee and date — e.g. biometric was down, or someone forgot to clock in.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Employee</label>
          <select className="input" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
            <option value="">Select…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 150px' }}><label>Date</label><input className="input" type="date" value={form.log_date} onChange={(e) => set('log_date', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 150px' }}>
          <label>Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 130px' }}><label>Check in</label><input className="input" type="time" value={form.check_in} onChange={(e) => set('check_in', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 130px' }}><label>Check out</label><input className="input" type="time" value={form.check_out} onChange={(e) => set('check_out', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Remarks</label><input className="input" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Reason for manual entry" /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save entry'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function AttendanceTab({ myEmployeeId, isHr }: { myEmployeeId: string | null; isHr: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [search, setSearch] = useState('');

  const { data: todayLog } = useQuery({
    queryKey: ['my-attendance-today', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_logs').select('*').eq('employee_id', myEmployeeId).eq('log_date', todayISO()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ['my-attendance-history', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_logs').select('*').eq('employee_id', myEmployeeId).order('log_date', { ascending: false }).limit(14);
      if (error) throw error;
      return data;
    },
  });

  const { data: allToday } = useQuery({
    queryKey: ['all-attendance-today'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_logs').select('*, employees(employee_code, profiles(full_name))').eq('log_date', todayISO()).order('check_in', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: employeesForAttendance } = useQuery({
    queryKey: ['employees-for-attendance'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, employee_code, profiles(full_name)').eq('employment_status', 'active').order('employee_code');
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filteredToday = (allToday ?? []).filter((h: any) => !term || h.employees?.profiles?.full_name?.toLowerCase().includes(term) || h.employees?.employee_code?.toLowerCase().includes(term));

  const clockIn = async () => {
    if (!myEmployeeId) return;
    setError(null);
    const { error: err } = await supabase.from('attendance_logs').insert({ employee_id: myEmployeeId, log_date: todayISO(), check_in: new Date().toISOString(), status: 'present' });
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ['my-attendance-today', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['my-attendance-history', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['all-attendance-today'] });
  };

  const clockOut = async () => {
    if (!todayLog) return;
    setError(null);
    const { error: err } = await supabase.from('attendance_logs').update({ check_out: new Date().toISOString() }).eq('id', todayLog.id);
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ['my-attendance-today', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['my-attendance-history', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['all-attendance-today'] });
  };

  if (!myEmployeeId) {
    return <p className="text-muted">HR hasn't set up an employee record for {profile?.full_name} yet — clock-in becomes available once one exists.</p>;
  }

  return (
    <div>
      <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', maxWidth: 420 }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <h4 style={{ marginTop: 0 }}>Today — {todayISO()}</h4>
        {todayLog ? (
          <div style={{ fontSize: 14 }}>
            <div>Checked in: {todayLog.check_in ? new Date(todayLog.check_in).toLocaleTimeString() : '—'}</div>
            <div>Checked out: {todayLog.check_out ? new Date(todayLog.check_out).toLocaleTimeString() : '—'}</div>
          </div>
        ) : <p className="text-muted">Not checked in yet.</p>}
        {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {!todayLog && <button className="btn btn-primary" onClick={clockIn}>Clock in</button>}
          {todayLog && !todayLog.check_out && <button className="btn btn-primary" onClick={clockOut}>Clock out</button>}
          {todayLog?.check_out && <span className="tag tag-accent">Day complete</span>}
        </div>
      </div>

      <h4>My last 14 days</h4>
      <table className="table">
        <thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead>
        <tbody>
          {history?.map((h: any) => (
            <tr key={h.id}>
              <td>{h.log_date}</td>
              <td>{h.check_in ? new Date(h.check_in).toLocaleTimeString() : '—'}</td>
              <td>{h.check_out ? new Date(h.check_out).toLocaleTimeString() : '—'}</td>
              <td><span className="tag tag-neutral">{h.status.replace(/_/g, ' ')}</span></td>
            </tr>
          ))}
          {history?.length === 0 && <tr><td colSpan={4} className="text-muted">No attendance recorded yet.</td></tr>}
        </tbody>
      </table>

      {isHr && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', flexWrap: 'wrap', gap: 8 }}>
            <h4 style={{ margin: 0 }}>All staff — today</h4>
            {!showManualForm && <button className="btn btn-secondary" onClick={() => setShowManualForm(true)}>+ Manual entry / correction</button>}
          </div>
          {showManualForm && <ManualAttendanceForm employees={employeesForAttendance ?? []} onDone={() => setShowManualForm(false)} />}
          <div className="field" style={{ maxWidth: 260, marginBottom: 12 }}>
            <label>Search</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or employee code" />
          </div>
          <table className="table">
            <thead><tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead>
            <tbody>
              {filteredToday.map((h: any) => (
                <tr key={h.id}>
                  <td>{h.employees?.profiles?.full_name} <span className="text-muted" style={{ fontSize: 11 }}>({h.employees?.employee_code})</span></td>
                  <td>{h.check_in ? new Date(h.check_in).toLocaleTimeString() : '—'}</td>
                  <td>{h.check_out ? new Date(h.check_out).toLocaleTimeString() : '—'}</td>
                  <td><span className="tag tag-neutral">{h.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
              {filteredToday.length === 0 && <tr><td colSpan={4} className="text-muted">No records match.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------- Leave ----------------

function LeaveApprovalRow({ req }: { req: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const year = new Date(req.start_date).getFullYear();

  const { data: balance } = useQuery({
    queryKey: ['leave-balance-for-approval', req.employee_id, req.leave_type_id, year],
    queryFn: () => getLeaveBalance(req.employee_id, req.leave_type_id, year),
  });
  const remaining = balance ? Number(balance.allocated_days) - Number(balance.used_days) : Number(req.leave_types?.default_annual_days ?? 0);

  const decide = async (status: 'approved' | 'rejected') => {
    setError(null);
    if (status === 'approved') {
      const { error: deductError } = await deductLeaveBalance(req.employee_id, req.leave_type_id, Number(req.leave_types?.default_annual_days ?? 0), Number(req.total_days), year);
      if (deductError) { setError(`Balance couldn't be updated: ${deductError}`); return; }
    }
    await supabase.from('leave_requests').update({
      status, approved_by: profile?.id, approved_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? (reason || 'Not specified') : null,
    }).eq('id', req.id);
    qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
  };

  return (
    <tr>
      <td>{req.employees?.profiles?.full_name}</td>
      <td>
        {req.leave_types?.name}
        <div className="text-muted" style={{ fontSize: 11, color: remaining < req.total_days ? '#b64545' : undefined }}>{remaining}d remaining</div>
      </td>
      <td>{req.start_date} → {req.end_date} ({req.total_days}d)</td>
      <td className="text-muted">{req.reason ?? '—'}</td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => decide('approved')}>Approve</button>
          <input className="input" style={{ width: 120 }} placeholder="Reject reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => decide('rejected')}>Reject</button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 11 }}>{error}</div>}
      </td>
    </tr>
  );
}

function LeaveTab({ myEmployeeId, isHr }: { myEmployeeId: string | null; isHr: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: myRequests } = useQuery({
    queryKey: ['my-leave-requests', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_requests').select('*, leave_types(name)').eq('employee_id', myEmployeeId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pending } = useQuery({
    queryKey: ['pending-leave-requests'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_requests').select('*, employees(employee_code, profiles(full_name)), leave_types(name, default_annual_days)').eq('status', 'pending').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const requestYear = form.start_date ? new Date(form.start_date).getFullYear() : new Date().getFullYear();
  const selectedType = leaveTypes?.find((t: any) => t.id === form.leave_type_id);
  const { data: myBalance } = useQuery({
    queryKey: ['my-leave-balance', myEmployeeId, form.leave_type_id, requestYear],
    enabled: !!myEmployeeId && !!form.leave_type_id,
    queryFn: () => getLeaveBalance(myEmployeeId!, form.leave_type_id, requestYear),
  });
  const remainingBalance = selectedType
    ? (myBalance ? Number(myBalance.allocated_days) - Number(myBalance.used_days) : Number(selectedType.default_annual_days))
    : null;
  const requestedDays = form.start_date && form.end_date
    ? Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1
    : 0;

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myEmployeeId || !form.leave_type_id || !form.start_date || !form.end_date) return;
    const days = Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1;
    if (days <= 0) { setError('End date must be on or after the start date.'); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('leave_requests').insert({
      employee_id: myEmployeeId, leave_type_id: form.leave_type_id, start_date: form.start_date, end_date: form.end_date,
      total_days: days, reason: form.reason || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
    qc.invalidateQueries({ queryKey: ['my-leave-requests', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
  };

  return (
    <div>
      {myEmployeeId ? (
        <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', maxWidth: 560 }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h4 style={{ marginTop: 0 }}>Request leave</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label>Leave type</label>
              <select className="input" value={form.leave_type_id} onChange={(e) => set('leave_type_id', e.target.value)} required>
                <option value="">Select…</option>
                {leaveTypes?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}><label>Start date</label><input className="input" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required /></div>
            <div className="field" style={{ flex: '1 1 140px' }}><label>End date</label><input className="input" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required /></div>
            <div className="field" style={{ flex: '1 1 100%' }}><label>Reason</label><textarea className="input" value={form.reason} onChange={(e) => set('reason', e.target.value)} /></div>
          </div>
          {remainingBalance !== null && (
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4, color: requestedDays > remainingBalance ? '#b64545' : undefined }}>
              {remainingBalance}d remaining for {selectedType?.name} this year
              {requestedDays > remainingBalance && ` — this request (${requestedDays}d) exceeds it`}
            </div>
          )}
          {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit request'}</button>
          </div>
        </form>
      ) : <p className="text-muted">HR hasn't set up an employee record for {profile?.full_name} yet — leave requests become available once one exists.</p>}

      {myEmployeeId && (
        <>
          <h4>My leave requests</h4>
          <table className="table">
            <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th /></tr></thead>
            <tbody>
              {myRequests?.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.leave_types?.name}</td>
                  <td>{r.start_date} → {r.end_date}</td>
                  <td>{r.total_days}</td>
                  <td>
                    <span className="tag tag-outline" style={r.status === 'approved' ? { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' } : r.status === 'rejected' ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>
                      {r.status}
                    </span>
                    {r.status === 'rejected' && r.rejection_reason && <div className="text-muted" style={{ fontSize: 11 }}>{r.rejection_reason}</div>}
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <button
                        className="btn btn-ghost"
                        onClick={async () => {
                          await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', r.id);
                          qc.invalidateQueries({ queryKey: ['my-leave-requests', myEmployeeId] });
                          qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
                        }}
                      >
                        Withdraw
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {myRequests?.length === 0 && <tr><td colSpan={5} className="text-muted">No leave requested yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {isHr && (
        <>
          <h4 style={{ marginTop: 'var(--space-6)' }}>Pending approvals</h4>
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Reason</th><th>Decision</th></tr></thead>
            <tbody>
              {pending?.map((r: any) => <LeaveApprovalRow key={r.id} req={r} />)}
              {pending?.length === 0 && <tr><td colSpan={5} className="text-muted">Nothing pending.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------- Leave Balances (HR) ----------------

function LeaveBalanceRow({ employee, leaveType, year }: { employee: any; leaveType: any; year: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [allocated, setAllocated] = useState('');
  const [used, setUsed] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: balance } = useQuery({
    queryKey: ['leave-balance-row', employee.id, leaveType.id, year],
    queryFn: () => getLeaveBalance(employee.id, leaveType.id, year),
  });
  const { data: prevBalance } = useQuery({
    queryKey: ['leave-balance-row', employee.id, leaveType.id, year - 1],
    queryFn: () => getLeaveBalance(employee.id, leaveType.id, year - 1),
  });

  const allocatedDays = balance ? Number(balance.allocated_days) : Number(leaveType.default_annual_days);
  const usedDays = balance ? Number(balance.used_days) : 0;
  const prevRemaining = prevBalance ? Math.max(0, Number(prevBalance.allocated_days) - Number(prevBalance.used_days)) : null;

  const startEdit = () => {
    setAllocated(String(allocatedDays));
    setUsed(String(usedDays));
    setEditing(true);
  };

  const carryForward = () => {
    if (prevRemaining == null) return;
    setAllocated(String(allocatedDays + prevRemaining));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('leave_balances').upsert({
      employee_id: employee.id, leave_type_id: leaveType.id, year,
      allocated_days: Number(allocated) || 0, used_days: Number(used) || 0,
    }, { onConflict: 'employee_id,leave_type_id,year' });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setEditing(false);
    qc.invalidateQueries({ queryKey: ['leave-balance-row', employee.id, leaveType.id, year] });
  };

  return (
    <tr>
      <td>{leaveType.name}</td>
      {editing ? (
        <>
          <td><input className="input" style={{ width: 80 }} type="number" value={allocated} onChange={(e) => setAllocated(e.target.value)} /></td>
          <td><input className="input" style={{ width: 80 }} type="number" value={used} onChange={(e) => setUsed(e.target.value)} /></td>
          <td>{(Number(allocated) || 0) - (Number(used) || 0)}</td>
          <td style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            {prevRemaining != null && prevRemaining > 0 && <button className="btn btn-ghost" onClick={carryForward}>+{prevRemaining}d from {year - 1}</button>}
            {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
          </td>
        </>
      ) : (
        <>
          <td>{allocatedDays}</td>
          <td>{usedDays}</td>
          <td>{allocatedDays - usedDays}</td>
          <td><button className="btn btn-ghost" onClick={startEdit}>Adjust</button></td>
        </>
      )}
    </tr>
  );
}

function LeaveBalancesTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [employeeId, setEmployeeId] = useState('');

  const { data: employees } = useQuery({
    queryKey: ['employees-for-leave-balances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, employee_code, profiles(full_name)').eq('employment_status', 'active').order('employee_code');
      if (error) throw error;
      return data;
    },
  });
  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const employee = (employees ?? []).find((e: any) => e.id === employeeId);

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>View and adjust each employee's leave entitlement — allocated days default to the leave type's policy until adjusted here.</p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '1 1 240px', marginBottom: 0 }}>
          <label>Employee</label>
          <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select…</option>
            {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '0 1 120px', marginBottom: 0 }}>
          <label>Year</label>
          <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
        </div>
      </div>
      {employee ? (
        <table className="table">
          <thead><tr><th>Leave type</th><th>Allocated</th><th>Used</th><th>Remaining</th><th /></tr></thead>
          <tbody>
            {leaveTypes?.map((lt: any) => <LeaveBalanceRow key={lt.id} employee={employee} leaveType={lt} year={year} />)}
            {leaveTypes?.length === 0 && <tr><td colSpan={5} className="text-muted">No leave types configured.</td></tr>}
          </tbody>
        </table>
      ) : <p className="text-muted">Select an employee to view or adjust their leave balances.</p>}
    </div>
  );
}

// ---------------- Roster ----------------

interface CoveringFor { employeeName: string; date: string; department: string | null; absentEmployeeId: string; originalRosterId: string }

function AssignRosterForm({ employees, shiftTemplates, coveringFor, onDone }: {
  employees: any[]; shiftTemplates: any[]; coveringFor?: CoveringFor; onDone?: () => void;
}) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employee_id: '', shift_template_id: '', roster_date: coveringFor?.date ?? todayISO(), department: coveringFor?.department ?? '', notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.roster_date) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('duty_rosters').insert({
      employee_id: form.employee_id, shift_template_id: form.shift_template_id || null, roster_date: form.roster_date,
      department: form.department || null, notes: form.notes || null, created_by: profile?.id,
      covering_for_employee_id: coveringFor?.absentEmployeeId ?? null,
    });
    if (err) { setSaving(false); setError(err.message); return; }
    // Coverage assigned — the original gap no longer needs to appear as a gap.
    if (coveringFor?.originalRosterId) {
      await supabase.from('duty_rosters').update({ status: 'cancelled' }).eq('id', coveringFor.originalRosterId);
    }
    setSaving(false);
    setForm({ employee_id: '', shift_template_id: '', roster_date: todayISO(), department: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['roster-upcoming-all'] });
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>{coveringFor ? `Assign coverage for ${coveringFor.employeeName}` : 'Assign a shift'}</h4>
      {coveringFor && <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>{coveringFor.date}{coveringFor.department ? ` · ${coveringFor.department}` : ''} — pick who covers this shift.</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>{coveringFor ? 'Covering employee' : 'Employee'}</label>
          <select className="input" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
            <option value="">Select…</option>
            {employees.filter((e) => e.id !== coveringFor?.absentEmployeeId).map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Date</label><input className="input" type="date" value={form.roster_date} onChange={(e) => set('roster_date', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Shift</label>
          <select className="input" value={form.shift_template_id} onChange={(e) => set('shift_template_id', e.target.value)}>
            <option value="">—</option>
            {shiftTemplates.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : coveringFor ? 'Assign coverage' : 'Assign shift'}</button>
        {coveringFor && <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>}
      </div>
    </form>
  );
}

// ---------------- Coverage for absence ----------------

interface CoverageGap { roster: any; reason: string }

function CoverageGapsPanel({ gaps, employees, shiftTemplates }: { gaps: CoverageGap[]; employees: any[]; shiftTemplates: any[] }) {
  const qc = useQueryClient();
  const [activeGapId, setActiveGapId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const markAbsent = async (rosterId: string) => {
    setMarkingId(rosterId);
    await supabase.from('duty_rosters').update({ status: 'absent' }).eq('id', rosterId);
    qc.invalidateQueries({ queryKey: ['roster-upcoming-all'] });
    setMarkingId(null);
  };

  if (gaps.length === 0) return null;

  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>
        Coverage needed
        <span className="tag tag-outline" style={{ marginLeft: 8, background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' }}>{gaps.length}</span>
      </h4>
      {gaps.map(({ roster: r, reason }) => (
        <div key={r.id} style={{ marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px dashed var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{r.employees?.profiles?.full_name}</strong> — {r.roster_date} {r.department ? `(${r.department})` : ''}
              <div className="text-muted" style={{ fontSize: 12 }}>{reason}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {r.status !== 'absent' && (
                <button className="btn btn-ghost" onClick={() => markAbsent(r.id)} disabled={markingId === r.id}>Mark absent</button>
              )}
              <button className="btn btn-secondary" onClick={() => setActiveGapId(activeGapId === r.id ? null : r.id)}>
                {activeGapId === r.id ? 'Cancel' : 'Assign coverage'}
              </button>
            </div>
          </div>
          {activeGapId === r.id && (
            <AssignRosterForm
              key={r.id}
              employees={employees}
              shiftTemplates={shiftTemplates}
              coveringFor={{ employeeName: r.employees?.profiles?.full_name ?? 'this employee', date: r.roster_date, department: r.department, absentEmployeeId: r.employee_id, originalRosterId: r.id }}
              onDone={() => setActiveGapId(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------- Duty swap ----------------

function RequestSwapForm({ myEmployeeId, myRoster, onDone }: { myEmployeeId: string; myRoster: any[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [rosterId, setRosterId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rosterId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('shift_swap_requests').insert({ roster_id: rosterId, requester_employee_id: myEmployeeId, reason: reason || null });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setRosterId('');
    setReason('');
    qc.invalidateQueries({ queryKey: ['my-swap-requests', myEmployeeId] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', border: '1px dashed var(--color-divider)', marginBottom: 'var(--space-4)' }}>
      <div className="field" style={{ flex: '1 1 240px' }}>
        <label>Which shift?</label>
        <select className="input" value={rosterId} onChange={(e) => setRosterId(e.target.value)} required>
          <option value="">Select…</option>
          {myRoster.map((r: any) => <option key={r.id} value={r.id}>{r.roster_date} {r.shift_templates ? `— ${r.shift_templates.name}` : ''}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 240px' }}>
        <label>Reason</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family event; swap with Priya if possible" />
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Request swap'}</button>
    </form>
  );
}

function MySwapRequests({ myEmployeeId }: { myEmployeeId: string }) {
  const qc = useQueryClient();
  const { data: requests } = useQuery({
    queryKey: ['my-swap-requests', myEmployeeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_swap_requests').select('*, duty_rosters(roster_date, department, shift_templates(name))').eq('requester_employee_id', myEmployeeId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = async (id: string) => {
    await supabase.from('shift_swap_requests').update({ status: 'cancelled' }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-swap-requests', myEmployeeId] });
  };

  return (
    <table className="table" style={{ marginBottom: 'var(--space-5)' }}>
      <thead><tr><th>Shift</th><th>Reason</th><th>Status</th><th /></tr></thead>
      <tbody>
        {requests?.map((r: any) => (
          <tr key={r.id}>
            <td>{r.duty_rosters?.roster_date} {r.duty_rosters?.shift_templates ? `— ${r.duty_rosters.shift_templates.name}` : ''}</td>
            <td className="text-muted">{r.reason ?? '—'}</td>
            <td><span className="tag tag-neutral">{r.status}</span></td>
            <td>{r.status === 'pending' && <button className="btn btn-ghost" onClick={() => cancel(r.id)}>Withdraw</button>}</td>
          </tr>
        ))}
        {requests?.length === 0 && <tr><td colSpan={4} className="text-muted">No swap requests yet.</td></tr>}
      </tbody>
    </table>
  );
}

function PendingSwapApprovals({ employees }: { employees: any[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [assignee, setAssignee] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: pending } = useQuery({
    queryKey: ['pending-swap-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_swap_requests').select('*, duty_rosters(id, roster_date, department, employee_id, shift_templates(name))').eq('status', 'pending').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const employeeName = (id: string) => employees.find((e: any) => e.id === id)?.profiles?.full_name ?? 'Unknown';

  const approve = async (req: any) => {
    const newEmployeeId = assignee[req.id] || req.target_employee_id;
    if (!newEmployeeId) { setError('Pick who covers this shift before approving.'); return; }
    setBusyId(req.id);
    setError(null);
    const { error: rosterErr } = await supabase.from('duty_rosters').update({ employee_id: newEmployeeId }).eq('id', req.roster_id);
    if (rosterErr) { setBusyId(null); setError(rosterErr.message); return; }
    const { error: reqErr } = await supabase.from('shift_swap_requests').update({ status: 'approved', target_employee_id: newEmployeeId, approved_by: profile?.id, approved_at: new Date().toISOString() }).eq('id', req.id);
    setBusyId(null);
    if (reqErr) { setError(reqErr.message); return; }
    qc.invalidateQueries({ queryKey: ['pending-swap-requests'] });
    qc.invalidateQueries({ queryKey: ['roster-upcoming-all'] });
  };

  const reject = async (id: string) => {
    setBusyId(id);
    await supabase.from('shift_swap_requests').update({ status: 'rejected', approved_by: profile?.id, approved_at: new Date().toISOString() }).eq('id', id);
    setBusyId(null);
    qc.invalidateQueries({ queryKey: ['pending-swap-requests'] });
  };

  if (!pending || pending.length === 0) return null;

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <h4 style={{ marginTop: 0 }}>Pending swap requests</h4>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginBottom: 8 }}>{error}</div>}
      <table className="table">
        <thead><tr><th>Requested by</th><th>Shift</th><th>Reason</th><th>Cover with</th><th /></tr></thead>
        <tbody>
          {pending.map((r: any) => (
            <tr key={r.id}>
              <td>{employeeName(r.duty_rosters?.employee_id)}</td>
              <td>{r.duty_rosters?.roster_date} {r.duty_rosters?.shift_templates ? `— ${r.duty_rosters.shift_templates.name}` : ''} {r.duty_rosters?.department ? `(${r.duty_rosters.department})` : ''}</td>
              <td className="text-muted">{r.reason ?? '—'}</td>
              <td>
                <select className="input" style={{ width: 180 }} value={assignee[r.id] ?? r.target_employee_id ?? ''} onChange={(e) => setAssignee((prev) => ({ ...prev, [r.id]: e.target.value }))}>
                  <option value="">Select…</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
                </select>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" onClick={() => approve(r)} disabled={busyId === r.id}>Approve</button>
                  <button className="btn btn-ghost" onClick={() => reject(r.id)} disabled={busyId === r.id}>Reject</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddOnCallForm({ employees }: { employees: any[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employee_id: '', department: '', start_time: '', end_time: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.start_time || !form.end_time) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('on_call_schedules').insert({
      employee_id: form.employee_id, department: form.department || null,
      on_call_date: form.start_time.slice(0, 10), start_time: form.start_time, end_time: form.end_time,
      notes: form.notes || null, created_by: profile?.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ employee_id: '', department: '', start_time: '', end_time: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['on-call-upcoming'] });
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', border: '1px dashed var(--color-divider)', marginBottom: 'var(--space-4)' }}>
      <div className="field" style={{ flex: '1 1 200px' }}>
        <label>Employee</label>
        <select className="input" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
          <option value="">Select…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 140px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Emergency / OT" /></div>
      <div className="field" style={{ flex: '1 1 180px' }}><label>From</label><input className="input" type="datetime-local" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 180px' }}><label>To</label><input className="input" type="datetime-local" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required /></div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add on-call'}</button>
    </form>
  );
}

// ---------------- Shift templates ----------------

function AddShiftTemplateForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', start_time: '', end_time: '', department: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_time || !form.end_time) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('shift_templates').insert({
      name: form.name, start_time: form.start_time, end_time: form.end_time, department: form.department || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ name: '', start_time: '', end_time: '', department: '' });
    qc.invalidateQueries({ queryKey: ['shift-templates-all'] });
    qc.invalidateQueries({ queryKey: ['shift-templates'] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', background: 'var(--color-accent-100)', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Morning / Night" required /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Start</label><input className="input" type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>End</label><input className="input" type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add shift'}</button>
      <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
    </form>
  );
}

function EditShiftTemplateForm({ template, onDone }: { template: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: template.name, start_time: template.start_time?.slice(0, 5) ?? '', end_time: template.end_time?.slice(0, 5) ?? '', department: template.department ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('shift_templates').update({
      name: form.name, start_time: form.start_time, end_time: form.end_time, department: form.department || null,
    }).eq('id', template.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ['shift-templates-all'] });
    qc.invalidateQueries({ queryKey: ['shift-templates'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 8, background: 'var(--color-accent-100)' }}>
      <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 110px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Start</label><input className="input" type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 110px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>End</label><input className="input" type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function ShiftTemplateManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: templates } = useQuery({
    queryKey: ['shift-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_templates').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = async (t: any) => {
    await supabase.from('shift_templates').update({ active: !t.active }).eq('id', t.id);
    qc.invalidateQueries({ queryKey: ['shift-templates-all'] });
    qc.invalidateQueries({ queryKey: ['shift-templates'] });
  };

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Shift templates</h4>
        {!showForm && <button className="btn btn-secondary" onClick={() => setShowForm(true)}>+ Add shift template</button>}
      </div>
      {showForm && <AddShiftTemplateForm onDone={() => setShowForm(false)} />}
      <table className="table" style={{ marginTop: 8 }}>
        <thead><tr><th>Name</th><th>Time</th><th>Department</th><th>Status</th><th /></tr></thead>
        <tbody>
          {templates?.map((t: any) => (
            editingId === t.id ? (
              <tr key={t.id}><td colSpan={5}><EditShiftTemplateForm template={t} onDone={() => setEditingId(null)} /></td></tr>
            ) : (
              <tr key={t.id} style={t.active ? undefined : { opacity: 0.6 }}>
                <td>{t.name}</td>
                <td>{t.start_time?.slice(0, 5)}–{t.end_time?.slice(0, 5)}</td>
                <td>{t.department ?? '—'}</td>
                <td><span className={`tag ${t.active ? 'tag-accent' : 'tag-outline'}`}>{t.active ? 'active' : 'inactive'}</span></td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost" onClick={() => setEditingId(t.id)}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => toggleActive(t)}>{t.active ? 'Deactivate' : 'Reactivate'}</button>
                </td>
              </tr>
            )
          ))}
          {templates?.length === 0 && <tr><td colSpan={5} className="text-muted">No shift templates yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RosterTab({ myEmployeeId, isHr }: { myEmployeeId: string | null; isHr: boolean }) {
  const { data: shiftTemplates } = useQuery({
    queryKey: ['shift-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_templates').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: myRoster } = useQuery({
    queryKey: ['my-roster', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('duty_rosters').select('*, shift_templates(name, start_time, end_time)').eq('employee_id', myEmployeeId).gte('roster_date', todayISO()).lte('roster_date', addDaysISO(14)).order('roster_date');
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoster } = useQuery({
    queryKey: ['roster-upcoming-all'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('duty_rosters').select('*, employees(employee_code, profiles(full_name)), shift_templates(name, start_time, end_time)').gte('roster_date', todayISO()).lte('roster_date', addDaysISO(14)).order('roster_date');
      if (error) throw error;
      return data;
    },
  });

  const { data: onCall } = useQuery({
    queryKey: ['on-call-upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase.from('on_call_schedules').select('*, employees(employee_code, profiles(full_name))').gte('on_call_date', todayISO()).order('on_call_date').limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: employeesForForms } = useQuery({
    queryKey: ['employees-for-roster'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, employee_code, profiles(full_name)').eq('employment_status', 'active').order('employee_code');
      if (error) throw error;
      return data;
    },
  });

  // Approved leave overlapping the roster window — cross-referenced against
  // allRoster below to surface shifts nobody can actually work.
  const { data: approvedLeave } = useQuery({
    queryKey: ['approved-leave-upcoming'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_requests').select('employee_id, start_date, end_date').eq('status', 'approved').lte('start_date', addDaysISO(14)).gte('end_date', todayISO());
      if (error) throw error;
      return data;
    },
  });

  const coverageGaps: CoverageGap[] = (allRoster ?? [])
    .filter((r: any) => r.status !== 'cancelled' && r.status !== 'completed')
    .map((r: any) => {
      if (r.status === 'absent') return { roster: r, reason: 'Marked absent' };
      const leave = (approvedLeave ?? []).find((l: any) => l.employee_id === r.employee_id && r.roster_date >= l.start_date && r.roster_date <= l.end_date);
      if (leave) return { roster: r, reason: `On approved leave ${leave.start_date} → ${leave.end_date}` };
      return null;
    })
    .filter((g): g is CoverageGap => g !== null);

  const [showSwapForm, setShowSwapForm] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const rosterTerm = rosterSearch.trim().toLowerCase();
  const filteredAllRoster = (allRoster ?? []).filter((r: any) => !rosterTerm || r.employees?.profiles?.full_name?.toLowerCase().includes(rosterTerm) || r.employees?.employee_code?.toLowerCase().includes(rosterTerm) || r.department?.toLowerCase().includes(rosterTerm));

  return (
    <div>
      {isHr && <ShiftTemplateManager />}
      {isHr && <CoverageGapsPanel gaps={coverageGaps} employees={employeesForForms ?? []} shiftTemplates={shiftTemplates ?? []} />}
      {isHr && <PendingSwapApprovals employees={employeesForForms ?? []} />}
      {isHr && <AssignRosterForm employees={employeesForForms ?? []} shiftTemplates={shiftTemplates ?? []} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>My upcoming shifts (next 14 days)</h4>
        {myEmployeeId && !showSwapForm && <button className="btn btn-ghost" onClick={() => setShowSwapForm(true)}>Request a swap</button>}
      </div>
      {showSwapForm && myEmployeeId && <RequestSwapForm myEmployeeId={myEmployeeId} myRoster={myRoster ?? []} onDone={() => setShowSwapForm(false)} />}
      <table className="table" style={{ marginBottom: 'var(--space-5)' }}>
        <thead><tr><th>Date</th><th>Shift</th><th>Department</th><th>Status</th></tr></thead>
        <tbody>
          {myRoster?.map((r: any) => (
            <tr key={r.id}>
              <td>{r.roster_date}</td>
              <td>{r.shift_templates ? `${r.shift_templates.name} (${r.shift_templates.start_time}–${r.shift_templates.end_time})` : '—'}</td>
              <td>{r.department ?? '—'}</td>
              <td><span className="tag tag-neutral">{r.status}</span></td>
            </tr>
          ))}
          {(!myEmployeeId || myRoster?.length === 0) && <tr><td colSpan={4} className="text-muted">No upcoming shifts scheduled.</td></tr>}
        </tbody>
      </table>

      {myEmployeeId && (
        <>
          <h4>My swap requests</h4>
          <MySwapRequests myEmployeeId={myEmployeeId} />
        </>
      )}

      <h4>On-call schedule</h4>
      {isHr && <AddOnCallForm employees={employeesForForms ?? []} />}
      <table className="table" style={{ marginBottom: 'var(--space-5)' }}>
        <thead><tr><th>Employee</th><th>Department</th><th>From</th><th>To</th></tr></thead>
        <tbody>
          {onCall?.map((o: any) => (
            <tr key={o.id}>
              <td>{o.employees?.profiles?.full_name} <span className="text-muted" style={{ fontSize: 11 }}>({o.employees?.employee_code})</span></td>
              <td>{o.department ?? '—'}</td>
              <td>{new Date(o.start_time).toLocaleString()}</td>
              <td>{new Date(o.end_time).toLocaleString()}</td>
            </tr>
          ))}
          {onCall?.length === 0 && <tr><td colSpan={4} className="text-muted">No on-call coverage scheduled.</td></tr>}
        </tbody>
      </table>

      {isHr && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>Full roster — next 14 days</h4>
            <button className="btn btn-ghost" onClick={() => printDutyRoster(allRoster ?? [])}>Print roster</button>
          </div>
          <div className="field" style={{ maxWidth: 260, marginBottom: 12 }}>
            <label>Search</label>
            <input className="input" value={rosterSearch} onChange={(e) => setRosterSearch(e.target.value)} placeholder="Name, code or department" />
          </div>
          <table className="table">
            <thead><tr><th>Date</th><th>Employee</th><th>Shift</th><th>Department</th><th>Status</th></tr></thead>
            <tbody>
              {filteredAllRoster.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.roster_date}</td>
                  <td>
                    {r.employees?.profiles?.full_name}
                    {r.covering_for_employee_id && <div className="text-muted" style={{ fontSize: 11 }}>covering an absence</div>}
                  </td>
                  <td>{r.shift_templates ? r.shift_templates.name : '—'}</td>
                  <td>{r.department ?? '—'}</td>
                  <td>
                    <span className="tag tag-outline" style={r.status === 'absent' ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : r.status === 'cancelled' ? { background: '#e8e8e8', color: '#555' } : undefined}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAllRoster.length === 0 && <tr><td colSpan={5} className="text-muted">No shifts match.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export function WorkforcePage() {
  const { profile } = useAuth();
  const isHr = profile?.role === 'hr_manager' || profile?.role === 'admin';
  const [tab, setTab] = useState<'profile' | 'attendance' | 'leave' | 'balances' | 'roster' | 'holidays' | 'policy'>('profile');

  const { data: myEmployee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('profile_id', profile!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'profile', label: 'My Profile' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'leave', label: 'Leave' },
    ...(isHr ? [{ key: 'balances' as typeof tab, label: 'Leave Balances' }] : []),
    { key: 'roster', label: 'Duty Roster & On-call' },
    { key: 'holidays', label: 'Holidays' },
    { key: 'policy', label: 'Leave Policy' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Workforce</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Your own profile, attendance, leave and the duty roster — plus HR approvals if you manage them.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}
            style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <MyProfileTab myEmployee={myEmployee ?? null} />}
      {tab === 'attendance' && <AttendanceTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
      {tab === 'leave' && <LeaveTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
      {tab === 'balances' && isHr && <LeaveBalancesTab />}
      {tab === 'roster' && <RosterTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
      {tab === 'holidays' && <HolidaysTab isHr={isHr} />}
      {tab === 'policy' && <LeavePolicyTab isHr={isHr} />}
    </div>
  );
}
