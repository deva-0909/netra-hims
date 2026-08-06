import { supabase } from './supabaseClient';

/**
 * Decrements real stock for a catalog drug. No-ops silently if drugId is
 * null (free-text / not-in-catalog items don't affect inventory). Not a
 * real DB transaction — fine for a single-pharmacy deployment, a
 * high-concurrency one should move this into a Postgres RPC.
 *
 * Blocks instead of silently clamping to 0 when the requested quantity
 * exceeds what's on the shelf — the reorder-level system means nothing if
 * dispensing itself never checks it. Also logs the deduction to
 * stock_receipts (negative quantity, adjustment_reason) so it shows up in
 * "Recent stock activity" — previously only restocks and write-offs ever
 * appeared there, never the far more frequent event of stock actually
 * going out the door.
 */
export async function deductDrugStock(
  drugId: string | null,
  quantity: number,
  reason: 'dispensed_opd' | 'dispensed_ipd' | 'dispensed_injection',
  dispensedBy: string | undefined
): Promise<{ error: string | null }> {
  if (!drugId) return { error: null };

  const { data: drug, error: drugError } = await supabase.from('drugs').select('name, stock_qty').eq('id', drugId).single();
  if (drugError) return { error: `Couldn't check stock: ${drugError.message}` };

  const available = drug?.stock_qty ?? 0;
  if (quantity > available) {
    return { error: `Insufficient stock for ${drug?.name ?? 'this drug'}: ${available} available, ${quantity} requested.` };
  }

  const { error: stockError } = await supabase.from('drugs').update({ stock_qty: available - quantity }).eq('id', drugId);
  if (stockError) return { error: `Couldn't update stock: ${stockError.message}` };

  const { error: ledgerError } = await supabase.from('stock_receipts').insert({
    drug_id: drugId, quantity_received: -quantity, adjustment_reason: reason, received_by: dispensedBy,
  });
  if (ledgerError) return { error: `Stock updated, but the ledger entry failed: ${ledgerError.message}` };

  return { error: null };
}
