-- ============================================================
-- NETRA HIMS — IPD doctor <-> pharmacy communication
--
-- OPD already had a real channel: prescriptions -> pharmacy_dispenses ->
-- the Pharmacy queue. IPD's eMAR (ipd_medication_orders, added earlier
-- this session) was a dead end — nothing surfaced an inpatient order to
-- pharmacy at all. Gives IPD orders the same catalog link + dispense
-- acknowledgment OPD prescriptions already have.
-- ============================================================

alter table ipd_medication_orders add column drug_id uuid references drugs(id);
alter table ipd_medication_orders add column dispensed_to_ward boolean not null default false;
alter table ipd_medication_orders add column dispensed_by uuid references profiles(id);
alter table ipd_medication_orders add column dispensed_at timestamptz;

drop policy ipd_medication_orders_update on ipd_medication_orders;
create policy ipd_medication_orders_update on ipd_medication_orders for update
  using (has_role(variadic array['doctor','pharmacist']::staff_role[]))
  with check (has_role(variadic array['doctor','pharmacist']::staff_role[]));
