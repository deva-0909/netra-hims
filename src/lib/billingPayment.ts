import { supabase } from './supabaseClient';

/** Records a payment against a bill — supports partial payments, auto-computing
 * the right payment_status rather than only ever allowing "mark fully paid".
 * Also logs the individual transaction, so a daily collections report can be
 * built from real events instead of just the bill's cumulative total. */
export async function recordPayment(
  billId: string,
  additionalAmount: number,
  currentAmountPaid: number,
  totalAmount: number,
  paymentMethod: string,
  recordedBy: string | undefined
): Promise<{ error: string | null }> {
  const newAmountPaid = Math.max(0, currentAmountPaid + additionalAmount);
  const status = newAmountPaid >= totalAmount ? 'paid' : newAmountPaid > 0 ? 'partially_paid' : 'unpaid';
  const { error } = await supabase.from('bills').update({ amount_paid: newAmountPaid, payment_status: status, payment_method: paymentMethod }).eq('id', billId);
  if (error) return { error: error.message };

  const { error: txError } = await supabase.from('payment_transactions').insert({
    bill_id: billId, amount: additionalAmount, method: paymentMethod, transaction_type: 'payment', recorded_by: recordedBy,
  });
  if (txError) return { error: `Payment recorded, but the transaction log entry failed: ${txError.message}` };
  return { error: null };
}

/** Refunds part or all of what's been paid on a bill — a patient overpaid, a
 * procedure was cancelled after payment, etc. Keeps amount_paid as a
 * historical record of what was actually collected; amount_refunded tracks
 * what's gone back out, so a partial refund doesn't lose the paid-amount
 * history the way overwriting amount_paid directly would. Logs a matching
 * refund transaction with the reason for the audit trail. */
export async function refundBill(
  billId: string,
  amountPaid: number,
  currentAmountRefunded: number,
  refundAmount: number,
  reason: string,
  recordedBy: string | undefined
): Promise<{ error: string | null }> {
  const refundableBalance = amountPaid - currentAmountRefunded;
  if (refundAmount <= 0 || refundAmount > refundableBalance) {
    return { error: `Refund amount must be between ₹0.01 and the refundable balance of ₹${refundableBalance.toFixed(2)}.` };
  }

  const newAmountRefunded = currentAmountRefunded + refundAmount;
  const status = newAmountRefunded >= amountPaid ? 'refunded' : 'partially_refunded';
  const { error } = await supabase.from('bills').update({ amount_refunded: newAmountRefunded, payment_status: status }).eq('id', billId);
  if (error) return { error: error.message };

  const { error: txError } = await supabase.from('payment_transactions').insert({
    bill_id: billId, amount: refundAmount, method: 'refund', transaction_type: 'refund', recorded_by: recordedBy, notes: reason || null,
  });
  if (txError) return { error: `Refund recorded, but the transaction log entry failed: ${txError.message}` };
  return { error: null };
}
