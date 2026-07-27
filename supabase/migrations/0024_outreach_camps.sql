create table outreach_camps (
  id uuid primary key default gen_random_uuid(),
  camp_name text not null,
  location text,
  camp_date date,
  organized_by text,
  notes text,
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table camp_screenings (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references outreach_camps(id) on delete cascade,
  person_name text not null,
  age int,
  gender text check (gender in ('male', 'female', 'other')),
  contact_phone text,
  village_or_area text,
  screening_findings text,
  referred_to_hospital boolean not null default false,
  linked_patient_id uuid references patients(id),
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table outreach_camps enable row level security;
create policy "outreach_camps_select" on outreach_camps for select to authenticated using (is_staff());
create policy "outreach_camps_insert" on outreach_camps for insert to authenticated with check (has_role('reception'::staff_role));
create policy "outreach_camps_update" on outreach_camps for update to authenticated using (has_role('reception'::staff_role)) with check (has_role('reception'::staff_role));
create policy "outreach_camps_delete" on outreach_camps for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table camp_screenings enable row level security;
create policy "camp_screenings_select" on camp_screenings for select to authenticated using (is_staff());
create policy "camp_screenings_insert" on camp_screenings for insert to authenticated with check (has_role('reception'::staff_role));
create policy "camp_screenings_update" on camp_screenings for update to authenticated using (has_role('reception'::staff_role)) with check (has_role('reception'::staff_role));
create policy "camp_screenings_delete" on camp_screenings for delete to authenticated using (has_role(variadic array[]::staff_role[]));
