-- Doctor-POV deep-dive: follow_ups had no attribution column at all, so it
-- was impossible to tell which doctor scheduled a given follow-up or to
-- build a "my follow-ups due" worklist. Add it, and backfill it from the
-- existing auto-sync triggers (glaucoma/injection/pediatric review) using
-- each source table's own staff column.

alter table follow_ups add column created_by uuid references profiles(id);

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
    update follow_ups set due_date = new.next_review_date, status = 'pending', created_by = new.planned_by
    where visit_id = new.visit_id and reason = 'Glaucoma review';
  else
    insert into follow_ups (visit_id, patient_id, due_date, reason, status, created_by)
    values (new.visit_id, v_patient_id, new.next_review_date, 'Glaucoma review', 'pending', new.planned_by);
  end if;
  return new;
end;
$function$;

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
    update follow_ups set due_date = new.next_dose_due, status = 'pending', created_by = new.injected_by
    where visit_id = new.visit_id and reason = 'Retina injection';
  else
    insert into follow_ups (visit_id, patient_id, due_date, reason, status, created_by)
    values (new.visit_id, v_patient_id, new.next_dose_due, 'Retina injection', 'pending', new.injected_by);
  end if;
  return new;
end;
$function$;

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
    update follow_ups set due_date = new.next_review_date, status = 'pending', created_by = new.recorded_by
    where visit_id = new.visit_id and reason = 'Pediatric review';
  else
    insert into follow_ups (visit_id, patient_id, due_date, reason, status, created_by)
    values (new.visit_id, new.patient_id, new.next_review_date, 'Pediatric review', 'pending', new.recorded_by);
  end if;
  return new;
end;
$function$;
