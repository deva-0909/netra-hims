import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { ROLE_NAV } from '../modules/roleNav';

async function countRows(table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

async function countLowStockDrugs() {
  const { data } = await supabase.from('drugs').select('stock_qty, reorder_level');
  return (data ?? []).filter((d) => d.stock_qty <= d.reorder_level).length;
}

async function countLowStockEyewear() {
  const { data } = await supabase.from('eyewear_items').select('stock_qty, reorder_level');
  return (data ?? []).filter((d) => d.stock_qty <= d.reorder_level).length;
}

async function countMaintenanceDue() {
  const { data } = await supabase.from('maintenance_schedules').select('next_due_date').eq('active', true);
  const today = new Date().toISOString().slice(0, 10);
  return (data ?? []).filter((d) => d.next_due_date <= today).length;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const nav = (profile && ROLE_NAV[profile.role]) ?? { patients: false, appointments: false, waitingBoard: false, journeys: [], support: [] };

  const { data } = useQuery({
    queryKey: ['dashboard-counts', profile?.role],
    enabled: !!profile,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [patients, activeVisits, todayAppointments, totalWaiting, pendingPharmacy, lowStock, pendingOptical, lowStockEyewear, unpaidBills, pendingInsurance, openRecordRequests, openMlcCases, availableTissues, activeCamps, admittedPatients, maintenanceDue] = await Promise.all([
        nav.patients ? countRows('patients') : Promise.resolve(null),
        nav.journeys.length > 0 ? countRows('visits', (q) => q.eq('clinic_module', nav.journeys[0]).not('stage', 'in', '("completed","cancelled")')) : Promise.resolve(null),
        nav.appointments ? countRows('appointments', (q) => q.gte('scheduled_at', today.toISOString())) : Promise.resolve(null),
        nav.waitingBoard ? countRows('visits', (q) => q.not('stage', 'in', '("completed","cancelled")')) : Promise.resolve(null),
        nav.support.includes('pharmacy') ? countRows('pharmacy_dispenses', (q) => q.neq('status', 'dispensed')) : Promise.resolve(null),
        nav.support.includes('pharmacy_inventory') ? countLowStockDrugs() : Promise.resolve(null),
        nav.support.includes('optical') ? countRows('optical_orders', (q) => q.not('status', 'in', '("dispensed","cancelled")')) : Promise.resolve(null),
        nav.support.includes('optical_inventory') ? countLowStockEyewear() : Promise.resolve(null),
        nav.support.includes('billing') ? countRows('bills', (q) => q.neq('payment_status', 'paid')) : Promise.resolve(null),
        nav.support.includes('insurance') ? countRows('insurance_claims', (q) => q.not('status', 'in', '("settled","rejected")')) : Promise.resolve(null),
        nav.support.includes('mrd_requests') ? countRows('record_requests', (q) => q.not('status', 'in', '("issued","rejected")')) : Promise.resolve(null),
        nav.support.includes('mrd_mlc') ? countRows('mlc_cases', (q) => q.neq('status', 'closed')) : Promise.resolve(null),
        nav.support.includes('eye_bank_tissues') ? countRows('eye_bank_tissues', (q) => q.eq('status', 'available')) : Promise.resolve(null),
        nav.support.includes('outreach_camps') ? countRows('outreach_camps', (q) => q.eq('status', 'planned')) : Promise.resolve(null),
        nav.support.includes('ipd_ward') ? countRows('admissions', (q) => q.is('discharged_at', null)) : Promise.resolve(null),
        nav.support.includes('equipment_assets') ? countMaintenanceDue() : Promise.resolve(null),
      ]);
      return { patients, activeVisits, todayAppointments, totalWaiting, pendingPharmacy, lowStock, pendingOptical, lowStockEyewear, unpaidBills, pendingInsurance, openRecordRequests, openMlcCases, availableTissues, activeCamps, admittedPatients, maintenanceDue };
    },
  });

  const cards = [
    nav.patients && { label: 'Registered patients', value: data?.patients, to: '/patients' },
    nav.waitingBoard && { label: 'Patients waiting (all clinics)', value: data?.totalWaiting, to: '/waiting-room' },
    nav.journeys.length > 0 && { label: `Active visits — ${nav.journeys[0]}`, value: data?.activeVisits, to: `/journeys/${nav.journeys[0]}` },
    nav.appointments && { label: 'Appointments from today', value: data?.todayAppointments, to: '/appointments' },
    nav.support.includes('pharmacy') && { label: 'Prescriptions pending dispense', value: data?.pendingPharmacy, to: '/pharmacy' },
    nav.support.includes('pharmacy_inventory') && { label: 'Drugs low on stock', value: data?.lowStock, to: '/pharmacy/inventory' },
    nav.support.includes('optical') && { label: 'Optical orders pending', value: data?.pendingOptical, to: '/optical' },
    nav.support.includes('optical_inventory') && { label: 'Eyewear low on stock', value: data?.lowStockEyewear, to: '/optical/inventory' },
    nav.support.includes('billing') && { label: 'Bills unpaid', value: data?.unpaidBills, to: '/billing' },
    nav.support.includes('insurance') && { label: 'Insurance claims pending', value: data?.pendingInsurance, to: '/insurance' },
    nav.support.includes('mrd_requests') && { label: 'Open record requests', value: data?.openRecordRequests, to: '/mrd/requests' },
    nav.support.includes('mrd_mlc') && { label: 'Open MLC cases', value: data?.openMlcCases, to: '/mrd/mlc' },
    nav.support.includes('eye_bank_tissues') && { label: 'Tissues available', value: data?.availableTissues, to: '/eye-bank/tissues' },
    nav.support.includes('outreach_camps') && { label: 'Camps planned', value: data?.activeCamps, to: '/outreach-camps' },
    nav.support.includes('ipd_ward') && { label: 'Patients currently admitted', value: data?.admittedPatients, to: '/ipd' },
    nav.support.includes('equipment_assets') && { label: 'Maintenance/calibration due or overdue', value: data?.maintenanceDue, to: '/admin/equipment' },
  ].filter(Boolean) as { label: string; value: number | null | undefined; to: string }[];

  const quickActions = [
    nav.patients && { to: '/patients?new=1', label: '+ Register patient', primary: true },
    nav.appointments && { to: '/appointments', label: 'Schedule appointment' },
    nav.waitingBoard && { to: '/waiting-room', label: 'Waiting room' },
    nav.journeys.length > 0 && { to: `/journeys/${nav.journeys[0]}`, label: `${nav.journeys[0]} queue` },
    nav.support.includes('pharmacy') && { to: '/pharmacy', label: 'Pharmacy queue' },
    nav.support.includes('pharmacy_inventory') && { to: '/pharmacy/inventory', label: 'Pharmacy inventory' },
    nav.support.includes('optical') && { to: '/optical', label: 'Optical queue' },
    nav.support.includes('optical_inventory') && { to: '/optical/inventory', label: 'Optical inventory' },
    nav.support.includes('billing') && { to: '/billing', label: 'Billing' },
    nav.support.includes('insurance') && { to: '/insurance', label: 'Insurance desk' },
    nav.support.includes('mrd_requests') && { to: '/mrd/requests', label: 'Record requests' },
    nav.support.includes('mrd_mlc') && { to: '/mrd/mlc', label: 'MLC register' },
    nav.support.includes('mrd_completion') && { to: '/mrd/completion', label: 'Completion dashboard' },
    nav.support.includes('eye_bank_donors') && { to: '/eye-bank/donors', label: 'Eye bank donors' },
    nav.support.includes('eye_bank_tissues') && { to: '/eye-bank/tissues', label: 'Eye bank tissues' },
    nav.support.includes('emergency_triage') && { to: '/emergency-triage', label: 'Emergency triage' },
    nav.support.includes('outreach_camps') && { to: '/outreach-camps', label: 'Outreach camps' },
    nav.support.includes('ipd_ward') && { to: '/ipd', label: 'IPD ward census' },
    nav.support.includes('equipment_assets') && { to: '/admin/equipment', label: 'Equipment register' },
    nav.support.includes('hr_employees') && { to: '/admin/employees', label: 'Employees (HR)' },
    nav.support.includes('workforce') && { to: '/workforce', label: 'Workforce' },
  ].filter(Boolean) as { to: string; label: string; primary?: boolean }[];

  return (
    <div>
      <h2>Welcome, {profile?.full_name?.split(' ')[0] ?? 'there'}</h2>
      <p className="text-muted">
        Here's what's happening at the hospital today
        {profile && <> — viewing as <strong>{profile.role.replace(/_/g, ' ')}</strong></>}.
      </p>

      {cards.length > 0 ? (
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
      ) : (
        <p className="text-muted" style={{ marginTop: 'var(--space-6)' }}>Nothing assigned to this role yet.</p>
      )}

      {quickActions.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h3>Quick actions</h3>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {quickActions.map((a) => (
              <Link key={a.to} className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`} to={a.to}>{a.label}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
