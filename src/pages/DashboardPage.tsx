import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

async function countRows(table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export function DashboardPage() {
  const { profile } = useAuth();

  const { data } = useQuery({
    queryKey: ['dashboard-counts'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [patients, activeVisits, todayAppointments, pendingInsurance] = await Promise.all([
        countRows('patients'),
        countRows('visits', (q) => q.not('stage', 'in', '("completed","cancelled")')),
        countRows('appointments', (q) => q.gte('scheduled_at', today.toISOString())),
        countRows('insurance_claims', (q) => q.not('status', 'in', '("settled","rejected")')),
      ]);
      return { patients, activeVisits, todayAppointments, pendingInsurance };
    },
  });

  const cards = [
    { label: 'Registered patients', value: data?.patients, to: '/patients' },
    { label: 'Active visits in progress', value: data?.activeVisits, to: '/journeys/general' },
    { label: 'Appointments from today', value: data?.todayAppointments, to: '/appointments' },
    { label: 'Insurance claims pending', value: data?.pendingInsurance, to: '/insurance' },
  ];

  return (
    <div>
      <h2>Welcome, {profile?.full_name?.split(' ')[0] ?? 'there'}</h2>
      <p className="text-muted">Here's what's happening at the hospital today.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
        {cards.map((c) => (
          <Link key={c.label} to={c.to} style={{ color: 'inherit' }}>
            <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div className="card-kicker">Overview</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 600 }}>
                {c.value ?? '—'}
              </div>
              <div className="card-body">{c.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-8)' }}>
        <h3>Quick actions</h3>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/patients?new=1">+ Register patient</Link>
          <Link className="btn btn-secondary" to="/appointments">Schedule appointment</Link>
          <Link className="btn btn-secondary" to="/journeys/general">General OPD queue</Link>
        </div>
      </div>
    </div>
  );
}
