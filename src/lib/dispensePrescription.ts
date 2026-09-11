import { supabase } from './supabaseClient';
import { deductDrugStock } from './deductDrugStock';

/**
 * Marks a pharmacy_dispenses row dispensed AND decrements real stock for every
 * line item that's linked to a catalog drug (drug_id set). Free-text items
 * (drug_id null — prescribed but not in the catalog) don't affect inventory.
 *
 * Runs as a sequence of REST calls, not a real DB transaction, so under heavy
 * concurrent dispensing there's a small race window on stock_qty — fine for a
 * single-pharmacy demo; a production deployment should move this into a
 * Postgres function called via RPC for atomicity.
 *
 * Retry-safe by construction: each item is marked `dispensed` immediately
 * after its own stock deduction succeeds, and already-`dispensed` items are
 * skipped on the next call. Without this, a failure partway through the list
 * (e.g. one item out of stock) would leave pharmacy_dispenses still
 * 'pending' — so retrying after restocking would re-run the whole loop and
 * double-deduct every item that already succeeded the first time.
 */
export async function dispensePrescription(
  dispenseId: string,
  prescriptionId: string,
  dispensedBy: string | undefined
): Promise<{ error: string | null }> {
  const { data: items, error: itemsError } = await supabase
    .from('prescription_items')
    .select('id, drug_id, quantity, dispensed')
    .eq('prescription_id', prescriptionId);

  if (itemsError) return { error: itemsError.message };

  for (const item of items ?? []) {
    if (item.dispensed) continue;
    const { error: deductError } = await deductDrugStock(item.drug_id, item.quantity ?? 1, 'dispensed_opd', dispensedBy);
    if (deductError) return { error: deductError };
    const { error: markError } = await supabase.from('prescription_items').update({ dispensed: true }).eq('id', item.id);
    if (markError) return { error: `Stock deducted, but couldn't record it: ${markError.message}` };
  }

  const { error: dispenseError } = await supabase
    .from('pharmacy_dispenses')
    .update({ status: 'dispensed', dispensed_at: new Date().toISOString(), dispensed_by: dispensedBy })
    .eq('id', dispenseId);

  if (dispenseError) return { error: dispenseError.message };
  return { error: null };
}
