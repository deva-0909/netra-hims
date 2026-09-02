import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { MODULES } from '../modules/moduleConfig';

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** OT utilization, bed occupancy, surgery-conversion and referral-
 * conversion — none of these existed anywhere before. Bed occupancy is a
 * live snapshot (a bed's status isn't dated), everything else is scoped
 * to the chosen date range. Surgery/referral conversion are approximations
 * — "converted" means any ot_record / any visit exists at all for that
 * patient, not necessarily linked to the specific advice/registration —
 * same honest caveat as the Clinical Recalls screen. */
function MisKpiSection() {
  const [startDate, setStartDate] = useState(daysAgoISO(30));
  const [endDate, setEndDate] = useState(daysAgoISO(0));

  const { data, isLoading } = useQuery({
    queryKey: ['mis-kpis', startDate, endDate],
    queryFn: async () => {
      const rangeStart = `${startDate}T00:00:00`;
      const rangeEnd = `${endDate}T23:59:59`;

      const [otRes, bedsRes, admissionsRes, consultsRes, otAllRes, patientsRes, visitsRes] = await Promise.all([
        supabase.from('ot_records').select('status, start_time, end_time, ot_room').gte('start_time', rangeStart).lte('start_time', rangeEnd),
        supabase.from('beds').select('status'),
        supabase.from('admissions').select('admitted_at, discharged_at').not('discharged_at', 'is', null).gte('discharged_at', rangeStart).lte('discharged_at', rangeEnd),
        supabase.from('consultations').select('visit_id, created_at, visits(patient_id)').eq('needs_surgery', true).gte('created_at', rangeStart).lte('created_at', rangeEnd),
        supabase.from('ot_records').select('admissions(visits(patient_id))'),
        supabase.from('patients').select('id, referral_source, referring_doctor_id, created_at, referring_doctors(full_name)').gte('created_at', rangeStart).lte('created_at', rangeEnd),
        supabase.from('visits').select('patient_id'),
      ]);

      const otRecords = otRes.data ?? [];
      const completed = otRecords.filter((r: any) => r.status === 'completed');
      const cancelled = otRecords.filter((r: any) => r.status === 'cancelled');
      const totalHours = completed.reduce((sum: number, r: any) => {
        if (!r.start_time || !r.end_time) return sum;
        return sum + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000;
      }, 0);
      const byRoom = otRecords.reduce((acc: Record<string, number>, r: any) => {
        const room = r.ot_room || 'Unassigned';
        acc[room] = (acc[room] ?? 0) + 1;
        return acc;
      }, {});

      const beds = bedsRes.data ?? [];
      const occupiedBeds = beds.filter((b: any) => b.status === 'occupied').length;

      const admissions = admissionsRes.data ?? [];
      const avgLengthOfStay = admissions.length
        ? admissions.reduce((sum: number, a: any) => sum + (new Date(a.discharged_at).getTime() - new Date(a.admitted_at).getTime()) / 86400000, 0) / admissions.length
        : null;

      const patientsWithOt = new Set((otAllRes.data ?? []).map((o: any) => o.admissions?.visits?.patient_id).filter(Boolean));
      const surgeryConsults = consultsRes.data ?? [];
      const surgeryConverted = surgeryConsults.filter((c: any) => c.visits?.patient_id && patientsWithOt.has(c.visits.patient_id)).length;

      const patientsWithVisit = new Set((visitsRes.data ?? []).map((v: any) => v.patient_id));
      const newPatients = patientsRes.data ?? [];
      const bySource = newPatients.reduce((acc: Record<string, { total: number; converted: number }>, p: any) => {
        const source = p.referral_source || 'Not recorded';
        acc[source] = acc[source] ?? { total: 0, converted: 0 };
        acc[source].total += 1;
        if (patientsWithVisit.has(p.id)) acc[source].converted += 1;
        return acc;
      }, {});

      const byReferringDoctor = newPatients.reduce((acc: Record<string, { total: number; converted: number }>, p: any) => {
        if (!p.referring_doctor_id) return acc;
        const name = p.referring_doctors?.full_name ?? 'Unknown';
        acc[name] = acc[name] ?? { total: 0, converted: 0 };
        acc[name].total += 1;
        if (patientsWithVisit.has(p.id)) acc[name].converted += 1;
        return acc;
      }, {});

      return {
        otCompleted: completed.length, otCancelled: cancelled.length, otTotalHours: totalHours,
        otAvgDuration: completed.length ? totalHours / completed.length : 0, otByRoom: byRoom,
        totalBeds: beds.length, occupiedBeds, avgLengthOfStay,
        surgeryAdvised: surgeryConsults.length, surgeryConverted,
        bySource, byReferringDoctor,
      };
    },
  });

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h3>Operational & Clinical KPIs</h3>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 160, marginBottom: 0 }}><label>From</label><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="field" style={{ maxWidth: 160, marginBottom: 0 }}><label>To</label><input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>

      {isLoading || !data ? <p className="text-muted">Loading…</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div className="card-kicker">OT utilization</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 600 }}>{data.otTotalHours.toFixed(1)} hrs</div>
              <div className="text-muted" style={{ fontSize: 12 }}>{data.otCompleted} completed · {data.otCancelled} cancelled · avg {data.otAvgDuration.toFixed(1)} hrs/case</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div className="card-kicker">Bed occupancy (current)</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 600 }}>{data.totalBeds ? ((data.occupiedBeds / data.totalBeds) * 100).toFixed(0) : 0}%</div>
              <div className="text-muted" style={{ fontSize: 12 }}>{data.occupiedBeds} / {data.totalBeds} beds occupied{data.avgLengthOfStay != null ? ` · avg stay ${data.avgLengthOfStay.toFixed(1)}d` : ''}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div className="card-kicker">Surgery conversion</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 600 }}>{data.surgeryAdvised ? ((data.surgeryConverted / data.surgeryAdvised) * 100).toFixed(0) : 0}%</div>
              <div className="text-muted" style={{ fontSize: 12 }}>{data.surgeryConverted} / {data.surgeryAdvised} advised cases converted</div>
            </div>
          </div>

          <h4>OT cases by room</h4>
          <table className="table" style={{ maxWidth: 400, marginBottom: 'var(--space-4)' }}>
            <thead><tr><th>Room</th><th>Cases</th></tr></thead>
            <tbody>
              {Object.entries(data.otByRoom).map(([room, count]) => <tr key={room}><td>{room}</td><td>{count}</td></tr>)}
              {Object.keys(data.otByRoom).length === 0 && <tr><td colSpan={2} className="text-muted">No OT cases in this range.</td></tr>}
            </tbody>
          </table>

          <h4>Referral source — registrations vs. converted to a visit</h4>
          <table className="table" style={{ maxWidth: 500 }}>
            <thead><tr><th>Source</th><th>Registered</th><th>Converted</th><th>Rate</th></tr></thead>
            <tbody>
              {Object.entries(data.bySource).map(([source, s]) => (
                <tr key={source}><td>{source}</td><td>{s.total}</td><td>{s.converted}</td><td>{s.total ? ((s.converted / s.total) * 100).toFixed(0) : 0}%</td></tr>
              ))}
              {Object.keys(data.bySource).length === 0 && <tr><td colSpan={4} className="text-muted">No new registrations in this range.</td></tr>}
            </tbody>
          </table>

          <h4 style={{ marginTop: 'var(--space-4)' }}>Referring doctors — volume &amp; conversion</h4>
          <table className="table" style={{ maxWidth: 500 }}>
            <thead><tr><th>Doctor</th><th>Referred</th><th>Converted</th><th>Rate</th></tr></thead>
            <tbody>
              {Object.entries(data.byReferringDoctor).map(([name, s]) => (
                <tr key={name}><td>{name}</td><td>{s.total}</td><td>{s.converted}</td><td>{s.total ? ((s.converted / s.total) * 100).toFixed(0) : 0}%</td></tr>
              ))}
              {Object.keys(data.byReferringDoctor).length === 0 && <tr><td colSpan={4} className="text-muted">No patients linked to a referring doctor in this range.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

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

      <MisKpiSection />

      <h3>Revenue & Registrations</h3>
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
