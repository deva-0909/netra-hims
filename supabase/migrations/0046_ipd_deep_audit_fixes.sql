-- ============================================================
-- NETRA HIMS — IPD deep-dive audit fixes
--
-- 1. Critical bug: admissions_discharge_requires_checklist (0038) only ever
--    got satisfied by IpdWardPage's DischargeChecklist. AdmissionStage.tsx's
--    own "Discharge patient" button (used when a patient is admitted straight
--    from a specialty-clinic visit) never set the two checklist flags, so
--    every discharge through that tab has been throwing a constraint
--    violation since Phase 1 shipped. Fixed in the app by making both
--    surfaces share one DischargeChecklist component — no DB change needed
--    for that part, but bills/bill_items need to accept writes from the
--    ward roles who actually run a discharge, for fix #2 below.
--
-- 2. Bed charges were entirely manual line-item entry — easy to forget a
--    day of stay. daily_rate on beds + an auto-posted "Bed charges" line
--    item at discharge time closes that gap. Posting it needs nurse/doctor/
--    ot_staff to be able to write bills/bill_items (previously billing/
--    reception only), same reasoning as the reception consultation-fee fix.
--
-- 3. No structured place for a doctor's daily ward-round note — ward_vitals
--    is nursing vitals only. ipd_progress_notes adds that.
-- ============================================================

alter table beds add column daily_rate numeric(10,2) not null default 0;

create table ipd_progress_notes (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id) on delete cascade,
  clinical_notes text not null,
  plan text,
  doctor_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_ipd_progress_notes_admission on ipd_progress_notes(admission_id);

alter table ipd_progress_notes enable row level security;
create policy ipd_progress_notes_select on ipd_progress_notes for select
  using (has_role(variadic array['reception','optometrist','doctor','nurse','ot_staff','mrd','billing','insurance_desk']::staff_role[]));
create policy ipd_progress_notes_insert on ipd_progress_notes for insert
  with check (has_role(variadic array['doctor']::staff_role[]));
create policy ipd_progress_notes_delete on ipd_progress_notes for delete
  using (has_role(variadic array[]::staff_role[]));

drop policy bills_insert on bills;
create policy bills_insert on bills for insert with check (has_role(variadic array['billing','reception','doctor','nurse','ot_staff']::staff_role[]));

drop policy bill_items_insert on bill_items;
create policy bill_items_insert on bill_items for insert with check (has_role(variadic array['billing','reception','doctor','nurse','ot_staff']::staff_role[]));

drop policy bills_update on bills;
create policy bills_update on bills for update
  using (has_role(variadic array['billing','reception','doctor','nurse','ot_staff']::staff_role[]))
  with check (has_role(variadic array['billing','reception','doctor','nurse','ot_staff']::staff_role[]));
