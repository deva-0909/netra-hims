import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { MODULES } from '../modules/moduleConfig';

export function WaitingBoardPage() {
  const navigate = useNavigate();
  const [moduleFilter, setModuleFilter] = useState('all');

  const { data: visits, isLoading } = useQuery({
    queryKey: ['waiting-board'],
    refetchInterval: 30_000, // reception wants this to stay current without manual refresh
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, patients(full_name, uhid, phone)')
        .not('stage', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const visible = (visits ?? [])
    .filter((v: any) => moduleFilter === 'all' || v.clinic_module === moduleFilter)
    .sort((a: any, b: any) => {
      // Emergency-flagged visits always float to the top, most critical first.
      if (a.is_emergency !== b.is_emergency) return a.is_emergency ? -1 : 1;
      const priorityRank: Record<string, number> = { critical: 0, urgent: 1, semi_urgent: 2 };
      if (a.is_emergency && b.is_emergency) {
        const rankDiff = (priorityRank[a.triage_priority] ?? 3) - (priorityRank[b.triage_priority] ?? 3);
        if (rankDiff !== 0) return rankDiff;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const countsByModule = (visits ?? []).reduce((acc: Record<string, number>, v: any) => {
    acc[v.clinic_module] = (acc[v.clinic_module] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Waiting Room — All Clinics</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: 12 }}>Auto-refreshes every 30s</span>
          <Link className="btn btn-secondary" to="/emergency-triage">Emergency triage</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <button className={`btn ${moduleFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setModuleFilter('all')}>
          All ({visits?.length ?? 0})
        </button>
        {Object.values(MODULES).map((m) => (
          <button key={m.key} className={`btn ${moduleFilter === m.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setModuleFilter(m.key)}>
            {m.label} ({countsByModule[m.key] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Token</th><th>Patient</th><th>Phone</th><th>Clinic</th><th>Stage</th><th>Waiting since</th><th /></tr></thead>
          <tbody>
            {visible.map((v: any) => {
              const waitedMinutes = Math.round((Date.now() - new Date(v.created_at).getTime()) / 60000);
              return (
                <tr key={v.id} style={{ cursor: 'pointer', background: v.is_emergency ? '#fdf2f2' : undefined }} onClick={() => navigate(`/visits/${v.id}`)}>
                  <td>
                    <span className="tag tag-accent">{v.token_number ?? '—'}</span>
                    {v.is_emergency && (
                      <span className="tag" style={{ marginLeft: 6, background: '#b64545', color: '#fff' }}>
                        {v.triage_priority === 'critical' ? 'CRITICAL' : v.triage_priority === 'urgent' ? 'URGENT' : 'SEMI-URGENT'}
                      </span>
                    )}
                  </td>
                  <td>{v.patients?.full_name} <span className="text-muted">({v.patients?.uhid})</span></td>
                  <td>{v.patients?.phone ?? '—'}</td>
                  <td>{MODULES[v.clinic_module]?.label ?? v.clinic_module}</td>
                  <td><span className="tag tag-neutral">{v.stage.replace(/_/g, ' ')}</span></td>
                  <td className={waitedMinutes > 45 ? 'text-muted' : undefined} style={waitedMinutes > 45 ? { color: '#b64545' } : undefined}>
                    {waitedMinutes} min
                  </td>
                  <td><button className="btn btn-ghost">Open</button></td>
                </tr>
              );
            })}
            {visible.length === 0 && <tr><td colSpan={7} className="text-muted">Nobody waiting right now.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
