-- ============================================================
-- NETRA HIMS — Pharmacy / Pharmacy Inventory / Patients deep-dive audit fixes
--
-- 1. Backfill: stock_receipts and eyewear_stock_receipts already have the
--    adjustment_reason column and relaxed quantity constraint live on this
--    project (applied directly in an earlier session), but the migration
--    file that did it was never committed — rebuilding this database from
--    the migrations in this repo would silently break both inventory
--    write-off features. Written idempotently since it's backfilling state
--    that already exists live.
--
-- 2. Patient merge: even with the phone-based duplicate warning at
--    registration, a genuine duplicate can still get created (different
--    phone number, a relative registering on the patient's behalf). Once
--    it exists there was no way to reconcile it — permanently fragmenting
--    that patient's history across two UHIDs. merge_patients() reassigns
--    every table with a patient_id foreign key atomically and tags the
--    absorbed record with merged_into, gated to admin only regardless of
--    the caller's own table-level RLS (the whole point of a real merge is
--    that no partial-failure state should ever be visible).
-- ============================================================

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'stock_receipts' and column_name = 'adjustment_reason') then
    alter table stock_receipts add column adjustment_reason text;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_receipts_quantity_not_zero') then
    alter table stock_receipts drop constraint if exists stock_receipts_quantity_received_check;
    alter table stock_receipts add constraint stock_receipts_quantity_not_zero check (quantity_received <> 0);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_receipts_writeoff_needs_reason') then
    alter table stock_receipts add constraint stock_receipts_writeoff_needs_reason check (quantity_received > 0 or adjustment_reason is not null);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'eyewear_stock_receipts' and column_name = 'adjustment_reason') then
    alter table eyewear_stock_receipts add column adjustment_reason text;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eyewear_stock_receipts_quantity_not_zero') then
    alter table eyewear_stock_receipts drop constraint if exists eyewear_stock_receipts_quantity_received_check;
    alter table eyewear_stock_receipts add constraint eyewear_stock_receipts_quantity_not_zero check (quantity_received <> 0);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eyewear_stock_receipts_writeoff_needs_reason') then
    alter table eyewear_stock_receipts add constraint eyewear_stock_receipts_writeoff_needs_reason check (quantity_received > 0 or adjustment_reason is not null);
  end if;
end $$;

-- ---------- Patient merge ----------
alter table patients add column merged_into uuid references patients(id);

create or replace function merge_patients(p_source_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role(variadic array[]::staff_role[]) then
    raise exception 'Only an admin can merge patient records.';
  end if;
  if p_source_id = p_target_id then
    raise exception 'Cannot merge a patient into itself.';
  end if;
  if exists (select 1 from patients where id = p_source_id and merged_into is not null) then
    raise exception 'Source patient has already been merged.';
  end if;
  if not exists (select 1 from patients where id = p_target_id) then
    raise exception 'Target patient not found.';
  end if;

  update appointments set patient_id = p_target_id where patient_id = p_source_id;
  update bills set patient_id = p_target_id where patient_id = p_source_id;
  update camp_screenings set linked_patient_id = p_target_id where linked_patient_id = p_source_id;
  update clinical_diagrams set patient_id = p_target_id where patient_id = p_source_id;
  update communication_log set patient_id = p_target_id where patient_id = p_source_id;
  update deposits set patient_id = p_target_id where patient_id = p_source_id;
  update eye_bank_tissues set allocated_to_patient_id = p_target_id where allocated_to_patient_id = p_source_id;
  update feedback set patient_id = p_target_id where patient_id = p_source_id;
  update follow_ups set patient_id = p_target_id where patient_id = p_source_id;
  update incident_reports set patient_id = p_target_id where patient_id = p_source_id;
  update insurance_claims set patient_id = p_target_id where patient_id = p_source_id;
  update mlc_cases set patient_id = p_target_id where patient_id = p_source_id;
  update optical_orders set patient_id = p_target_id where patient_id = p_source_id;
  update parent_followups set patient_id = p_target_id where patient_id = p_source_id;
  update patient_grievances set patient_id = p_target_id where patient_id = p_source_id;
  update record_requests set patient_id = p_target_id where patient_id = p_source_id;
  update visits set patient_id = p_target_id where patient_id = p_source_id;

  update patients set merged_into = p_target_id where id = p_source_id;
end;
$function$;

grant execute on function merge_patients(uuid, uuid) to authenticated;

-- deductDrugStock() now logs every dispense to stock_receipts, called from
-- InjectionStage.tsx (doctor/nurse recording a retina intravitreal
-- injection), not just the pharmacist-only dispensing queue.
drop policy stock_receipts_insert on stock_receipts;
create policy "stock_receipts_insert" on stock_receipts for insert to authenticated
  with check (has_role(variadic array['pharmacist','store_keeper','doctor','nurse']::staff_role[]));
