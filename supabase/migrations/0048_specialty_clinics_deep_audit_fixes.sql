-- ============================================================
-- NETRA HIMS — specialty clinic deep-dive audit fixes
--
-- 1. Glaucoma's own stage was literally labeled "IOP & Gonioscopy" but
--    gonioscopy_records has zero IOP columns — glaucoma management is
--    fundamentally IOP-trend-driven, and a follow-up visit booked directly
--    into this clinic had nowhere to record it. LASIK had no manifest/
--    cycloplegic refraction fields anywhere in its own stages either.
--    Retina had no visual acuity field. Fixed in the app by reusing the
--    existing vision_test/refraction/iop_readings stages (same table, same
--    RLS) across the modules that were missing them — no schema change
--    needed for that part.
--
-- 2. Recall dates were being captured and then never surfaced anywhere:
--    glaucoma_plans.next_review_date, injection_records.next_dose_due, and
--    parent_followups.next_review_date each just sat in their own table.
--    These triggers sync all three into the same follow_ups table/RLS that
--    already powers the Follow-ups Due dashboard, so a glaucoma review, a
--    retina injection recall, and a pediatric patching review all show up
--    in the one place staff actually look.
--
-- 3. Pediatric patching compliance was prescribed once (patching_hours_per_
--    day at diagnosis) with only a free-text note at follow-up — no
--    structured actual-vs-prescribed tracking.
-- ============================================================

alter table parent_followups add column actual_patching_hours_per_day numeric(4,1);

create or replace function sync_glaucoma_plan_followup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
begin
  if new.next_review_date is null then
    return new;
  end if;
  select patient_id into v_patient_id from visits where id = new.visit_id;
  if v_patient_id is null then
    return new;
  end if;
  if exists (select 1 from follow_ups where visit_id = new.visit_id and reason = 'Glaucoma review') then
    update follow_ups set due_date = new.next_review_date, status = 'pending'
    where visit_id = new.visit_id and reason = 'Glaucoma review';
  else
    insert into follow_ups (visit_id, patient_id, due_date, reason, status)
    values (new.visit_id, v_patient_id, new.next_review_date, 'Glaucoma review', 'pending');
  end if;
  return new;
end;
$function$;

create trigger trg_sync_glaucoma_plan_followup
after insert or update on glaucoma_plans
for each row execute function sync_glaucoma_plan_followup();

create or replace function sync_injection_followup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
begin
  if new.next_dose_due is null then
    return new;
  end if;
  select patient_id into v_patient_id from visits where id = new.visit_id;
  if v_patient_id is null then
    return new;
  end if;
  if exists (select 1 from follow_ups where visit_id = new.visit_id and reason = 'Retina injection') then
    update follow_ups set due_date = new.next_dose_due, status = 'pending'
    where visit_id = new.visit_id and reason = 'Retina injection';
  else
    insert into follow_ups (visit_id, patient_id, due_date, reason, status)
    values (new.visit_id, v_patient_id, new.next_dose_due, 'Retina injection', 'pending');
  end if;
  return new;
end;
$function$;

create trigger trg_sync_injection_followup
after insert or update on injection_records
for each row execute function sync_injection_followup();

create or replace function sync_parent_followup_followup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.next_review_date is null then
    return new;
  end if;
  if new.visit_id is not null and exists (select 1 from follow_ups where visit_id = new.visit_id and reason = 'Pediatric review') then
    update follow_ups set due_date = new.next_review_date, status = 'pending'
    where visit_id = new.visit_id and reason = 'Pediatric review';
  else
    insert into follow_ups (visit_id, patient_id, due_date, reason, status)
    values (new.visit_id, new.patient_id, new.next_review_date, 'Pediatric review', 'pending');
  end if;
  return new;
end;
$function$;

create trigger trg_sync_parent_followup_followup
after insert or update on parent_followups
for each row execute function sync_parent_followup_followup();
