import { supabase } from './supabaseClient';
import { deductDrugStock } from './deductDrugStock';

/**
 * Pharmacy's acknowledgment of an inpatient medication order — the IPD
 * mirror of dispensePrescription.ts. Deducts real stock only when the order
 * is linked to a catalog drug; free-text orders are acknowledged without
 * touching inventory, same tolerance prescription_items already has.
 */
export async function dispenseIpdOrder(
  orderId: string,
  drugId: string | null,
  quantity: number,
  dispensedBy: string | undefined
): Promise<{ error: string | null }> {
  const { error: deductError } = await deductDrugStock(drugId, quantity);
  if (deductError) return { error: deductError };

  const { error: updateError } = await supabase
    .from('ipd_medication_orders')
    .update({ dispensed_to_ward: true, dispensed_by: dispensedBy, dispensed_at: new Date().toISOString() })
    .eq('id', orderId);
  if (updateError) return { error: updateError.message };
  return { error: null };
}
