create table beds (
  id uuid primary key default gen_random_uuid(),
  bed_number text not null unique,
  ward text,
  status text not null default 'available' check (status in ('available', 'occupied', 'maintenance'))
);

alter table admissions add column bed_id uuid references beds(id);

alter table beds enable row level security;
create policy "beds_select" on beds for select to authenticated using (is_staff());
create policy "beds_insert" on beds for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role));
create policy "beds_update" on beds for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role));
create policy "beds_delete" on beds for delete to authenticated using (has_role(variadic array[]::staff_role[]));

insert into beds (bed_number, ward, status) values
('B-01','General Ward','available'),('B-02','General Ward','available'),('B-03','General Ward','available'),
('B-04','General Ward','available'),('B-05','General Ward','available'),
('B-11','Post-Op Recovery','available'),('B-12','Post-Op Recovery','available'),('B-13','Post-Op Recovery','available');

create table ward_vitals (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id) on delete cascade,
  blood_pressure text,
  pulse text,
  temperature text,
  spo2 text,
  notes text,
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);

alter table ward_vitals enable row level security;
create policy "ward_vitals_select" on ward_vitals for select to authenticated using (is_staff());
create policy "ward_vitals_insert" on ward_vitals for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "ward_vitals_delete" on ward_vitals for delete to authenticated using (has_role(variadic array[]::staff_role[]));
