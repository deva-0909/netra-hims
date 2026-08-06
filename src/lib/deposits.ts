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

/** Applies part or all of a held deposit toward a specific bill — reuses
 * recordPayment so the bill's amount_paid/payment_status logic stays in one
 * place, then marks the deposit adjusted (or partially, if only part of it
 * was applied). */
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

  const newAdjustedAmount = Number(deposit.adjusted_amount) + amount;
  const fullyUsed = newAdjustedAmount + Number(deposit.refunded_amount) >= Number(deposit.amount);
  const { error } = await supabase.from('deposits').update({
    adjusted_amount: newAdjustedAmount,
    adjusted_bill_id: billId,
    adjusted_at: new Date().toISOString(),
    status: fullyUsed ? 'adjusted' : 'partially_adjusted',
  }).eq('id', deposit.id);
  if (error) return { error: `Payment recorded on the bill, but the deposit record failed to update: ${error.message}` };
  return { error: null };
}

/** Refunds the still-held (not yet adjusted to a bill) portion of a deposit —
 * e.g. a surgery advance the patient never ended up needing. */
export async function refundDeposit(deposit: any, amount: number, reason: string, refundedBy: string | undefined): Promise<{ error: string | null }> {
  const heldBalance = Number(deposit.amount) - Number(deposit.adjusted_amount) - Number(deposit.refunded_amount);
  if (amount <= 0 || amount > heldBalance) {
    return { error: `Refund amount must be between ₹0.01 and the held balance of ₹${heldBalance.toFixed(2)}.` };
  }
  if (!reason.trim()) return { error: 'A reason is required to refund a deposit.' };

  const newRefundedAmount = Number(deposit.refunded_amount) + amount;
  const fullyResolved = newRefundedAmount + Number(deposit.adjusted_amount) >= Number(deposit.amount);
  const { error } = await supabase.from('deposits').update({
    refunded_amount: newRefundedAmount,
    refund_reason: reason,
    refunded_by: refundedBy,
    refunded_at: new Date().toISOString(),
    status: fullyResolved ? 'refunded' : 'partially_refunded',
  }).eq('id', deposit.id);
  return { error: error?.message ?? null };
}
