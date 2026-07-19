import { supabase } from './supabaseClient';

/** Updates an optical order's status, and if it's moving to 'dispensed' and the
 * order is linked to a catalog frame, decrements that frame's stock by one. */
export async function updateOpticalOrderStatus(
  orderId: string,
  newStatus: string,
  frameItemId: string | null | undefined
): Promise<{ error: string | null }> {
  if (newStatus === 'dispensed' && frameItemId) {
    const { data: item, error: itemError } = await supabase.from('eyewear_items').select('stock_qty').eq('id', frameItemId).single();
    if (itemError) return { error: `Couldn't check frame stock: ${itemError.message}` };
    const newStock = Math.max(0, (item?.stock_qty ?? 0) - 1);
    const { error: stockError } = await supabase.from('eyewear_items').update({ stock_qty: newStock }).eq('id', frameItemId);
    if (stockError) return { error: `Couldn't update frame stock: ${stockError.message}` };
  }
  const { error } = await supabase.from('optical_orders').update({ status: newStatus }).eq('id', orderId);
  return { error: error?.message ?? null };
}
