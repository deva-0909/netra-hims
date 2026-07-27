create table eye_bank_donors (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  age int,
  gender text check (gender in ('male', 'female', 'other')),
  cause_of_death text,
  date_of_death timestamptz,
  next_of_kin_name text,
  next_of_kin_contact text,
  consent_obtained boolean not null default false,
  consent_document_url text,
  registered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table eye_bank_tissues (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references eye_bank_donors(id) on delete cascade,
  tissue_number text not null unique,
  eye text not null check (eye in ('od', 'os', 'both')),
  retrieval_datetime timestamptz,
  retrieved_by uuid references profiles(id),
  preservation_method text check (preservation_method in ('mccarey_kaufman', 'optisol_gs', 'cryopreservation', 'other')),
  serology_hiv text check (serology_hiv in ('pending', 'non_reactive', 'reactive')) default 'pending',
  serology_hbsag text check (serology_hbsag in ('pending', 'non_reactive', 'reactive')) default 'pending',
  serology_hcv text check (serology_hcv in ('pending', 'non_reactive', 'reactive')) default 'pending',
  tissue_quality_grade text,
  expiry_date date,
  status text not null default 'available' check (status in ('available', 'allocated', 'used', 'discarded', 'expired')),
  allocated_to_patient_id uuid references patients(id),
  allocated_to_visit_id uuid references visits(id),
  allocated_date timestamptz,
  discard_reason text,
  created_at timestamptz not null default now()
);

alter table eye_bank_donors enable row level security;
create policy "eye_bank_donors_select" on eye_bank_donors for select to authenticated using (is_staff());
create policy "eye_bank_donors_insert" on eye_bank_donors for insert to authenticated with check (has_role('eye_bank'::staff_role));
create policy "eye_bank_donors_update" on eye_bank_donors for update to authenticated using (has_role('eye_bank'::staff_role)) with check (has_role('eye_bank'::staff_role));
create policy "eye_bank_donors_delete" on eye_bank_donors for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table eye_bank_tissues enable row level security;
create policy "eye_bank_tissues_select" on eye_bank_tissues for select to authenticated using (is_staff());
create policy "eye_bank_tissues_insert" on eye_bank_tissues for insert to authenticated with check (has_role('eye_bank'::staff_role));
create policy "eye_bank_tissues_update" on eye_bank_tissues for update to authenticated using (has_role('eye_bank'::staff_role, 'doctor'::staff_role)) with check (has_role('eye_bank'::staff_role, 'doctor'::staff_role));
create policy "eye_bank_tissues_delete" on eye_bank_tissues for delete to authenticated using (has_role(variadic array[]::staff_role[]));
