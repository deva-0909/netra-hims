import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { MODULES } from '../modules/moduleConfig';

export function AdminReportsPage() {
  const { data } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [bills, patients, visits, staff] = await Promise.all([
        supabase.from('bills').select('total_amount, amount_paid, payment_status, created_at'),
        supabase.from('patients').select('id, created_at'),
        supabase.from('visits').select('clinic_module, stage, created_at'),
        supabase.from('profiles').select('role, active'),
      ]);

      const totalRevenue = (bills.data ?? []).reduce((sum, b) => sum + Number(b.amount_paid ?? 0), 0);
      const totalBilled = (bills.data ?? []).reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);
      const outstanding = totalBilled - totalRevenue;

      const revenueLast30 = (bills.data ?? [])
        .filter((b) => new Date(b.created_at) >= thirtyDaysAgo)
        .reduce((sum, b) => sum + Number(b.amount_paid ?? 0), 0);

      const patientsLast30 = (patients.data ?? []).filter((p) => new Date(p.created_at) >= thirtyDaysAgo).length;

      const visitsByModule = (visits.data ?? []).reduce((acc: Record<string, number>, v) => {
        acc[v.clinic_module] = (acc[v.clinic_module] ?? 0) + 1;
        return acc;
      }, {});

      const completedVisits = (visits.data ?? []).filter((v) => v.stage === 'completed').length;

      const staffByRole = (staff.data ?? []).reduce((acc: Record<string, number>, s) => {
        if (s.active) acc[s.role] = (acc[s.role] ?? 0) + 1;
        return acc;
      }, {});

      return {
        totalRevenue, totalBilled, outstanding, revenueLast30, patientsLast30,
        totalPatients: patients.data?.length ?? 0, totalVisits: visits.data?.length ?? 0,
        visitsByModule, completedVisits, staffByRole,
      };
    },
  });

  if (!data) return <p className="text-muted">Loading…</p>;

  const maxModuleCount = Math.max(1, ...Object.values(data.visitsByModule));

  return (
    <div>
      <h2>Reports</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div className="card-kicker">Total collected</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>₹{data.totalRevenue.toFixed(0)}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>₹{data.revenueLast30.toFixed(0)} in last 30 days</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="card-kicker">Outstanding</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>₹{data.outstanding.toFixed(0)}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="card-kicker">Total patients</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>{data.totalPatients}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>+{data.patientsLast30} in last 30 days</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="card-kicker">Total visits</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>{data.totalVisits}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>{data.completedVisits} completed</div>
        </div>
      </div>

      <h4>Visits by clinic</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--space-6)', maxWidth: 500 }}>
        {Object.values(MODULES).map((m) => {
          const count = data.visitsByModule[m.key] ?? 0;
          return (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 100, fontSize: 13 }}>{m.label}</div>
              <div style={{ flex: 1, background: 'var(--color-divider)', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                <div style={{ width: `${(count / maxModuleCount) * 100}%`, background: 'var(--color-accent)', height: '100%' }} />
              </div>
              <div style={{ width: 30, fontSize: 13, textAlign: 'right' }}>{count}</div>
            </div>
          );
        })}
      </div>

      <h4>Active staff by role</h4>
      <table className="table" style={{ maxWidth: 400 }}>
        <thead><tr><th>Role</th><th>Count</th></tr></thead>
        <tbody>
          {Object.entries(data.staffByRole).map(([role, count]) => (
            <tr key={role}><td>{role.replace(/_/g, ' ')}</td><td>{count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
