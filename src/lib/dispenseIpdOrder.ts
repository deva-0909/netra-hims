import { supabase } from './supabaseClient';
import { deductDrugStock } from './deductDrugStock';

/**
 * Pharmacy's acknowledgment of an inpatient medication order — the IPD
 * mirror of dispensePrescription.ts. Deducts real stock only when the order
 * is linked to a catalog drug; free-text orders are acknowledged without
 * touching inventory, same tolerance prescription_items already has.
 *
 * Self-checks the order's own dispensed_to_ward flag before deducting, so a
 * retry after the finalizing update fails (or its response is lost) reuses
 * that already-successful deduction instead of drawing stock a second time.
 */
export async function dispenseIpdOrder(
  orderId: string,
  drugId: string | null,
  quantity: number,
  dispensedBy: string | undefined
): Promise<{ error: string | null }> {
  const { data: existing, error: existingError } = await supabase
    .from('ipd_medication_orders')
    .select('dispensed_to_ward')
    .eq('id', orderId)
    .single();
  if (existingError) return { error: existingError.message };

  if (!existing?.dispensed_to_ward) {
    const { error: deductError } = await deductDrugStock(drugId, quantity, 'dispensed_ipd', dispensedBy);
    if (deductError) return { error: deductError };
  }

  const { error: updateError } = await supabase
    .from('ipd_medication_orders')
    .update({ dispensed_to_ward: true, dispensed_by: dispensedBy, dispensed_at: new Date().toISOString(), dispensed_quantity: quantity })
    .eq('id', orderId);
  if (updateError) return { error: updateError.message };
  return { error: null };
}
