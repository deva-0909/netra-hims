create table clinical_diagrams (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  diagram_type text not null check (diagram_type in ('fundus', 'anterior_segment', 'optic_disc', 'ocular_motility')),
  eye text not null check (eye in ('od', 'os', 'both')),
  image_url text not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table clinical_diagrams enable row level security;
create policy "clinical_diagrams_select" on clinical_diagrams for select to authenticated using (is_staff());
create policy "clinical_diagrams_insert" on clinical_diagrams for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "clinical_diagrams_delete" on clinical_diagrams for delete to authenticated using (has_role(variadic array[]::staff_role[]));
