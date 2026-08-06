-- ============================================================
-- NETRA HIMS — reception needs billing rights to collect the consultation fee
--
-- Discovered via RLS testing: bills/bill_items/payment_transactions
-- insert/update was billing-role-only, but reception is who runs "Start a
-- new visit" and appointment check-in — where the consultation fee is now
-- collected before token issuance (0042_opd_consultation_fee_gate.sql).
-- ============================================================

drop policy bills_insert on bills;
create policy bills_insert on bills for insert with check (has_role(variadic array['billing','reception']::staff_role[]));

drop policy bill_items_insert on bill_items;
create policy bill_items_insert on bill_items for insert with check (has_role(variadic array['billing','reception']::staff_role[]));

drop policy payment_transactions_insert on payment_transactions;
create policy payment_transactions_insert on payment_transactions for insert with check (has_role(variadic array['billing','reception']::staff_role[]));

drop policy bills_update on bills;
create policy bills_update on bills for update
  using (has_role(variadic array['billing','reception']::staff_role[]))
  with check (has_role(variadic array['billing','reception']::staff_role[]));
