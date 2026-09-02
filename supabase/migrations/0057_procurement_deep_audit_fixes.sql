-- Procurement/Stores deep-dive (store_keeper persona):
-- 1. A store_keeper could approve their own requisition — no second-signoff
--    check anywhere, unlike the >=Rs50,000 PO-issue threshold this module
--    already enforces. Block approving/rejecting your own requisition.
-- 2. received_quantity had no server-side bound — only client-side JS kept
--    it within [0, quantity], the same class of gap the earlier
--    general_stores_inventory_stock_qty_nonnegative fix addressed for the
--    stock floor.

create or replace function enforce_requisition_no_self_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
    if new.approved_by is not null and new.approved_by = new.requested_by then
      raise exception 'A requisition cannot be approved or rejected by the same person who requested it.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_requisition_no_self_approval on purchase_requisitions;
create trigger trg_enforce_requisition_no_self_approval
before update on purchase_requisitions
for each row execute function enforce_requisition_no_self_approval();

alter table purchase_order_items add constraint purchase_order_items_received_quantity_bounded
  check (received_quantity >= 0 and received_quantity <= quantity);
