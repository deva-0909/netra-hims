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

/** Marks a bill refunded. Keeps amount_paid as a historical record of what was
 * actually collected rather than zeroing it — the 'refunded' status is what
 * distinguishes it in reporting. Logs a matching refund transaction. */
export async function refundBill(billId: string, amount: number, recordedBy: string | undefined): Promise<{ error: string | null }> {
  const { error } = await supabase.from('bills').update({ payment_status: 'refunded' }).eq('id', billId);
  if (error) return { error: error.message };

  const { error: txError } = await supabase.from('payment_transactions').insert({
    bill_id: billId, amount, method: 'refund', transaction_type: 'refund', recorded_by: recordedBy,
  });
  if (txError) return { error: `Refund recorded, but the transaction log entry failed: ${txError.message}` };
  return { error: null };
}
