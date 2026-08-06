-- ============================================================
-- NETRA HIMS — store_keeper needs write access to receive drug/eyewear stock
--
-- Discovered via RLS testing while wiring PO receiving to actually update
-- drug/eyewear stock: store_keeper is the only role that can receive a PO
-- (purchase_orders_update), but drugs/stock_receipts and
-- eyewear_items/eyewear_stock_receipts were pharmacist/optical-only.
-- Receiving a drug or eyewear line item would have failed RLS outright.
-- ============================================================

drop policy drugs_insert on drugs;
create policy drugs_insert on drugs for insert with check (has_role(variadic array['pharmacist','store_keeper']::staff_role[]));

drop policy drugs_update on drugs;
create policy drugs_update on drugs for update using (has_role(variadic array['pharmacist','store_keeper']::staff_role[])) with check (has_role(variadic array['pharmacist','store_keeper']::staff_role[]));

drop policy stock_receipts_insert on stock_receipts;
create policy stock_receipts_insert on stock_receipts for insert with check (has_role(variadic array['pharmacist','store_keeper']::staff_role[]));

drop policy eyewear_items_insert on eyewear_items;
create policy eyewear_items_insert on eyewear_items for insert with check (has_role(variadic array['optical','store_keeper']::staff_role[]));

drop policy eyewear_items_update on eyewear_items;
create policy eyewear_items_update on eyewear_items for update using (has_role(variadic array['optical','store_keeper']::staff_role[])) with check (has_role(variadic array['optical','store_keeper']::staff_role[]));

drop policy eyewear_stock_receipts_insert on eyewear_stock_receipts;
create policy eyewear_stock_receipts_insert on eyewear_stock_receipts for insert with check (has_role(variadic array['optical','store_keeper']::staff_role[]));
