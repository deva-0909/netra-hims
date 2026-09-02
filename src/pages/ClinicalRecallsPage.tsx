import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

type Tab = 'injection' | 'glaucoma' | 'surgery' | 'lasik';

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const todayStr = () => new Date().toISOString().slice(0, 10);

interface RecallRow {
  key: string;
  patientId: string;
  patientName: string;
  uhid: string;
  phone: string | null;
  dueDate: string | null;
  detail: string;
  visitId: string | null;
}

function useInjectionDue() {
  return useQuery({
    queryKey: ['recall-injection-due'],
    queryFn: async (): Promise<RecallRow[]> => {
      const { data, error } = await supabase
        .from('injection_records')
        .select('id, eye, drug_name, next_dose_due, injected_at, visit_id, visits(patient_id, patients(full_name, uhid, phone))')
        .not('next_dose_due', 'is', null)
        .order('injected_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      // Keep only the most recent injection per patient+eye — that record's
      // next_dose_due is the one that's actually still pending (an earlier
      // due date superseded by a later injection is stale, not overdue).
      const latest = new Map<string, any>();
      for (const r of data as any[]) {
        const patientId = r.visits?.patient_id;
        if (!patientId) continue;
        const key = `${patientId}-${r.eye}`;
        if (!latest.has(key)) latest.set(key, r);
      }
      const cutoff = daysFromNow(14);
      return [...latest.values()]
        .filter((r) => r.next_dose_due <= cutoff)
        .sort((a, b) => a.next_dose_due.localeCompare(b.next_dose_due))
        .map((r) => ({
          key: r.id, patientId: r.visits.patient_id, patientName: r.visits.patients?.full_name ?? '—',
          uhid: r.visits.patients?.uhid ?? '—', phone: r.visits.patients?.phone ?? null,
          dueDate: r.next_dose_due, detail: `${r.eye.toUpperCase()} · ${r.drug_name}`, visitId: r.visit_id,
        }));
    },
  });
}

function useGlaucomaReviewDue() {
  return useQuery({
    queryKey: ['recall-glaucoma-review-due'],
    queryFn: async (): Promise<RecallRow[]> => {
      const { data, error } = await supabase
        .from('glaucoma_plans')
        .select('id, management, next_review_date, created_at, visit_id, visits(patient_id, patients(full_name, uhid, phone))')
        .not('next_review_date', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const latest = new Map<string, any>();
      for (const r of data as any[]) {
        const patientId = r.visits?.patient_id;
        if (!patientId) continue;
        if (!latest.has(patientId)) latest.set(patientId, r);
      }
      const cutoff = daysFromNow(14);
      return [...latest.values()]
        .filter((r) => r.next_review_date <= cutoff)
        .sort((a, b) => a.next_review_date.localeCompare(b.next_review_date))
        .map((r) => ({
          key: r.id, patientId: r.visits.patient_id, patientName: r.visits.patients?.full_name ?? '—',
          uhid: r.visits.patients?.uhid ?? '—', phone: r.visits.patients?.phone ?? null,
          dueDate: r.next_review_date, detail: r.management ? `${r.management} management` : 'Review due', visitId: r.visit_id,
        }));
    },
  });
}

/** "Not converted" is an approximation: any patient with at least one
 * needs_surgery consultation who currently has zero ot_records at all
 * (any status). A patient whose only surgery was years ago in the other
 * eye would still clear this check once any ot_record exists for them —
 * good enough for a staff-reviewed recall list, not a precise audit. */
function useSurgeryNotConverted() {
  return useQuery({
    queryKey: ['recall-surgery-not-converted'],
    queryFn: async (): Promise<RecallRow[]> => {
      const [{ data: consults, error: consultError }, { data: otRecords, error: otError }] = await Promise.all([
        supabase.from('consultations').select('id, diagnosis, created_at, visit_id, visits(patient_id, patients(full_name, uhid, phone))').eq('needs_surgery', true).order('created_at', { ascending: false }).limit(1000),
        supabase.from('ot_records').select('id, admissions(visit_id, visits(patient_id))').limit(2000),
      ]);
      if (consultError) throw consultError;
      if (otError) throw otError;
      const patientsWithOt = new Set((otRecords as any[]).map((o) => o.admissions?.visits?.patient_id).filter(Boolean));
      const latest = new Map<string, any>();
      for (const c of consults as any[]) {
        const patientId = c.visits?.patient_id;
        if (!patientId || patientsWithOt.has(patientId)) continue;
        if (!latest.has(patientId)) latest.set(patientId, c);
      }
      return [...latest.values()]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => ({
          key: c.id, patientId: c.visits.patient_id, patientName: c.visits.patients?.full_name ?? '—',
          uhid: c.visits.patients?.uhid ?? '—', phone: c.visits.patients?.phone ?? null,
          dueDate: c.created_at.slice(0, 10), detail: c.diagnosis ? `Advised for ${c.diagnosis}` : 'Surgery advised', visitId: c.visit_id,
        }));
    },
  });
}

/** Same approximation as surgery-not-converted: any lasik_procedure_records
 * row for the patient counts as "converted", regardless of which eye/date. */
function useLasikPending() {
  return useQuery({
    queryKey: ['recall-lasik-pending'],
    queryFn: async (): Promise<RecallRow[]> => {
      const [{ data: eligibility, error: eligError }, { data: procedures, error: procError }] = await Promise.all([
        supabase.from('lasik_eligibility').select('id, procedure_recommended, created_at, visit_id, visits(patient_id, patients(full_name, uhid, phone))').eq('eligible', true).order('created_at', { ascending: false }).limit(1000),
        supabase.from('lasik_procedure_records').select('id, visits(patient_id)').limit(2000),
      ]);
      if (eligError) throw eligError;
      if (procError) throw procError;
      const patientsWithProcedure = new Set((procedures as any[]).map((p) => p.visits?.patient_id).filter(Boolean));
      const latest = new Map<string, any>();
      for (const e of eligibility as any[]) {
        const patientId = e.visits?.patient_id;
        if (!patientId || patientsWithProcedure.has(patientId)) continue;
        if (!latest.has(patientId)) latest.set(patientId, e);
      }
      return [...latest.values()]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => ({
          key: e.id, patientId: e.visits.patient_id, patientName: e.visits.patients?.full_name ?? '—',
          uhid: e.visits.patients?.uhid ?? '—', phone: e.visits.patients?.phone ?? null,
          dueDate: e.created_at.slice(0, 10), detail: e.procedure_recommended ? `Recommended: ${e.procedure_recommended.toUpperCase()}` : 'Eligible', visitId: e.visit_id,
        }));
    },
  });
}

