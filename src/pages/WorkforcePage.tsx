import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { printDutyRoster } from '../lib/printDutyRoster';
import { getLeaveBalance, deductLeaveBalance } from '../lib/leaveBalance';

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

  return (
    <div>
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
          <table className="table">
            <thead><tr><th>Date</th><th>Employee</th><th>Shift</th><th>Department</th><th>Status</th></tr></thead>
            <tbody>
              {allRoster?.map((r: any) => (
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
              {allRoster?.length === 0 && <tr><td colSpan={5} className="text-muted">Nothing scheduled yet.</td></tr>}
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
