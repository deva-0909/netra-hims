import { supabase } from './supabaseClient';

/**
 * Marks a pharmacy_dispenses row dispensed AND decrements real stock for every
 * line item that's linked to a catalog drug (drug_id set). Free-text items
 * (drug_id null — prescribed but not in the catalog) don't affect inventory.
 *
 * Runs as a sequence of REST calls, not a real DB transaction, so under heavy
 * concurrent dispensing there's a small race window on stock_qty — fine for a
 * single-pharmacy demo; a production deployment should move this into a
 * Postgres function called via RPC for atomicity.
 */
export async function dispensePrescription(
  dispenseId: string,
  prescriptionId: string,
  dispensedBy: string | undefined
): Promise<{ error: string | null }> {
  const { data: items, error: itemsError } = await supabase
    .from('prescription_items')
    .select('drug_id, quantity')
    .eq('prescription_id', prescriptionId);

  if (itemsError) return { error: itemsError.message };

  for (const item of items ?? []) {
    if (!item.drug_id) continue;

    const { data: drug, error: drugError } = await supabase
      .from('drugs')
      .select('stock_qty')
      .eq('id', item.drug_id)
      .single();

    if (drugError) return { error: `Couldn't check stock for one of the drugs: ${drugError.message}` };

    const newStock = Math.max(0, (drug?.stock_qty ?? 0) - (item.quantity ?? 1));
    const { error: stockError } = await supabase.from('drugs').update({ stock_qty: newStock }).eq('id', item.drug_id);
    if (stockError) return { error: `Couldn't update stock: ${stockError.message}` };
  }

  const { error: dispenseError } = await supabase
    .from('pharmacy_dispenses')
    .update({ status: 'dispensed', dispensed_at: new Date().toISOString(), dispensed_by: dispensedBy })
    .eq('id', dispenseId);

  if (dispenseError) return { error: dispenseError.message };
  return { error: null };
}
