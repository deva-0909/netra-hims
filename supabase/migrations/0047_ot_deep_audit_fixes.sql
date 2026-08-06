-- ============================================================
-- NETRA HIMS — OT module deep-dive audit fixes
--
-- 1. Scheduling: previously addOt() always inserted status='completed' with
--    start_time/end_time both = now(), even though the enum already
--    supports scheduled/in_progress — OT was 100% write-after-the-fact,
--    with no forward-looking list. No DB change needed for this part (it's
--    an app-logic fix), but the two safety gates below only make sense
--    once real state transitions exist.
--
-- 2. WHO Surgical Safety Checklist — the highest-risk moment in the
--    hospital had no structured check at all, unlike discharge (checklist
--    gate) or sterilization (BI-pass gate). Mirrors that exact pattern:
--    a DB trigger blocks the state transition until the relevant checklist
--    phase is confirmed.
--
-- 3. Surgical consent — LASIK has its own procedure-specific consent;
--    every other surgery only ever got the generic ward-admission consent
--    text. This gives every OT case its own consent record.
--
-- 4. Implant/IOL record — pre-op IOL power is calculated and stored
--    (imaging_records), but nothing recorded which lens was actually
--    implanted. Surgeons sometimes change the lens intraoperatively, and
--    lot-number traceability matters for recalls.
-- ============================================================

create table ot_safety_checklists (
  id uuid primary key default gen_random_uuid(),
  ot_record_id uuid not null unique references ot_records(id) on delete cascade,
  sign_in_identity_site_procedure_confirmed boolean not null default false,
  sign_in_consent_confirmed boolean not null default false,
  sign_in_site_marked boolean not null default false,
  sign_in_by uuid references profiles(id),
  sign_in_at timestamptz,
  time_out_team_introduced boolean not null default false,
  time_out_site_procedure_reconfirmed boolean not null default false,
  time_out_critical_events_reviewed boolean not null default false,
  time_out_by uuid references profiles(id),
  time_out_at timestamptz,
  sign_out_counts_correct boolean not null default false,
  sign_out_specimen_labeled boolean not null default false,
  sign_out_equipment_issues_noted boolean not null default false,
  sign_out_by uuid references profiles(id),
  sign_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_ot_safety_checklists_ot_record on ot_safety_checklists(ot_record_id);

create table surgical_consents (
  id uuid primary key default gen_random_uuid(),
  ot_record_id uuid not null unique references ot_records(id) on delete cascade,
  consent_text text not null,
  consent_signed boolean not null default false,
  consent_file_url text,
  witnessed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_surgical_consents_ot_record on surgical_consents(ot_record_id);

create table ot_implants (
  id uuid primary key default gen_random_uuid(),
  ot_record_id uuid not null references ot_records(id) on delete cascade,
  implant_type text not null default 'iol' check (implant_type in ('iol', 'other')),
  model_name text not null,
  power text,
  lot_number text,
  serial_number text,
  notes text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_ot_implants_ot_record on ot_implants(ot_record_id);

-- Mirrors admissions_discharge_requires_checklist / sterilization's
-- BI-pass gate: the state transition itself is blocked at the DB, not just
-- discouraged in the UI. Sign-in must be confirmed before anaesthesia/
-- incision (status -> in_progress); sign-out must be confirmed before the
-- team can leave OT (status -> completed).
create or replace function enforce_ot_safety_checklist()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'in_progress' and (old is null or old.status is distinct from 'in_progress') then
    if not exists (select 1 from ot_safety_checklists where ot_record_id = new.id and sign_in_at is not null) then
      raise exception 'Cannot start this OT case until the WHO Surgical Safety Checklist Sign-In phase is confirmed.';
    end if;
  end if;
  if new.status = 'completed' and (old is null or old.status is distinct from 'completed') then
    if not exists (select 1 from ot_safety_checklists where ot_record_id = new.id and sign_out_at is not null) then
      raise exception 'Cannot complete this OT record until the WHO Surgical Safety Checklist Sign-Out phase is confirmed.';
    end if;
  end if;
  return new;
end;
$function$;

create trigger trg_enforce_ot_safety_checklist
before insert or update on ot_records
for each row execute function enforce_ot_safety_checklist();

-- ---------- RLS ----------
-- Same write roles as ot_records/recovery_records (nurse/ot_staff/doctor);
-- reads stay staff-wide, consistent with the rest of the clinical record.
alter table ot_safety_checklists enable row level security;
create policy "ot_safety_checklists_select" on ot_safety_checklists for select to authenticated using (is_staff());
create policy "ot_safety_checklists_insert" on ot_safety_checklists for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "ot_safety_checklists_update" on ot_safety_checklists for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "ot_safety_checklists_delete" on ot_safety_checklists for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table surgical_consents enable row level security;
create policy "surgical_consents_select" on surgical_consents for select to authenticated using (is_staff());
create policy "surgical_consents_insert" on surgical_consents for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "surgical_consents_update" on surgical_consents for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "surgical_consents_delete" on surgical_consents for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table ot_implants enable row level security;
create policy "ot_implants_select" on ot_implants for select to authenticated using (is_staff());
create policy "ot_implants_insert" on ot_implants for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "ot_implants_update" on ot_implants for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "ot_implants_delete" on ot_implants for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_ot_safety_checklists after insert or update or delete on ot_safety_checklists
  for each row execute function log_audit_event();
create trigger audit_surgical_consents after insert or update or delete on surgical_consents
  for each row execute function log_audit_event();
