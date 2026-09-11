import { supabase } from './supabaseClient';

const DEDUPE_WINDOW_MS = 60_000;

/** Records a payment against a bill — supports partial payments, auto-computing
 * the right payment_status rather than only ever allowing "mark fully paid".
 * Also logs the individual transaction, so a daily collections report can be
 * built from real events instead of just the bill's cumulative total.
 *
 * The bill update sets amount_paid absolutely (not incremented), so retrying
 * it alone is harmless. The transaction-log insert isn't — it always creates
 * a new row — so before inserting it self-checks for a matching transaction
 * already logged in the last minute (same bill/amount/method/recorder).
 * Without that, if the insert's own response was lost after it had already
 * committed (the bill update succeeded, so the caller saw an error and
 * retried), a naive retry would log the same payment twice and inflate the
 * collections report even though the bill's own total stayed correct. */
export async function recordPayment(
  billId: string,
  additionalAmount: number,
  currentAmountPaid: number,
  totalAmount: number,
  paymentMethod: string,
  recordedBy: string | undefined
): Promise<{ error: string | null }> {
  const balance = totalAmount - currentAmountPaid;
  if (additionalAmount > balance) {
    return { error: `Amount exceeds the balance due (₹${balance.toFixed(2)}).` };
  }
  const newAmountPaid = Math.max(0, currentAmountPaid + additionalAmount);
  const status = newAmountPaid >= totalAmount ? 'paid' : newAmountPaid > 0 ? 'partially_paid' : 'unpaid';
  const { error } = await supabase.from('bills').update({ amount_paid: newAmountPaid, payment_status: status, payment_method: paymentMethod }).eq('id', billId);
  if (error) return { error: error.message };

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  let dupeQuery = supabase
    .from('payment_transactions')
    .select('id')
    .eq('bill_id', billId)
    .eq('amount', additionalAmount)
    .eq('method', paymentMethod)
    .eq('transaction_type', 'payment')
    .gte('recorded_at', since);
  dupeQuery = recordedBy ? dupeQuery.eq('recorded_by', recordedBy) : dupeQuery.is('recorded_by', null);
  const { data: existing, error: dupeError } = await dupeQuery.limit(1);
  if (dupeError) return { error: `Payment recorded, but the transaction log couldn't be checked: ${dupeError.message}` };
  if (existing && existing.length > 0) return { error: null };

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
 * refund transaction with the reason for the audit trail.
 *
 * Same self-check as recordPayment before inserting the transaction log —
 * see its comment for why. */
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

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  let dupeQuery = supabase
    .from('payment_transactions')
    .select('id')
    .eq('bill_id', billId)
    .eq('amount', refundAmount)
    .eq('method', 'refund')
    .eq('transaction_type', 'refund')
    .gte('recorded_at', since);
  dupeQuery = recordedBy ? dupeQuery.eq('recorded_by', recordedBy) : dupeQuery.is('recorded_by', null);
  const { data: existing, error: dupeError } = await dupeQuery.limit(1);
  if (dupeError) return { error: `Refund recorded, but the transaction log couldn't be checked: ${dupeError.message}` };
  if (existing && existing.length > 0) return { error: null };

  const { error: txError } = await supabase.from('payment_transactions').insert({
    bill_id: billId, amount: refundAmount, method: 'refund', transaction_type: 'refund', recorded_by: recordedBy, notes: reason || null,
  });
  if (txError) return { error: `Refund recorded, but the transaction log entry failed: ${txError.message}` };
  return { error: null };
}
