import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';
import type { VisitStage } from '../lib/types';

// General OPD tracks pre-testing through the shared stage enum, so a patient
// isn't "ready for doctor" until imaging is done. Specialty clinics have no
// pre-testing bucket in the enum (waiting -> consultation directly), so
// 'waiting' itself is the "ready for doctor" signal there.
const READY_FOR_DOCTOR: Record<string, VisitStage[]> = {
  general: ['imaging', 'consultation'],
  retina: ['waiting', 'consultation'],
  glaucoma: ['waiting', 'consultation'],
  lasik: ['waiting', 'consultation'],
  cornea: ['waiting', 'consultation'],
  pediatric: ['waiting', 'consultation'],
};

type ViewFilter = 'all' | 'ready';

export function JourneyQueuePage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const config = module ? MODULES[module] : undefined;
  const [view, setView] = useState<ViewFilter>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>(profile?.role === 'doctor' ? profile.id : '');

  const { data: doctors } = useQuery({
    queryKey: ['doctors-for-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'doctor').eq('active', true).order('full_name');
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  const { data: visits, isLoading } = useQuery({
    queryKey: ['journey-queue', module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, patients(full_name, uhid, phone)')
        .eq('clinic_module', module)
        .not('stage', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!config) return <p>Unknown module.</p>;

  const readyStages = READY_FOR_DOCTOR[module ?? ''] ?? ['consultation'];
  const filtered = (visits ?? []).filter((v: any) => {
    if (view === 'ready' && !readyStages.includes(v.stage)) return false;
    if (doctorFilter && v.attending_doctor_id !== doctorFilter) return false;
    return true;
  });

  return (
    <div>
      <h2>{config.label} — Active Queue</h2>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div className="seg" style={{ maxWidth: 320 }}>
          <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={view === 'all'} onChange={() => setView('all')} /> All active
          </label>
          <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={view === 'ready'} onChange={() => setView('ready')} /> Ready for doctor
          </label>
        </div>
        <div className="field" style={{ width: 200, marginBottom: 0 }}>
          <select className="input" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
            <option value="">All doctors</option>
            {doctors?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Token</th><th>Patient</th><th>UHID</th><th>Stage</th><th>Doctor</th><th>Started</th><th /></tr></thead>
          <tbody>
            {filtered.map((v: any) => (
              <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
                <td>{v.token_number ?? '—'}</td>
                <td>{v.patients?.full_name}</td>
                <td>{v.patients?.uhid}</td>
                <td><span className="tag tag-neutral">{v.stage.replace(/_/g, ' ')}</span></td>
                <td className="text-muted">{doctors?.find((d) => d.id === v.attending_doctor_id)?.full_name ?? '—'}</td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
                <td><button className="btn btn-ghost">Open</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No visits match this filter.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
