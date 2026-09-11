import { supabase } from './supabaseClient';

/** Updates an optical order's status, and if it's moving to 'dispensed' and the
 * order is linked to a catalog frame, decrements that frame's stock by one.
 *
 * Blocks instead of silently clamping to 0 when there's no stock left — same
 * fix already applied to deductDrugStock.ts. Also logs the deduction to
 * eyewear_stock_receipts so it shows up in "Recent stock activity", which
 * previously only ever showed restocks and write-offs, never dispenses.
 *
 * Retry-safe: reads the order's own `stock_deducted` column itself (rather
 * than trusting a value the caller might be holding stale — the caller's own
 * query cache isn't guaranteed to have been refreshed since the last, failed
 * attempt) and skips re-deducting if it's already true. That flag is set
 * immediately once the stock update succeeds, before the ledger insert — so
 * if that insert fails, a retry skips re-deducting the frame instead of
 * taking it twice. */
export async function updateOpticalOrderStatus(
  orderId: string,
  newStatus: string,
  frameItemId: string | null | undefined,
  dispensedBy: string | undefined
): Promise<{ error: string | null }> {
  if (newStatus === 'dispensed' && frameItemId) {
    const { data: current, error: currentError } = await supabase.from('optical_orders').select('stock_deducted').eq('id', orderId).single();
    if (currentError) return { error: `Couldn't check dispense state: ${currentError.message}` };
    if (current?.stock_deducted) {
      const { error } = await supabase.from('optical_orders').update({ status: newStatus }).eq('id', orderId);
      return { error: error?.message ?? null };
    }
    const { data: item, error: itemError } = await supabase.from('eyewear_items').select('brand, model, stock_qty').eq('id', frameItemId).single();
    if (itemError) return { error: `Couldn't check frame stock: ${itemError.message}` };

    const available = item?.stock_qty ?? 0;
    if (available < 1) {
      return { error: `Insufficient stock for ${item?.brand ?? 'this frame'} ${item?.model ?? ''}: none available.` };
    }

    const { error: stockError } = await supabase.from('eyewear_items').update({ stock_qty: available - 1 }).eq('id', frameItemId);
    if (stockError) return { error: `Couldn't update frame stock: ${stockError.message}` };

    const { error: markError } = await supabase.from('optical_orders').update({ stock_deducted: true }).eq('id', orderId);
    if (markError) return { error: `Stock deducted, but couldn't record it: ${markError.message}` };

    const { error: ledgerError } = await supabase.from('eyewear_stock_receipts').insert({
      item_id: frameItemId, quantity_received: -1, adjustment_reason: 'dispensed', received_by: dispensedBy,
    });
    if (ledgerError) return { error: `Stock updated, but the ledger entry failed: ${ledgerError.message}` };
  }
  const { error } = await supabase.from('optical_orders').update({ status: newStatus }).eq('id', orderId);
  return { error: error?.message ?? null };
}
