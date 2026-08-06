import { supabase } from './supabaseClient';

function genBillNumber() {
  return `BILL-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

/** Posts a "Bed charges — <bed> × N day(s)" line item to the admission's
 * visit bill at discharge time, using the bed's configured daily_rate — the
 * one IPD charge that's easy to forget when everything else is manual
 * line-item entry. No-op if the bed has no rate set. Idempotent: won't post
 * twice for the same admission even if the discharge screen is reopened. */
export async function postBedCharges(admissionId: string): Promise<{ error: string | null }> {
  const { data: admission, error: admissionError } = await supabase
    .from('admissions')
    .select('id, visit_id, admitted_at, discharged_at, bed_id, beds(bed_number, ward, daily_rate)')
    .eq('id', admissionId)
    .single();
  if (admissionError || !admission) return { error: admissionError?.message ?? 'Admission not found.' };

  const bed = admission.beds as any;
  const rate = Number(bed?.daily_rate ?? 0);
  if (!admission.bed_id || !bed || rate <= 0) return { error: null };

  const { data: visit, error: visitError } = await supabase.from('visits').select('patient_id').eq('id', admission.visit_id).single();
  if (visitError || !visit) return { error: visitError?.message ?? 'Visit not found.' };

  const admittedAt = new Date(admission.admitted_at).getTime();
  const dischargedAt = admission.discharged_at ? new Date(admission.discharged_at).getTime() : Date.now();
  const days = Math.max(1, Math.ceil((dischargedAt - admittedAt) / 86400000));
  const amount = days * rate;
  const description = `Bed charges — ${bed.bed_number}${bed.ward ? ` (${bed.ward})` : ''} × ${days} day${days === 1 ? '' : 's'}`;

  const { data: bill, error: billFetchError } = await supabase
    .from('bills')
    .select('id, subtotal, total_amount, bill_items(description)')
    .eq('visit_id', admission.visit_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (billFetchError) return { error: billFetchError.message };

  if (bill && (bill.bill_items ?? []).some((i: any) => i.description.startsWith('Bed charges — '))) {
    return { error: null };
  }

  let billId = bill?.id;
  if (!billId) {
    const { data: newBill, error: billError } = await supabase.from('bills').insert({
      visit_id: admission.visit_id, patient_id: visit.patient_id, bill_number: genBillNumber(), subtotal: 0, total_amount: 0,
    }).select().single();
    if (billError || !newBill) return { error: billError?.message ?? 'Could not create the bed-charge bill.' };
    billId = newBill.id;
  }

  const { error: itemError } = await supabase.from('bill_items').insert({
    bill_id: billId, description, category: 'admission', quantity: days, unit_price: rate, amount,
  });
  if (itemError) return { error: itemError.message };

  const { error: updateError } = await supabase.from('bills').update({
    subtotal: (bill?.subtotal ?? 0) + amount,
    total_amount: (bill?.total_amount ?? 0) + amount,
  }).eq('id', billId);
  if (updateError) return { error: updateError.message };

  return { error: null };
}
