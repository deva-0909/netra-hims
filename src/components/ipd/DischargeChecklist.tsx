import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { postBedCharges } from '../../lib/postBedCharges';

/** The one gate every discharge — whichever screen it's started from — has to
 * pass through: DB-enforced (admissions_discharge_requires_checklist), so
 * this is the single place both IpdWardPage and AdmissionStage call into.
 * Also posts any configured bed charges before showing the amount due, so
 * staff see the real total before confirming. */
export function DischargeChecklist({ admission, patient, onCancel, onDischarged }: { admission: any; patient: { full_name?: string | null } | null | undefined; onCancel: () => void; onDischarged: () => void }) {
  const qc = useQueryClient();
  const [medsHandedOver, setMedsHandedOver] = useState(false);
  const [summaryReviewed, setSummaryReviewed] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: bill } = useQuery({
    queryKey: ['ipd-discharge-bill', admission.id],
    queryFn: async () => {
      const { error: chargeError } = await postBedCharges(admission.id);
      if (chargeError) console.warn('Could not post bed charges:', chargeError);
      const { data, error } = await supabase.from('bills').select('payment_status, total_amount, amount_paid').eq('visit_id', admission.visit_id).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dueAmount = bill ? Number(bill.total_amount) - Number(bill.amount_paid) : 0;

  const confirm = async () => {
    setDischarging(true);
    setError(null);
    const { error: updateError } = await supabase.from('admissions').update({
      discharge_meds_handed_over: medsHandedOver,
      discharge_summary_reviewed: summaryReviewed,
      discharged_at: new Date().toISOString(),
    }).eq('id', admission.id);
    if (updateError) { setDischarging(false); setError(updateError.message); return; }
    if (admission.bed_id) await supabase.from('beds').update({ status: 'available' }).eq('id', admission.bed_id);
    setDischarging(false);
    qc.invalidateQueries({ queryKey: ['ipd-beds'] });
    qc.invalidateQueries({ queryKey: ['available-beds'] });
    onDischarged();
  };

  return (
    <div style={{ marginTop: 8, padding: 10, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
      <strong style={{ fontSize: 13 }}>Discharge checklist{patient?.full_name ? ` — ${patient.full_name}` : ''}</strong>
      {bill ? (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
          Bill {bill.payment_status} — &#8377;{Number(bill.amount_paid).toFixed(2)} of &#8377;{Number(bill.total_amount).toFixed(2)} paid
          {dueAmount > 0 && <span style={{ color: '#b64545' }}> · &#8377;{dueAmount.toFixed(2)} due</span>}
        </div>
      ) : (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No bill generated yet for this visit</div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 8 }}>
        <input type="checkbox" checked={medsHandedOver} onChange={(e) => setMedsHandedOver(e.target.checked)} /> Medications / valuables handed over to patient
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 4 }}>
        <input type="checkbox" checked={summaryReviewed} onChange={(e) => setSummaryReviewed(e.target.checked)} /> Discharge summary reviewed with patient / attendant
      </label>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={confirm} disabled={discharging || !medsHandedOver || !summaryReviewed}>
          {discharging ? 'Discharging…' : 'Confirm discharge'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
