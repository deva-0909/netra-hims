import { supabase } from './supabaseClient';

/** Updates an optical order's status, and if it's moving to 'dispensed' and the
 * order is linked to a catalog frame, decrements that frame's stock by one.
 *
 * Blocks instead of silently clamping to 0 when there's no stock left — same
 * fix already applied to deductDrugStock.ts. Also logs the deduction to
 * eyewear_stock_receipts so it shows up in "Recent stock activity", which
 * previously only ever showed restocks and write-offs, never dispenses. */
export async function updateOpticalOrderStatus(
  orderId: string,
  newStatus: string,
  frameItemId: string | null | undefined,
  dispensedBy?: string
): Promise<{ error: string | null }> {
  if (newStatus === 'dispensed' && frameItemId) {
    const { data: item, error: itemError } = await supabase.from('eyewear_items').select('brand, model, stock_qty').eq('id', frameItemId).single();
    if (itemError) return { error: `Couldn't check frame stock: ${itemError.message}` };

    const available = item?.stock_qty ?? 0;
    if (available < 1) {
      return { error: `Insufficient stock for ${item?.brand ?? 'this frame'} ${item?.model ?? ''}: none available.` };
    }

    const { error: stockError } = await supabase.from('eyewear_items').update({ stock_qty: available - 1 }).eq('id', frameItemId);
    if (stockError) return { error: `Couldn't update frame stock: ${stockError.message}` };

    const { error: ledgerError } = await supabase.from('eyewear_stock_receipts').insert({
      item_id: frameItemId, quantity_received: -1, adjustment_reason: 'dispensed', received_by: dispensedBy,
    });
    if (ledgerError) return { error: `Stock updated, but the ledger entry failed: ${ledgerError.message}` };
  }
  const { error } = await supabase.from('optical_orders').update({ status: newStatus }).eq('id', orderId);
  return { error: error?.message ?? null };
}
