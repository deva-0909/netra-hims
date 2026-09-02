-- Pre-op fitness clearance + anaesthesia workflow — closes a gap from the
-- audit report (section 4.14, OT & Surgery Management). anaesthetist_id
-- was already captured on ot_records, but nothing recorded ASA grade,
-- fitness-for-surgery, comorbidities, NPO confirmation, or the
-- anaesthesia type/notes actually planned for the case.

create table pre_op_assessments (
  id uuid primary key default gen_random_uuid(),
  ot_record_id uuid not null unique references ot_records(id) on delete cascade,
  asa_grade text check (asa_grade in ('I', 'II', 'III', 'IV', 'V')),
  fitness_status text not null default 'pending' check (fitness_status in ('pending', 'fit', 'fit_with_precautions', 'not_fit')),
  comorbidities text,
  npo_confirmed boolean not null default false,
  anaesthesia_type text check (anaesthesia_type in ('topical', 'local', 'peribulbar', 'retrobulbar', 'sedation', 'general')),
  anaesthesia_notes text,
  cleared_by uuid references profiles(id),
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);

alter table pre_op_assessments enable row level security;

create policy "pre_op_assessments_select" on pre_op_assessments for select to authenticated using (is_staff());
create policy "pre_op_assessments_insert" on pre_op_assessments for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "pre_op_assessments_update" on pre_op_assessments for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "pre_op_assessments_delete" on pre_op_assessments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_pre_op_assessments after insert or update or delete on pre_op_assessments for each row execute function log_audit_event();
