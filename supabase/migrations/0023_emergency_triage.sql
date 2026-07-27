alter table visits add column is_emergency boolean not null default false;
alter table visits add column triage_priority text check (triage_priority in ('critical', 'urgent', 'semi_urgent'));

create table emergency_triage_notes (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  chief_complaint text not null,
  onset_description text,
  priority text not null check (priority in ('critical', 'urgent', 'semi_urgent')),
  triaged_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table emergency_triage_notes enable row level security;
create policy "emergency_triage_notes_select" on emergency_triage_notes for select to authenticated using (is_staff());
create policy "emergency_triage_notes_insert" on emergency_triage_notes for insert to authenticated with check (has_role('reception'::staff_role, 'nurse'::staff_role, 'doctor'::staff_role, 'ot_staff'::staff_role));
create policy "emergency_triage_notes_delete" on emergency_triage_notes for delete to authenticated using (has_role(variadic array[]::staff_role[]));