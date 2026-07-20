create table pediatric_vision_screenings (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  method text check (method in ('fix_and_follow', 'allen_cards', 'lea_symbols', 'snellen', 'teller_acuity_cards', 'other')),
  uncorrected_va_od text,
  uncorrected_va_os text,
  cooperation_level text check (cooperation_level in ('good', 'fair', 'poor')),
  red_reflex_normal boolean,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table pediatric_vision_screenings enable row level security;
create policy "pediatric_vision_screenings_select" on pediatric_vision_screenings for select to authenticated using (is_staff());
create policy "pediatric_vision_screenings_insert" on pediatric_vision_screenings for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "pediatric_vision_screenings_update" on pediatric_vision_screenings for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "pediatric_vision_screenings_delete" on pediatric_vision_screenings for delete to authenticated using (has_role(variadic array[]::staff_role[]));
