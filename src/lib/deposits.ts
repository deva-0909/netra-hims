import { supabase } from './supabaseClient';
import { recordPayment } from './billingPayment';

export async function collectDeposit(
  patientId: string,
  visitId: string | null,
  amount: number,
  purpose: string,
  notes: string,
  collectedBy: string | undefined
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('deposits').insert({
    patient_id: patientId, visit_id: visitId, amount, purpose: purpose || null, notes: notes || null, collected_by: collectedBy,
  });
  return { error: error?.message ?? null };
}

const MAX_CAS_ATTEMPTS = 5;

/** Applies part or all of a held deposit toward a specific bill — reuses
 * recordPayment so the bill's amount_paid/payment_status logic stays in one
 * place (including its own compare-and-swap protection), then marks the
 * deposit adjusted (or partially, if only part of it was applied).
 *
 * The deposit's own update is protected the same way: two staff applying the
 * same deposit at nearly the same moment would otherwise both compute
 * newAdjustedAmount from the same stale deposit.adjusted_amount, and the
 * second write would silently discard the first's adjustment — letting the
 * same deposit be over-applied beyond its held balance across two bills. */
export async function adjustDepositToBill(
  deposit: any,
  billId: string,
  billAmountPaid: number,
  billTotalAmount: number,
  amount: number,
  recordedBy: string | undefined
): Promise<{ error: string | null }> {
  const heldBalance = Number(deposit.amount) - Number(deposit.adjusted_amount) - Number(deposit.refunded_amount);
  if (amount <= 0 || amount > heldBalance) {
    return { error: `Amount must be between ₹0.01 and the held balance of ₹${heldBalance.toFixed(2)}.` };
  }

  const { error: payError } = await recordPayment(billId, amount, billAmountPaid, billTotalAmount, 'deposit_adjustment', recordedBy);
  if (payError) return { error: payError };

  let baseAdjustedAmount = Number(deposit.adjusted_amount);
  const baseRefundedAmount = Number(deposit.refunded_amount);
  for (let attempt = 0; ; attempt++) {
    const newAdjustedAmount = baseAdjustedAmount + amount;
    const fullyUsed = newAdjustedAmount + baseRefundedAmount >= Number(deposit.amount);
    const { data, error } = await supabase.from('deposits').update({
      adjusted_amount: newAdjustedAmount,
      adjusted_bill_id: billId,
      adjusted_at: new Date().toISOString(),
      status: fullyUsed ? 'adjusted' : 'partially_adjusted',
    }).eq('id', deposit.id).eq('adjusted_amount', baseAdjustedAmount).select('id');
    if (error) return { error: `Payment recorded on the bill, but the deposit record failed to update: ${error.message}` };
    if (data && data.length > 0) return { error: null };
    if (attempt >= MAX_CAS_ATTEMPTS - 1) return { error: 'Payment recorded on the bill, but the deposit was adjusted elsewhere at the same time — please refresh and try again.' };
    const { data: fresh, error: readError } = await supabase.from('deposits').select('adjusted_amount').eq('id', deposit.id).single();
    if (readError || !fresh) return { error: `Payment recorded on the bill, but couldn't re-check the deposit: ${readError?.message ?? 'not found'}` };
    baseAdjustedAmount = fresh.adjusted_amount;
  }
}

/** Refunds the still-held (not yet adjusted to a bill) portion of a deposit —
 * e.g. a surgery advance the patient never ended up needing. Same
 * compare-and-swap protection as adjustDepositToBill — see its comment. */
export async function refundDeposit(deposit: any, amount: number, reason: string, refundedBy: string | undefined): Promise<{ error: string | null }> {
  if (!reason.trim()) return { error: 'A reason is required to refund a deposit.' };

  let baseRefundedAmount = Number(deposit.refunded_amount);
  const adjustedAmount = Number(deposit.adjusted_amount);
  for (let attempt = 0; ; attempt++) {
    const heldBalance = Number(deposit.amount) - adjustedAmount - baseRefundedAmount;
    if (amount <= 0 || amount > heldBalance) {
      return { error: `Refund amount must be between ₹0.01 and the held balance of ₹${heldBalance.toFixed(2)}.` };
    }
    const newRefundedAmount = baseRefundedAmount + amount;
    const fullyResolved = newRefundedAmount + adjustedAmount >= Number(deposit.amount);
    const { data, error } = await supabase.from('deposits').update({
      refunded_amount: newRefundedAmount,
      refund_reason: reason,
      refunded_by: refundedBy,
      refunded_at: new Date().toISOString(),
      status: fullyResolved ? 'refunded' : 'partially_refunded',
    }).eq('id', deposit.id).eq('refunded_amount', baseRefundedAmount).select('id');
    if (error) return { error: error.message };
    if (data && data.length > 0) return { error: null };
    if (attempt >= MAX_CAS_ATTEMPTS - 1) return { error: 'The deposit was refunded elsewhere at the same time — please refresh and try again.' };
    const { data: fresh, error: readError } = await supabase.from('deposits').select('refunded_amount').eq('id', deposit.id).single();
    if (readError || !fresh) return { error: readError?.message ?? 'Could not re-check the deposit after a concurrent update.' };
    baseRefundedAmount = fresh.refunded_amount;
  }
}
