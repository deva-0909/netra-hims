import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

type DateFilter = 'today' | 'upcoming' | 'all';

/** OT was 100% write-after-the-fact — every case only ever appeared once
 * someone had already typed in that surgery happened. Nothing showed "who's
 * booked for OT today," because nothing was ever booked ahead of time in
 * the first place. This is the forward-looking list that scheduling
 * (OtRecoveryPanel's "+ Schedule OT") now makes possible. Actual state
 * transitions (start/complete/checklist/consent/implants) still live on the
 * admission's own OT panel — this page is the cross-admission overview that
 * links into it. */
export function OtSchedulePage() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  const { data: cases, isLoading } = useQuery({
    queryKey: ['ot-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ot_records')
        .select('*, admissions(visit_id, bed_id, beds(bed_number, ward), visits(patient_id, patients(full_name, uhid))), profiles!ot_records_surgeon_id_fkey(full_name)')
        .in('status', ['scheduled', 'in_progress'])
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

  const filtered = (cases ?? []).filter((c: any) => {
    const t = new Date(c.start_time);
    if (dateFilter === 'today') return t >= todayStart && t < todayEnd;
    if (dateFilter === 'upcoming') return t >= now || c.status === 'in_progress';
    return true;
  });

  return (
    <div>
      <h2>OT Schedule</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Every scheduled and in-progress OT case, across every admission — open a case to record consent, the safety checklist, implants, or complete it.
      </p>

      <div className="seg" style={{ maxWidth: 360, marginBottom: 'var(--space-4)' }}>
        {(['today', 'upcoming', 'all'] as DateFilter[]).map((f) => (
          <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={dateFilter === f} onChange={() => setDateFilter(f)} /> {f[0].toUpperCase() + f.slice(1)}
          </label>
        ))}
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Patient</th><th>Procedure</th><th>Room</th><th>Surgeon</th><th>Bed</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${c.admissions?.visit_id}`)}>
                <td>{new Date(c.start_time).toLocaleString()}</td>
                <td>{c.admissions?.visits?.patients?.full_name} <span className="text-muted" style={{ fontSize: 11 }}>({c.admissions?.visits?.patients?.uhid})</span></td>
                <td>{c.procedure_name} ({c.eye})</td>
                <td>{c.ot_room ?? '—'}</td>
                <td>{c.profiles?.full_name ?? '—'}</td>
                <td>{c.admissions?.beds?.bed_number ?? '—'}</td>
                <td><span className={`tag ${c.status === 'in_progress' ? 'tag-accent-2' : 'tag-outline'}`}>{c.status.replace(/_/g, ' ')}</span></td>
                <td><button className="btn btn-ghost">Open</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="text-muted">No OT cases in this range.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
