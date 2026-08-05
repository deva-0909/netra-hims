import { supabase } from './supabaseClient';

/**
 * Decrements real stock for a catalog drug. No-ops silently if drugId is
 * null (free-text / not-in-catalog items don't affect inventory). Not a
 * real DB transaction — fine for a single-pharmacy deployment, a
 * high-concurrency one should move this into a Postgres RPC.
 */
export async function deductDrugStock(drugId: string | null, quantity: number): Promise<{ error: string | null }> {
  if (!drugId) return { error: null };

  const { data: drug, error: drugError } = await supabase.from('drugs').select('stock_qty').eq('id', drugId).single();
  if (drugError) return { error: `Couldn't check stock: ${drugError.message}` };

  const newStock = Math.max(0, (drug?.stock_qty ?? 0) - quantity);
  const { error: stockError } = await supabase.from('drugs').update({ stock_qty: newStock }).eq('id', drugId);
  if (stockError) return { error: `Couldn't update stock: ${stockError.message}` };
  return { error: null };
}
