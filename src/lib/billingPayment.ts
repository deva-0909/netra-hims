import { supabase } from './supabaseClient';

const DEDUPE_WINDOW_MS = 60_000;
const MAX_CAS_ATTEMPTS = 5;

/** Records a payment against a bill — supports partial payments, auto-computing
 * the right payment_status rather than only ever allowing "mark fully paid".
 * Also logs the individual transaction, so a daily collections report can be
 * built from real events instead of just the bill's cumulative total.
 *
 * The bill update sets amount_paid absolutely (not incremented) — but two
 * cashiers recording payments against the same bill within moments of each
 * other (or one cashier double-clicking, or two open tabs) would otherwise
 * both compute newAmountPaid from the same stale currentAmountPaid, and
 * whichever write lands second would silently overwrite the first's payment
 * out of the bill's total — the money would still be logged correctly in
 * payment_transactions, but the bill's own balance would be wrong with no
 * error surfaced. The update below is a compare-and-swap: it only takes
 * effect if amount_paid still matches what this call read, and re-reads the
 * real current value to retry when another write won the race in between,
 * so retrying converges on the correct total instead of ever discarding a
 * payment.
 *
 * The transaction-log insert has a separate hazard — it always creates a new
 * row — so before inserting it self-checks for a matching transaction
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
  let baseAmountPaid = currentAmountPaid;
  let newAmountPaid = 0;
  for (let attempt = 0; ; attempt++) {
    const balance = totalAmount - baseAmountPaid;
    if (additionalAmount > balance) {
      return { error: `Amount exceeds the balance due (₹${balance.toFixed(2)}).` };
    }
    newAmountPaid = Math.max(0, baseAmountPaid + additionalAmount);
    const status = newAmountPaid >= totalAmount ? 'paid' : newAmountPaid > 0 ? 'partially_paid' : 'unpaid';
    const { data, error } = await supabase.from('bills')
      .update({ amount_paid: newAmountPaid, payment_status: status, payment_method: paymentMethod })
      .eq('id', billId).eq('amount_paid', baseAmountPaid)
      .select('id');
    if (error) return { error: error.message };
    if (data && data.length > 0) break;
    if (attempt >= MAX_CAS_ATTEMPTS - 1) return { error: 'Another payment was recorded for this bill at the same time — please refresh and try again.' };
    const { data: fresh, error: readError } = await supabase.from('bills').select('amount_paid').eq('id', billId).single();
    if (readError || !fresh) return { error: readError?.message ?? 'Could not re-check the bill after a concurrent update.' };
    baseAmountPaid = fresh.amount_paid;
  }

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
 * Same compare-and-swap protection as recordPayment against two concurrent
 * refunds on the same bill silently overwriting each other, and the same
 * self-check before inserting the transaction log — see its comment for why. */
export async function refundBill(
  billId: string,
  amountPaid: number,
  currentAmountRefunded: number,
  refundAmount: number,
  reason: string,
  recordedBy: string | undefined
): Promise<{ error: string | null }> {
  let baseAmountRefunded = currentAmountRefunded;
  for (let attempt = 0; ; attempt++) {
    const refundableBalance = amountPaid - baseAmountRefunded;
    if (refundAmount <= 0 || refundAmount > refundableBalance) {
      return { error: `Refund amount must be between ₹0.01 and the refundable balance of ₹${refundableBalance.toFixed(2)}.` };
    }
    const newAmountRefunded = baseAmountRefunded + refundAmount;
    const status = newAmountRefunded >= amountPaid ? 'refunded' : 'partially_refunded';
    const { data, error } = await supabase.from('bills')
      .update({ amount_refunded: newAmountRefunded, payment_status: status })
      .eq('id', billId).eq('amount_refunded', baseAmountRefunded)
      .select('id');
    if (error) return { error: error.message };
    if (data && data.length > 0) break;
    if (attempt >= MAX_CAS_ATTEMPTS - 1) return { error: 'Another refund was recorded for this bill at the same time — please refresh and try again.' };
    const { data: fresh, error: readError } = await supabase.from('bills').select('amount_refunded').eq('id', billId).single();
    if (readError || !fresh) return { error: readError?.message ?? 'Could not re-check the bill after a concurrent update.' };
    baseAmountRefunded = fresh.amount_refunded;
  }

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
