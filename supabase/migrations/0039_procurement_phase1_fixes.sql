-- ============================================================
-- NETRA HIMS — Procurement & Stores deep-audit fixes
--
-- Found via a full read of ProcurementStoresPage.tsx against its own
-- schema: "receive shipments here to update stock automatically" was
-- false for every real PO (stores_item_id was never set by any UI
-- path), pharmacy/optical POs never touched actual drug/eyewear stock,
-- requisition approve/reject never recorded who decided, stock could
-- go negative, "cancelled" was a dead status, and one role
-- (store_keeper) could approve its own requisitions, issue the PO, and
-- record the vendor payment with no second sign-off at any value.
-- ============================================================

-- Stock floor guardrail — previously client-side JS only.
alter table general_stores_inventory add constraint general_stores_inventory_stock_qty_nonnegative check (stock_qty >= 0);

-- PO cancellation, with a required reason (mirrors refund/discard/disposal/exit reason pattern).
alter table purchase_orders add column cancelled_by uuid references profiles(id);
alter table purchase_orders add column cancelled_at timestamptz;
alter table purchase_orders add column cancel_reason text;
alter table purchase_orders add constraint purchase_orders_cancel_requires_reason
  check (status <> 'cancelled' or cancel_reason is not null);

-- Generalize PO line items so receiving can actually update drug/eyewear/general-store
-- stock (previously stores_item_id was never set by any UI path — dead code).
alter table purchase_order_items add column item_type text not null default 'general_store'
  check (item_type in ('general_store','drug','eyewear','other'));
alter table purchase_order_items add column drug_id uuid references drugs(id);
alter table purchase_order_items add column eyewear_item_id uuid references eyewear_items(id);
alter table purchase_order_items add constraint purchase_order_items_item_ref_matches_type check (
  (item_type = 'general_store' and drug_id is null and eyewear_item_id is null) or
  (item_type = 'drug' and stores_item_id is null and eyewear_item_id is null) or
  (item_type = 'eyewear' and stores_item_id is null and drug_id is null) or
  (item_type = 'other' and stores_item_id is null and drug_id is null and eyewear_item_id is null)
);

-- GST on line items.
alter table purchase_order_items add column tax_percent numeric not null default 0;

-- Requisition rejection reason (approved_by wiring is a code fix, no schema change needed).
alter table purchase_requisitions add column rejection_reason text;

-- Requisition consolidation: many-to-many PO <-> requisition linking.
create table po_requisition_links (
  po_id uuid not null references purchase_orders(id) on delete cascade,
  requisition_id uuid not null references purchase_requisitions(id) on delete cascade,
  primary key (po_id, requisition_id)
);
alter table po_requisition_links enable row level security;
create policy po_requisition_links_select on po_requisition_links for select using (is_staff());
create policy po_requisition_links_insert on po_requisition_links for insert with check (has_role(variadic array['store_keeper']::staff_role[]));
create policy po_requisition_links_delete on po_requisition_links for delete using (has_role(variadic array[]::staff_role[]));

-- Segregation of duties: issuing a PO at/above the threshold requires admin,
-- enforced at the database (mirrors the CSSD "release requires a passing BI" gate).
create or replace function public.enforce_po_issue_threshold()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  po_total numeric;
  threshold numeric := 50000;
begin
  if new.status = 'issued' and old.status = 'draft' then
    select coalesce(sum(quantity * coalesce(unit_price,0) * (1 + coalesce(tax_percent,0)/100)), 0)
    into po_total
    from purchase_order_items where po_id = new.id;

    if po_total >= threshold and not has_role(variadic array[]::staff_role[]) then
      raise exception 'Purchase orders of ₹% or more require admin approval to issue (this PO totals ₹%).', threshold, po_total;
    end if;
  end if;
  return new;
end;
$function$;

create trigger trg_enforce_po_issue_threshold
before update on purchase_orders
for each row execute function enforce_po_issue_threshold();

-- General stores write-off — unified into the existing movement log
-- (stock_issue_notes) rather than dishonestly recording a loss as an "issue".
alter table stock_issue_notes alter column department drop not null;
alter table stock_issue_notes add column is_writeoff boolean not null default false;
alter table stock_issue_notes add column adjustment_reason text;
alter table stock_issue_notes add constraint stock_issue_notes_writeoff_requires_reason
  check (is_writeoff = false or adjustment_reason is not null);
alter table stock_issue_notes add constraint stock_issue_notes_department_or_writeoff
  check (is_writeoff = true or department is not null);
