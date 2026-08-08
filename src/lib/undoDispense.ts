import { supabase } from './supabaseClient';
import { creditDrugStock } from './deductDrugStock';

/** Reverses a "Mark dispensed" — credits every catalog-linked line item back
 * to stock and reopens the dispense as pending. There was previously no
 * correction path for a pharmacist who dispensed the wrong order. */
export async function undoDispense(
  dispenseId: string,
  prescriptionId: string,
  undoneBy: string | undefined
): Promise<{ error: string | null }> {
  const { data: items, error: itemsError } = await supabase
    .from('prescription_items')
    .select('drug_id, quantity')
    .eq('prescription_id', prescriptionId);
  if (itemsError) return { error: itemsError.message };

  for (const item of items ?? []) {
    const { error } = await creditDrugStock(item.drug_id, item.quantity ?? 1, 'dispense_reversed', undoneBy);
    if (error) return { error };
  }

  const { error: updateError } = await supabase
    .from('pharmacy_dispenses')
    .update({ status: 'pending', dispensed_at: null, dispensed_by: null })
    .eq('id', dispenseId);
  if (updateError) return { error: updateError.message };
  return { error: null };
}

/** IPD mirror of undoDispense — reverses a "Send to ward" using the quantity
 * actually recorded at dispense time. */
export async function undoIpdDispense(
  orderId: string,
  drugId: string | null,
  quantity: number,
  undoneBy: string | undefined
): Promise<{ error: string | null }> {
  const { error: creditError } = await creditDrugStock(drugId, quantity, 'dispense_reversed', undoneBy);
  if (creditError) return { error: creditError };

  const { error: updateError } = await supabase
    .from('ipd_medication_orders')
    .update({ dispensed_to_ward: false, dispensed_by: null, dispensed_at: null, dispensed_quantity: null })
    .eq('id', orderId);
  if (updateError) return { error: updateError.message };
  return { error: null };
}
