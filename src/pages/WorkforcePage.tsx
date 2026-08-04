import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ---------------- Attendance ----------------

function AttendanceTab({ myEmployeeId, isHr }: { myEmployeeId: string | null; isHr: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

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
          <h4 style={{ marginTop: 'var(--space-6)' }}>All staff — today</h4>
          <table className="table">
            <thead><tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead>
            <tbody>
              {allToday?.map((h: any) => (
                <tr key={h.id}>
                  <td>{h.employees?.profiles?.full_name} <span className="text-muted" style={{ fontSize: 11 }}>({h.employees?.employee_code})</span></td>
                  <td>{h.check_in ? new Date(h.check_in).toLocaleTimeString() : '—'}</td>
                  <td>{h.check_out ? new Date(h.check_out).toLocaleTimeString() : '—'}</td>
                  <td><span className="tag tag-neutral">{h.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
              {allToday?.length === 0 && <tr><td colSpan={4} className="text-muted">No one has clocked in today yet.</td></tr>}
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

  const decide = async (status: 'approved' | 'rejected') => {
    await supabase.from('leave_requests').update({
      status, approved_by: profile?.id, approved_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? (reason || 'Not specified') : null,
    }).eq('id', req.id);
    qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
  };

  return (
    <tr>
      <td>{req.employees?.profiles?.full_name}</td>
      <td>{req.leave_types?.name}</td>
      <td>{req.start_date} → {req.end_date} ({req.total_days}d)</td>
      <td className="text-muted">{req.reason ?? '—'}</td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => decide('approved')}>Approve</button>
          <input className="input" style={{ width: 120 }} placeholder="Reject reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => decide('rejected')}>Reject</button>
        </div>
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
      const { data, error } = await supabase.from('leave_requests').select('*, employees(employee_code, profiles(full_name)), leave_types(name)').eq('status', 'pending').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

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

// ---------------- Roster ----------------

function AssignRosterForm({ employees, shiftTemplates }: { employees: any[]; shiftTemplates: any[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employee_id: '', shift_template_id: '', roster_date: todayISO(), department: '', notes: '' });
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
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ employee_id: '', shift_template_id: '', roster_date: todayISO(), department: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['roster-upcoming-all'] });
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Assign a shift</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Employee</label>
          <select className="input" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
            <option value="">Select…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
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
      <div style={{ marginTop: 10 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Assign shift'}</button>
      </div>
    </form>
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

  return (
    <div>
      {isHr && <AssignRosterForm employees={employeesForForms ?? []} shiftTemplates={shiftTemplates ?? []} />}

      <h4>My upcoming shifts (next 14 days)</h4>
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
          <h4>Full roster — next 14 days</h4>
          <table className="table">
            <thead><tr><th>Date</th><th>Employee</th><th>Shift</th><th>Department</th></tr></thead>
            <tbody>
              {allRoster?.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.roster_date}</td>
                  <td>{r.employees?.profiles?.full_name}</td>
                  <td>{r.shift_templates ? r.shift_templates.name : '—'}</td>
                  <td>{r.department ?? '—'}</td>
                </tr>
              ))}
              {allRoster?.length === 0 && <tr><td colSpan={4} className="text-muted">Nothing scheduled yet.</td></tr>}
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
  const [tab, setTab] = useState<'attendance' | 'leave' | 'roster'>('attendance');

  const { data: myEmployee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id').eq('profile_id', profile!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'attendance', label: 'Attendance' },
    { key: 'leave', label: 'Leave' },
    { key: 'roster', label: 'Duty Roster & On-call' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Workforce</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Attendance, leave and the duty roster — your own record, plus HR approvals if you manage them.</p>

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

      {tab === 'attendance' && <AttendanceTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
      {tab === 'leave' && <LeaveTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
      {tab === 'roster' && <RosterTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
    </div>
  );
}
