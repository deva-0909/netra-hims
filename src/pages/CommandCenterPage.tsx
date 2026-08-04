import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (dateStr: string) => Math.round((new Date(dateStr).getTime() - new Date(todayISO()).getTime()) / 86400000);
function dueStyle(days: number): React.CSSProperties {
  if (days < 0) return { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' };
  if (days <= 14) return { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' };
  return { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' };
}

async function countLowStock(table: string) {
  const { data } = await supabase.from(table).select('stock_qty, reorder_level');
  return (data ?? []).filter((d: any) => d.stock_qty <= d.reorder_level).length;
}

async function countRows(table: string, filter: (q: any) => any) {
  const { count } = await filter(supabase.from(table).select('*', { count: 'exact', head: true }));
  return count ?? 0;
}

export function CommandCenterPage() {
  const { data } = useQuery({
    queryKey: ['command-center'],
    queryFn: async () => {
      const [
        maintenanceDue, amcExpiring, licensesExpiring, lowStockDrugs, lowStockEyewear, lowStockStores,
        pendingLeave, pendingRequisitions, openIncidents, housekeepingDue, pendingAppointmentRequests,
        expiringAmc, expiringLicenses,
      ] = await Promise.all([
        countRows('maintenance_schedules', (q) => q.eq('active', true).lte('next_due_date', plusDaysISO(30))),
        countRows('amc_contracts', (q) => q.eq('status', 'active').lte('end_date', plusDaysISO(30))),
        countRows('regulatory_licenses', (q) => q.lte('expiry_date', plusDaysISO(60))),
        countLowStock('drugs'),
        countLowStock('eyewear_items'),
        countLowStock('general_stores_inventory'),
        countRows('leave_requests', (q) => q.eq('status', 'pending')),
        countRows('purchase_requisitions', (q) => q.eq('status', 'pending')),
        countRows('incident_reports', (q) => q.neq('status', 'closed')),
        countRows('housekeeping_schedules', (q) => q.eq('active', true).lte('next_due_date', todayISO())),
        countRows('appointment_requests', (q) => q.eq('status', 'pending')),
        supabase.from('amc_contracts').select('*, equipment_assets(name, asset_tag)').eq('status', 'active').lte('end_date', plusDaysISO(30)).order('end_date').then((r) => r.data ?? []),
        supabase.from('regulatory_licenses').select('*').lte('expiry_date', plusDaysISO(60)).order('expiry_date').then((r) => r.data ?? []),
      ]);
      return {
        maintenanceDue, amcExpiring, licensesExpiring, lowStockDrugs, lowStockEyewear, lowStockStores,
        pendingLeave, pendingRequisitions, openIncidents, housekeepingDue, pendingAppointmentRequests,
        expiringAmc, expiringLicenses,
      };
    },
  });

  const tiles = [
    { label: 'Equipment maintenance/calibration due', value: data?.maintenanceDue, to: '/admin/equipment' },
    { label: 'AMC/CMC contracts expiring (30d)', value: data?.amcExpiring, to: '/admin/equipment' },
    { label: 'Regulatory licenses expiring (60d)', value: data?.licensesExpiring, to: '/admin/quality' },
    { label: 'Open incident reports', value: data?.openIncidents, to: '/admin/quality' },
    { label: 'Drugs low on stock', value: data?.lowStockDrugs, to: '/pharmacy/inventory' },
    { label: 'Eyewear low on stock', value: data?.lowStockEyewear, to: '/optical/inventory' },
    { label: 'General stores low on stock', value: data?.lowStockStores, to: '/admin/procurement' },
    { label: 'Housekeeping overdue', value: data?.housekeepingDue, to: '/cssd-housekeeping' },
    { label: 'Leave requests pending', value: data?.pendingLeave, to: '/workforce' },
    { label: 'Purchase requisitions pending', value: data?.pendingRequisitions, to: '/admin/procurement' },
    { label: 'Appointment requests pending', value: data?.pendingAppointmentRequests, to: '/appointment-requests' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Command Center</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>
        Everything due, overdue or expiring across the hospital, in one place.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} style={{ color: 'inherit' }}>
            <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div className="card-kicker">Overview</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 600 }}>{t.value ?? '—'}</div>
              <div className="card-body">{t.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <h4>AMC/CMC contracts expiring within 30 days</h4>
      <table className="table" style={{ marginBottom: 'var(--space-6)' }}>
        <thead><tr><th>Equipment</th><th>Vendor</th><th>Ends</th></tr></thead>
        <tbody>
          {data?.expiringAmc.map((a: any) => {
            const days = daysUntil(a.end_date);
            return (
              <tr key={a.id}>
                <td>{a.equipment_assets?.name} <span className="text-muted" style={{ fontSize: 11 }}>({a.equipment_assets?.asset_tag})</span></td>
                <td>{a.vendor_name}</td>
                <td><span className="tag tag-outline" style={dueStyle(days)}>{a.end_date} ({days}d)</span></td>
              </tr>
            );
          })}
          {(!data?.expiringAmc || data.expiringAmc.length === 0) && <tr><td colSpan={3} className="text-muted">Nothing expiring soon.</td></tr>}
        </tbody>
      </table>

      <h4>Regulatory licenses expiring within 60 days</h4>
      <table className="table">
        <thead><tr><th>Type</th><th>Number</th><th>Expires</th></tr></thead>
        <tbody>
          {data?.expiringLicenses.map((l: any) => {
            const days = daysUntil(l.expiry_date);
            return (
              <tr key={l.id}>
                <td>{l.license_type.replace(/_/g, ' ')}</td>
                <td>{l.license_number ?? '—'}</td>
                <td><span className="tag tag-outline" style={dueStyle(days)}>{l.expiry_date} ({days}d)</span></td>
              </tr>
            );
          })}
          {(!data?.expiringLicenses || data.expiringLicenses.length === 0) && <tr><td colSpan={3} className="text-muted">Nothing expiring soon.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
