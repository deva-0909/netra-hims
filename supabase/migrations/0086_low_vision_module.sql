-- Low Vision Clinic — closes the last P2 new-module gap from the audit
-- report (entirely missing module). Functional vision assessment and
-- low-vision aid prescribing/dispensing/training had nowhere to go
-- before — this is rehabilitation, not a refractive correction, so it
-- doesn't fit the LASIK/general refraction stages.

create table low_vision_assessments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  distance_va_od text,
  distance_va_os text,
  near_va_od text,
  near_va_os text,
  contrast_sensitivity text,
  visual_field_extent text,
  functional_goals text,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table low_vision_aids (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  device_type text check (device_type in ('magnifier', 'telescope', 'electronic_video_magnifier', 'prism', 'large_print', 'screen_reader', 'other')),
  device_details text,
  magnification_power text,
  trial_outcome text,
  dispensed boolean not null default false,
  training_provided boolean not null default false,
  next_review_date date,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index low_vision_assessments_visit_id_idx on low_vision_assessments(visit_id);
create index low_vision_aids_visit_id_idx on low_vision_aids(visit_id);

alter table low_vision_assessments enable row level security;
alter table low_vision_aids enable row level security;

-- Mirrors corneal_topography/dry_eye_assessments exactly (doctor + optometrist)
-- — functional/rehab assessment and aid fitting are both pretesting-adjacent
-- tasks, not doctor-only clinical decisions.
create policy "low_vision_assessments_select" on low_vision_assessments for select to authenticated using (is_staff());
create policy "low_vision_assessments_insert" on low_vision_assessments for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "low_vision_assessments_update" on low_vision_assessments for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "low_vision_assessments_delete" on low_vision_assessments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create policy "low_vision_aids_select" on low_vision_aids for select to authenticated using (is_staff());
create policy "low_vision_aids_insert" on low_vision_aids for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "low_vision_aids_update" on low_vision_aids for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "low_vision_aids_delete" on low_vision_aids for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_low_vision_assessments after insert or update or delete on low_vision_assessments for each row execute function log_audit_event();
create trigger audit_low_vision_aids after insert or update or delete on low_vision_aids for each row execute function log_audit_event();

insert into consultation_fees (clinic_module, fee) values ('low_vision', 600);
