import { supabase } from './supabaseClient';

/**
 * Decrements real stock for a catalog drug. No-ops silently if drugId is
 * null (free-text / not-in-catalog items don't affect inventory). Not a
 * real DB transaction — fine for a single-pharmacy deployment, a
 * high-concurrency one should move this into a Postgres RPC.
 *
 * Blocks instead of silently clamping to 0 when the requested quantity
 * exceeds what's on the shelf — the reorder-level system means nothing if
 * dispensing itself never checks it.
 *
 * Allocates the deduction across batches oldest-expiry-first (FEFO) and logs
 * one ledger row per batch actually drawn from — previously a dispense only
 * ever decremented the aggregate stock_qty pool with zero batch attribution,
 * so a recall on a specific batch had no way to trace which patients
 * received it, and nothing ever preferred using up near-expiry stock first.
 * Any quantity beyond what tracked batches cover falls back to an
 * untracked (no batch_number) ledger row, so older stock received before
 * batch tracking existed doesn't block dispensing.
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

  const { data: receipts } = await supabase
    .from('stock_receipts')
    .select('batch_number, quantity_received, expiry_date')
    .eq('drug_id', drugId)
    .not('batch_number', 'is', null);

  const batchMap = new Map<string, { remaining: number; expiry: string | null }>();
  for (const r of receipts ?? []) {
    const key = r.batch_number as string;
    const entry = batchMap.get(key) ?? { remaining: 0, expiry: null };
    entry.remaining += r.quantity_received;
    if (r.expiry_date && (!entry.expiry || r.expiry_date < entry.expiry)) entry.expiry = r.expiry_date;
    batchMap.set(key, entry);
  }
  const batches = [...batchMap.entries()]
    .map(([batch_number, v]) => ({ batch_number, ...v }))
    .filter((b) => b.remaining > 0)
    .sort((a, b) => {
      if (a.expiry && b.expiry) return a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : 0;
      if (a.expiry) return -1;
      if (b.expiry) return 1;
      return 0;
    });

  let remainingToDeduct = quantity;
  const ledgerRows: { drug_id: string; quantity_received: number; adjustment_reason: string; received_by: string | undefined; batch_number?: string }[] = [];
  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;
    const take = Math.min(batch.remaining, remainingToDeduct);
    ledgerRows.push({ drug_id: drugId, quantity_received: -take, adjustment_reason: reason, received_by: dispensedBy, batch_number: batch.batch_number });
    remainingToDeduct -= take;
  }
  if (remainingToDeduct > 0) {
    ledgerRows.push({ drug_id: drugId, quantity_received: -remainingToDeduct, adjustment_reason: reason, received_by: dispensedBy });
  }

  const { error: ledgerError } = await supabase.from('stock_receipts').insert(ledgerRows);
  if (ledgerError) return { error: `Stock updated, but the ledger entry failed: ${ledgerError.message}` };

  return { error: null };
}

/** Reverses a dispense: credits the quantity back to the aggregate pool and
 * logs a positive ledger row, so undoing a mistaken "Mark dispensed" leaves
 * an honest audit trail instead of quietly deleting what happened. */
export async function creditDrugStock(
  drugId: string | null,
  quantity: number,
  reason: string,
  creditedBy: string | undefined
): Promise<{ error: string | null }> {
  if (!drugId || quantity <= 0) return { error: null };

  const { data: drug, error: drugError } = await supabase.from('drugs').select('stock_qty').eq('id', drugId).single();
  if (drugError) return { error: `Couldn't check stock: ${drugError.message}` };

  const { error: stockError } = await supabase.from('drugs').update({ stock_qty: (drug?.stock_qty ?? 0) + quantity }).eq('id', drugId);
  if (stockError) return { error: `Couldn't update stock: ${stockError.message}` };

  const { error: ledgerError } = await supabase.from('stock_receipts').insert({
    drug_id: drugId, quantity_received: quantity, adjustment_reason: reason, received_by: creditedBy,
  });
  if (ledgerError) return { error: `Stock updated, but the ledger entry failed: ${ledgerError.message}` };

  return { error: null };
}
