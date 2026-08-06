import { supabase } from './supabaseClient';

/** Records the vendor's invoice against a PO — the first step before any
 * payment can be tracked, since payment_status needs an invoice_amount to be
 * meaningful (a PO can be fully received but the vendor hasn't billed yet). */
export async function recordPoInvoice(poId: string, invoiceNumber: string, invoiceAmount: number, amountPaid: number): Promise<{ error: string | null }> {
  if (!invoiceAmount || invoiceAmount <= 0) return { error: 'Invoice amount must be greater than zero.' };
  const status = amountPaid >= invoiceAmount ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid';
  const { error } = await supabase.from('purchase_orders').update({
    invoice_number: invoiceNumber || null, invoice_amount: invoiceAmount, payment_status: status,
  }).eq('id', poId);
  return { error: error?.message ?? null };
}

/** Records part or all of a vendor payment against an invoiced PO — supports
 * partial payments the same way patient billing does, with a full log of
 * individual payments in po_payments for reconciliation. */
export async function recordPoPayment(
  poId: string,
  amount: number,
  currentAmountPaid: number,
  invoiceAmount: number,
  method: string,
  notes: string,
  recordedBy: string | undefined
): Promise<{ error: string | null }> {
  const remaining = invoiceAmount - currentAmountPaid;
  if (amount <= 0 || amount > remaining) {
    return { error: `Amount must be between ₹0.01 and the remaining balance of ₹${remaining.toFixed(2)}.` };
  }

  const newAmountPaid = currentAmountPaid + amount;
  const status = newAmountPaid >= invoiceAmount ? 'paid' : 'partially_paid';
  const { error } = await supabase.from('purchase_orders').update({ amount_paid: newAmountPaid, payment_status: status }).eq('id', poId);
  if (error) return { error: error.message };

  const { error: txError } = await supabase.from('po_payments').insert({ po_id: poId, amount, method: method || null, notes: notes || null, recorded_by: recordedBy });
  if (txError) return { error: `Payment recorded on the PO, but the payment log entry failed: ${txError.message}` };
  return { error: null };
}
