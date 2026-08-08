import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

type StatusFilter = 'due' | 'all' | 'pending' | 'scheduled' | 'completed' | 'missed';
type AssignedFilter = 'mine' | 'all';

const STATUS_OPTIONS = ['pending', 'scheduled', 'completed', 'missed'];

export function FollowUpsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('due');
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>(profile?.role === 'doctor' ? 'mine' : 'all');
  const [error, setError] = useState<string | null>(null);

  const { data: followUps, isLoading } = useQuery({
    queryKey: ['follow-ups-due'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*, patients(full_name, uhid, phone), visits(clinic_module), profiles!follow_ups_created_by_fkey(full_name)')
        .order('due_date', { ascending: true })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const filtered = (followUps ?? []).filter((f: any) => {
    if (assignedFilter === 'mine' && f.created_by !== profile?.id) return false;
    if (filter === 'due') return (f.status === 'pending' || f.status === 'scheduled') && f.due_date <= todayStr;
    if (filter === 'all') return true;
    return f.status === filter;
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('follow_ups').update({ status }).eq('id', id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['follow-ups-due'] });
  };

  return (
    <div>
      <h2>Follow-ups Due</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Every follow-up recorded from a visit's Follow-up tab, across all clinics — nothing here was visible anywhere before.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div className="seg" style={{ maxWidth: 560 }}>
          {(['due', 'all', 'pending', 'scheduled', 'completed', 'missed'] as StatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={filter === f} onChange={() => setFilter(f)} /> {f[0].toUpperCase() + f.slice(1)}
            </label>
          ))}
        </div>
        <div className="seg" style={{ maxWidth: 220 }}>
          {(['mine', 'all'] as AssignedFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={assignedFilter === f} onChange={() => setAssignedFilter(f)} /> {f === 'mine' ? 'Mine' : 'Everyone'}
            </label>
          ))}
        </div>
      </div>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Due date</th><th>Patient</th><th>UHID</th><th>Phone</th><th>Clinic</th><th>Reason</th><th>Scheduled by</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((f: any) => {
              const overdue = (f.status === 'pending' || f.status === 'scheduled') && f.due_date < todayStr;
              return (
                <tr key={f.id}>
                  <td style={overdue ? { color: '#b64545', fontWeight: 600 } : undefined}>{f.due_date}{overdue ? ' (overdue)' : ''}</td>
                  <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${f.patient_id}`)}>{f.patients?.full_name}</td>
                  <td>{f.patients?.uhid}</td>
                  <td>{f.patients?.phone ?? '—'}</td>
                  <td className="text-muted">{f.visits?.clinic_module ?? '—'}</td>
                  <td>{f.reason ?? '—'}</td>
                  <td className="text-muted">{f.profiles?.full_name ?? '—'}</td>
                  <td>
                    <select className="input" style={{ minWidth: 120 }} value={f.status} onChange={(e) => updateStatus(f.id, e.target.value)}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="btn btn-ghost" onClick={() => navigate(`/patients/${f.patient_id}`)}>Open patient</button></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={9} className="text-muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
