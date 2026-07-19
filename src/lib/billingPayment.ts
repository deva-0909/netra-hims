import { supabase } from './supabaseClient';

/** Records a payment against a bill — supports partial payments, auto-computing
 * the right payment_status rather than only ever allowing "mark fully paid". */
export async function recordPayment(
  billId: string,
  additionalAmount: number,
  currentAmountPaid: number,
  totalAmount: number,
  paymentMethod?: string
): Promise<{ error: string | null }> {
  const newAmountPaid = Math.max(0, currentAmountPaid + additionalAmount);
  const status = newAmountPaid >= totalAmount ? 'paid' : newAmountPaid > 0 ? 'partially_paid' : 'unpaid';
  const payload: Record<string, unknown> = { amount_paid: newAmountPaid, payment_status: status };
  if (paymentMethod) payload.payment_method = paymentMethod;
  const { error } = await supabase.from('bills').update(payload).eq('id', billId);
  return { error: error?.message ?? null };
}

/** Marks a bill refunded. Keeps amount_paid as a historical record of what was
 * actually collected rather than zeroing it — the 'refunded' status is what
 * distinguishes it in reporting. */
export async function refundBill(billId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('bills').update({ payment_status: 'refunded' }).eq('id', billId);
  return { error: error?.message ?? null };
}
