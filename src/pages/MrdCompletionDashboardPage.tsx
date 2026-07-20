import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface Deficiency {
  label: string;
  patientName: string;
  uhid: string;
  visitId: string | null;
  detail: string;
}

async function findDeficiencies(): Promise<Deficiency[]> {
  const out: Deficiency[] = [];

  // 1. Discharged admissions with no signed consent on file.
  const { data: unconsented } = await supabase
    .from('admissions')
    .select('id, discharged_at, consent_signed, visits(id, patients(full_name, uhid))')
    .not('discharged_at', 'is', null)
    .eq('consent_signed', false);
  (unconsented ?? []).forEach((a: any) => out.push({
    label: 'Discharged without signed consent', patientName: a.visits?.patients?.full_name ?? '—',
    uhid: a.visits?.patients?.uhid ?? '—', visitId: a.visits?.id ?? null,
    detail: `Discharged ${new Date(a.discharged_at).toLocaleDateString()}`,
  }));

  // 2. Visits marked completed with no feedback on record.
  const { data: completedVisits } = await supabase.from('visits').select('id, patient_id, patients(full_name, uhid)').eq('stage', 'completed');
  if (completedVisits && completedVisits.length > 0) {
    const visitIds = completedVisits.map((v: any) => v.id);
    const { data: feedbackRows } = await supabase.from('feedback').select('visit_id').in('visit_id', visitIds);
    const withFeedback = new Set((feedbackRows ?? []).map((f: any) => f.visit_id));
    completedVisits.forEach((v: any) => {
      if (!withFeedback.has(v.id)) out.push({ label: 'Completed visit with no feedback recorded', patientName: v.patients?.full_name ?? '—', uhid: v.patients?.uhid ?? '—', visitId: v.id, detail: 'No feedback entry' });
    });
  }

  // 3. Completed visits with an outstanding bill.
  const { data: unpaidBills } = await supabase
    .from('bills')
    .select('id, payment_status, visit_id, patients(full_name, uhid), visits(stage)')
    .neq('payment_status', 'paid');
  (unpaidBills ?? []).forEach((b: any) => {
    if (b.visits?.stage === 'completed') {
      out.push({ label: 'Completed visit with unpaid balance', patientName: b.patients?.full_name ?? '—', uhid: b.patients?.uhid ?? '—', visitId: b.visit_id, detail: `Bill status: ${b.payment_status.replace(/_/g, ' ')}` });
    }
  });

  // 4. LASIK procedures performed without a signed consent on file for that visit.
  const { data: procedures } = await supabase.from('lasik_procedure_records').select('visit_id, visits(patients(full_name, uhid))');
  if (procedures && procedures.length > 0) {
    const visitIds = [...new Set(procedures.map((p: any) => p.visit_id))];
    const { data: consents } = await supabase.from('lasik_consents').select('visit_id, consent_signed').in('visit_id', visitIds);
    const signedVisits = new Set((consents ?? []).filter((c: any) => c.consent_signed).map((c: any) => c.visit_id));
    procedures.forEach((p: any) => {
      if (!signedVisits.has(p.visit_id)) {
        out.push({ label: 'LASIK procedure performed without signed consent', patientName: p.visits?.patients?.full_name ?? '—', uhid: p.visits?.patients?.uhid ?? '—', visitId: p.visit_id, detail: 'Missing/unsigned consent record' });
      }
    });
  }

  return out;
}

export function MrdCompletionDashboardPage() {
  const { data: deficiencies, isLoading } = useQuery({
    queryKey: ['mrd-deficiencies'],
    queryFn: findDeficiencies,
  });

  const grouped = (deficiencies ?? []).reduce((acc: Record<string, Deficiency[]>, d) => {
    (acc[d.label] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div>
      <h2>Record Completion Dashboard</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Real gaps found by checking existing hospital data — not a separate data-entry task. Useful ahead of an accreditation audit.
      </p>

      {isLoading ? (
        <p className="text-muted">Checking records…</p>
      ) : deficiencies?.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <strong style={{ color: 'var(--color-accent-700)' }}>No deficiencies found.</strong> All checked records are complete.
        </div>
      ) : (
        Object.entries(grouped).map(([label, items]) => (
          <div key={label} style={{ marginTop: 'var(--space-5)' }}>
            <h4>{label} <span className="tag tag-outline" style={{ marginLeft: 6 }}>{items.length}</span></h4>
            <table className="table">
              <thead><tr><th>Patient</th><th>Detail</th><th></th></tr></thead>
              <tbody>
                {items.map((d, i) => (
                  <tr key={i}>
                    <td>{d.patientName} <span className="text-muted">({d.uhid})</span></td>
                    <td className="text-muted">{d.detail}</td>
                    <td>{d.visitId && <Link className="btn btn-ghost" to={`/visits/${d.visitId}`}>Open visit</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
