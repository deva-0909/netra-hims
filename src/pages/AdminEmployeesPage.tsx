import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { FileUploadField } from '../components/FileUploadField';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'visiting_consultant', 'intern'];
const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'resigned', 'terminated'];
const DOCUMENT_TYPES = ['id_proof', 'address_proof', 'educational_certificate', 'professional_license', 'contract', 'offer_letter', 'other'];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active: {},
  on_leave: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  suspended: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  resigned: { background: '#e8e8e8', color: '#555' },
  terminated: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
};

function NewEmployeeForm({ availableProfiles, employees, onDone }: { availableProfiles: any[]; employees: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    profile_id: '', employee_code: '', designation: '', employment_type: 'full_time', date_of_joining: '',
    date_of_birth: '', gender: '', personal_phone: '', personal_email: '', address: '',
    emergency_contact_name: '', emergency_contact_phone: '', pan_number: '', aadhaar_number: '',
    bank_account_number: '', bank_ifsc: '', monthly_salary: '', reporting_manager_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.profile_id || !form.employee_code.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('employees').insert({
      profile_id: form.profile_id,
      employee_code: form.employee_code,
      designation: form.designation || null,
      employment_type: form.employment_type,
      date_of_joining: form.date_of_joining || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      personal_phone: form.personal_phone || null,
      personal_email: form.personal_email || null,
      address: form.address || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      pan_number: form.pan_number || null,
      aadhaar_number: form.aadhaar_number || null,
      bank_account_number: form.bank_account_number || null,
      bank_ifsc: form.bank_ifsc || null,
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null,
      reporting_manager_id: form.reporting_manager_id || null,
      notes: form.notes || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['employees'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add employee record</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>
        Attach HR details to a staff member who already has a login. Staff create their own login from the login screen first ("Register staff") â€” this form doesn't create one.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Staff account *</label>
          <select className="input" value={form.profile_id} onChange={(e) => set('profile_id', e.target.value)} required>
            <option value="">Selectâ€¦</option>
            {availableProfiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role.replace(/_/g, ' ')})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Employee code *</label><input className="input" value={form.employee_code} onChange={(e) => set('employee_code', e.target.value)} placeholder="NH-EMP-0001" required /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Designation</label><input className="input" value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="Senior Optometrist" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Employment type</label>
          <select className="input" value={form.employment_type} onChange={(e) => set('employment_type', e.target.value)}>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Date of joining</label><input className="input" type="date" value={form.date_of_joining} onChange={(e) => set('date_of_joining', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Date of birth</label><input className="input" type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Gender</label>
          <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">â€”</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Personal phone</label><input className="input" value={form.personal_phone} onChange={(e) => set('personal_phone', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Personal email</label><input className="input" type="email" value={form.personal_email} onChange={(e) => set('personal_email', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Emergency contact name</label><input className="input" value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Emergency contact phone</label><input className="input" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>PAN</label><input className="input" value={form.pan_number} onChange={(e) => set('pan_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Aadhaar</label><input className="input" value={form.aadhaar_number} onChange={(e) => set('aadhaar_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Bank account number</label><input className="input" value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Bank IFSC</label><input className="input" value={form.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Monthly salary (â‚¹)</label><input className="input" type="number" value={form.monthly_salary} onChange={(e) => set('monthly_salary', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Reporting manager</label>
          <select className="input" value={form.reporting_manager_id} onChange={(e) => set('reporting_manager_id', e.target.value)}>
            <option value="">â€”</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Savingâ€¦' : 'Add employee record'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function EmployeeRow({ emp }: { emp: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [docType, setDocType] = useState('other');
  const [docName, setDocName] = useState('');

  const { data: docs } = useQuery({
    queryKey: ['employee-documents', emp.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_documents').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (employment_status: string) => {
    await supabase.from('employees').update({ employment_status }).eq('id', emp.id);
    qc.invalidateQueries({ queryKey: ['employees'] });
  };

  const uploadDoc = async (url: string | null) => {
    if (!url) return;
    await supabase.from('employee_documents').insert({
      employee_id: emp.id, document_type: docType, document_name: docName || 'Document', document_url: url, uploaded_by: profile?.id,
    });
    setDocName('');
    qc.invalidateQueries({ queryKey: ['employee-documents', emp.id] });
  };

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? 'â–¾' : 'â–¸'} {emp.employee_code}</button></td>
        <td>{emp.profiles?.full_name}<div className="text-muted" style={{ fontSize: 11 }}>{emp.profiles?.role?.replace(/_/g, ' ')}</div></td>
        <td>{emp.designation ?? 'â€”'}</td>
        <td>{emp.employment_type?.replace(/_/g, ' ') ?? 'â€”'}</td>
        <td>{emp.date_of_joining ?? 'â€”'}</td>
        <td>
          <select className="input" value={emp.employment_status} onChange={(e) => updateStatus(e.target.value)} style={{ width: 130, ...STATUS_STYLE[emp.employment_status] }}>
            {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <div style={{ fontSize: 12 }} className="text-muted">
                {emp.personal_phone ?? 'â€”'} Â· {emp.personal_email ?? 'â€”'} Â· DOB {emp.date_of_birth ?? 'â€”'} Â· Salary {emp.monthly_salary ? `â‚¹${Number(emp.monthly_salary).toLocaleString()}/mo` : 'â€”'}
              </div>
              <div style={{ fontSize: 12 }} className="text-muted">Emergency contact: {emp.emergency_contact_name ?? 'â€”'} {emp.emergency_contact_phone ?? ''}</div>

              <h5 style={{ marginTop: 12, marginBottom: 4 }}>Documents</h5>
              {docs?.length ? (
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {docs.map((d: any) => <li key={d.id}><a href={d.document_url} target="_blank" rel="noreferrer">{d.document_name}</a> â€” {d.document_type.replace(/_/g, ' ')}{d.expiry_date ? ` (expires ${d.expiry_date})` : ''}</li>)}
                </ul>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No documents uploaded.</p>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="field" style={{ width: 180 }}>
                  <label>Document type</label>
                  <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 200 }}>
                  <label>Name</label>
                  <input className="input" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. BLS certificate" />
                </div>
                <div className="field">
                  <label>Upload</label>
                  <FileUploadField value={null} onChange={uploadDoc} folder="employees" />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AdminEmployeesPage() {
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*, profiles(full_name, role)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['all-profiles-for-hr'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const employeeProfileIds = new Set((employees ?? []).map((e: any) => e.profile_id));
  const availableProfiles = (allProfiles ?? []).filter((p: any) => !employeeProfileIds.has(p.id));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Employees (HR)</h2>
        {!showAddForm && <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add employee record</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Employment details, statutory IDs and salary â€” visible only to HR, admin, and each employee's own login.
      </p>

      {showAddForm && <NewEmployeeForm availableProfiles={availableProfiles} employees={employees ?? []} onDone={() => setShowAddForm(false)} />}

      {isLoading ? <p className="text-muted">Loadingâ€¦</p> : (
        <table className="table">
          <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Type</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>
            {employees?.map((emp: any) => <EmployeeRow key={emp.id} emp={emp} />)}
            {employees?.length === 0 && <tr><td colSpan={6} className="text-muted">No employee records yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
