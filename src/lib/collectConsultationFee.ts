import { supabase } from './supabaseClient';

function genBillNumber() {
  return `BILL-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

const MODULE_LABEL: Record<string, string> = {
  general: 'General OPD', retina: 'Retina', glaucoma: 'Glaucoma', lasik: 'LASIK / Refractive', cornea: 'Cornea', pediatric: 'Pediatric Ophthalmology',
};

/** Indian OPD practice: the consultation charge is collected up front, before
 * the token is issued — not billed at the end of the visit like everything
 * else. Creates a fully-paid bill for the fee (visit_id filled in right
 * after, once the visit/token actually exist) and logs the payment
 * transaction, matching the same bills/bill_items/payment_transactions
 * shape the end-of-visit BillingStage uses. */
export async function collectConsultationFee(
  patientId: string,
  clinicModule: string,
  amount: number,
  method: string,
  collectedBy: string | undefined
): Promise<{ error: string | null; billId: string | null }> {
  const { data: bill, error: billError } = await supabase.from('bills').insert({
    patient_id: patientId,
    bill_number: genBillNumber(),
    subtotal: amount,
    total_amount: amount,
    amount_paid: amount,
    payment_status: 'paid',
    payment_method: method,
    generated_by: collectedBy,
  }).select().single();
  if (billError || !bill) return { error: billError?.message ?? 'Could not create the consultation bill.', billId: null };

  const { error: itemError } = await supabase.from('bill_items').insert({
    bill_id: bill.id, description: `Consultation — ${MODULE_LABEL[clinicModule] ?? clinicModule}`, category: 'consultation', quantity: 1, unit_price: amount, amount,
  });
  if (itemError) return { error: `Bill created, but the line item failed to save: ${itemError.message}`, billId: bill.id };

  const { error: txError } = await supabase.from('payment_transactions').insert({
    bill_id: bill.id, amount, method, transaction_type: 'payment', recorded_by: collectedBy,
  });
  if (txError) return { error: `Payment recorded, but the transaction log entry failed: ${txError.message}`, billId: bill.id };

  return { error: null, billId: bill.id };
}

/** Links the consultation bill to the visit it paid for — the visit can only
 * be created after payment (that's the whole point of the gate), so the
 * bill exists first with visit_id null and gets backfilled here. */
export async function linkConsultationBillToVisit(billId: string, visitId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('bills').update({ visit_id: visitId }).eq('id', billId);
  return { error: error?.message ?? null };
}