function RecallTable({ rows, isLoading, dueLabel, canCreateFollowUp, reasonPrefix }: { rows: RecallRow[] | undefined; isLoading: boolean; dueLabel: string; canCreateFollowUp: boolean; reasonPrefix: string }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [createdKeys, setCreatedKeys] = useState<Set<string>>(new Set());

  const createFollowUp = async (row: RecallRow) => {
    setCreatingKey(row.key);
    const { error } = await supabase.from('follow_ups').insert({
      visit_id: row.visitId, patient_id: row.patientId, due_date: row.dueDate && row.dueDate >= todayStr() ? row.dueDate : todayStr(),
      reason: `${reasonPrefix}${row.detail ? ` — ${row.detail}` : ''}`, created_by: profile?.id,
    });
    setCreatingKey(null);
    if (!error) {
      setCreatedKeys((prev) => new Set(prev).add(row.key));
      qc.invalidateQueries({ queryKey: ['follow-ups-due'] });
    }
  };

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!rows || rows.length === 0) return <p className="text-muted">Nothing here.</p>;

  return (
    <table className="table">
      <thead><tr><th>{dueLabel}</th><th>Patient</th><th>UHID</th><th>Phone</th><th>Detail</th><th /></tr></thead>
      <tbody>
        {rows.map((r) => {
          const overdue = !!r.dueDate && r.dueDate < todayStr();
          return (
            <tr key={r.key}>
              <td style={overdue ? { color: '#b64545', fontWeight: 600 } : undefined}>{r.dueDate ?? '—'}{overdue ? ' (overdue)' : ''}</td>
              <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${r.patientId}`)}>{r.patientName}</td>
              <td>{r.uhid}</td>
              <td>{r.phone ?? '—'}</td>
              <td className="text-muted">{r.detail}</td>
              <td>
                {canCreateFollowUp && (
                  createdKeys.has(r.key)
                    ? <span className="tag tag-accent">follow-up created</span>
                    : <button className="btn btn-ghost" onClick={() => createFollowUp(r)} disabled={creatingKey === r.key}>{creatingKey === r.key ? 'Creating…' : 'Create follow-up'}</button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ClinicalRecallsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('injection');
  const canCreateFollowUp = profile?.role === 'reception' || profile?.role === 'doctor' || profile?.role === 'nurse' || profile?.role === 'admin';

  const injectionDue = useInjectionDue();
  const glaucomaReviewDue = useGlaucomaReviewDue();
  const surgeryNotConverted = useSurgeryNotConverted();
  const lasikPending = useLasikPending();

  const TABS: { key: Tab; label: string; count: number | undefined }[] = [
    { key: 'injection', label: 'Injection Due', count: injectionDue.data?.length },
    { key: 'glaucoma', label: 'Glaucoma Review Due', count: glaucomaReviewDue.data?.length },
    { key: 'surgery', label: 'Surgery Advised — Not Converted', count: surgeryNotConverted.data?.length },
    { key: 'lasik', label: 'LASIK Pending', count: lasikPending.data?.length },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Clinical Recalls</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>
        Targeted recall lists computed live from clinical records — not a separate log staff have to remember to fill in. These are approximations meant for a human to review, not a precise audit: "not converted" / "pending" only checks whether any relevant procedure record exists at all for the patient.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}{t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'injection' && <RecallTable rows={injectionDue.data} isLoading={injectionDue.isLoading} dueLabel="Next dose due" canCreateFollowUp={canCreateFollowUp} reasonPrefix="Injection due" />}
      {tab === 'glaucoma' && <RecallTable rows={glaucomaReviewDue.data} isLoading={glaucomaReviewDue.isLoading} dueLabel="Review due" canCreateFollowUp={canCreateFollowUp} reasonPrefix="Glaucoma review due" />}
      {tab === 'surgery' && <RecallTable rows={surgeryNotConverted.data} isLoading={surgeryNotConverted.isLoading} dueLabel="Advised on" canCreateFollowUp={canCreateFollowUp} reasonPrefix="Surgery advised, not yet scheduled" />}
      {tab === 'lasik' && <RecallTable rows={lasikPending.data} isLoading={lasikPending.isLoading} dueLabel="Assessed on" canCreateFollowUp={canCreateFollowUp} reasonPrefix="LASIK eligible, procedure pending" />}
    </div>
  );
}
