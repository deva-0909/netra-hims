-- Cornea Clinic — closes a P1 gap from the audit report (structured
-- keratoconus workflow, contact lens management). Neither existed
-- anywhere before; topography and dry-eye assessment were already
-- captured under the LASIK module (corneal_topography,
-- dry_eye_assessments) and are now shared with this new clinic rather
-- than duplicated.

create table keratoconus_assessments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  stage_od text check (stage_od in ('stage_1', 'stage_2', 'stage_3', 'stage_4')),
  stage_os text check (stage_os in ('stage_1', 'stage_2', 'stage_3', 'stage_4')),
  kmax_od numeric(5,2),
  kmax_os numeric(5,2),
  thinnest_pachymetry_od numeric(6,1),
  thinnest_pachymetry_os numeric(6,1),
  documented_progression boolean not null default false,
  management_plan text check (management_plan in ('observation', 'corneal_cross_linking', 'ick_ring_segments', 'contact_lens', 'keratoplasty_referral')),
  notes text,
  assessed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table contact_lens_fittings (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  eye text check (eye in ('od', 'os', 'both')),
  lens_type text check (lens_type in ('soft_spherical', 'soft_toric', 'rgp', 'scleral', 'hybrid', 'orthokeratology')),
  base_curve text,
  diameter text,
  power text,
  fitting_status text not null default 'trial' check (fitting_status in ('trial', 'dispensed', 'follow_up_needed', 'discontinued')),
  supplier text,
  next_review_date date,
  notes text,
  fitted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index keratoconus_assessments_visit_id_idx on keratoconus_assessments(visit_id);
create index contact_lens_fittings_visit_id_idx on contact_lens_fittings(visit_id);

alter table keratoconus_assessments enable row level security;
alter table contact_lens_fittings enable row level security;

-- Mirrors corneal_topography/dry_eye_assessments exactly (doctor + optometrist).
create policy "keratoconus_assessments_select" on keratoconus_assessments for select to authenticated using (is_staff());
create policy "keratoconus_assessments_insert" on keratoconus_assessments for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "keratoconus_assessments_update" on keratoconus_assessments for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "keratoconus_assessments_delete" on keratoconus_assessments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create policy "contact_lens_fittings_select" on contact_lens_fittings for select to authenticated using (is_staff());
create policy "contact_lens_fittings_insert" on contact_lens_fittings for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "contact_lens_fittings_update" on contact_lens_fittings for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "contact_lens_fittings_delete" on contact_lens_fittings for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_keratoconus_assessments after insert or update or delete on keratoconus_assessments for each row execute function log_audit_event();
create trigger audit_contact_lens_fittings after insert or update or delete on contact_lens_fittings for each row execute function log_audit_event();

insert into consultation_fees (clinic_module, fee) values ('cornea', 700);
