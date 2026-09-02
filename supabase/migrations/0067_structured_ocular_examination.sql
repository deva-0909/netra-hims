-- Structured ocular examination — closes a gap from the comprehensive
-- audit report (section 4.4, Ophthalmology EMR): pupils, RAPD, EOM/
-- motility, colour vision and lacrimal exam had no field anywhere in the
-- app. Anterior/posterior segment findings already exist as free-text on
-- `consultations` — left as-is (rich free text is the right shape for a
-- slit-lamp narrative; this migration only adds the findings that were
-- entirely missing, not fields already present in a workable form).
--
-- Mirrors vision_tests/iop_readings exactly: same insert/update roles
-- (optometrist, doctor), same broad staff read, same visit_id/
-- performed_by shape, so it slots into the General OPD journey the same
-- way those stages already do.

create table ocular_examinations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id),
  pupils_od text,
  pupils_os text,
  rapd text check (rapd in ('absent', 'present_od', 'present_os')),
  eom_od text,
  eom_os text,
  color_vision_od text,
  color_vision_os text,
  lacrimal_od text,
  lacrimal_os text,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index ocular_examinations_visit_id_idx on ocular_examinations(visit_id);

alter table ocular_examinations enable row level security;

create policy "ocular_examinations_select" on ocular_examinations for select to authenticated using (is_staff());
create policy "ocular_examinations_insert" on ocular_examinations for insert to authenticated with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "ocular_examinations_update" on ocular_examinations for update to authenticated using (has_role('optometrist'::staff_role, 'doctor'::staff_role)) with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "ocular_examinations_delete" on ocular_examinations for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_ocular_examinations after insert or update or delete on ocular_examinations for each row execute function log_audit_event();
