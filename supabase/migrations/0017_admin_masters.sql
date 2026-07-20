-- ============================================================
-- Admin Masters: Hospital Settings, Departments, and admin-editable
-- reference lists (insurance schemes, investigation tests) -- closing
-- the gap identified against the design spec's "Admin & Masters" section.
-- ============================================================

create table hospital_settings (
  id uuid primary key default gen_random_uuid(),
  hospital_name text not null default 'Netra Eye Hospital',
  tagline text default '360 Degree Eye Hospital',
  address text,
  phone text,
  email text,
  working_hours text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
insert into hospital_settings (hospital_name, tagline) values ('Netra Eye Hospital', '360 Degree Eye Hospital');

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true
);
insert into departments (name, description) values
('General OPD', 'General ophthalmology outpatient department'),
('Retina', 'Medical and surgical retina services'),
('Glaucoma', 'Glaucoma diagnosis and management'),
('LASIK / Refractive', 'Refractive surgery services'),
('Pediatric Ophthalmology', 'Eye care for children'),
('Pharmacy', 'In-house pharmacy'),
('Optical', 'Optical shop and dispensing'),
('Administration', 'Hospital administration');

alter table profiles add column department_id uuid references departments(id);

create table insurance_masters (
  id uuid primary key default gen_random_uuid(),
  scheme_name text not null unique,
  scheme_type text default 'private' check (scheme_type in ('private', 'government', 'corporate')),
  active boolean not null default true
);
insert into insurance_masters (scheme_name, scheme_type) values
('Star Health', 'private'), ('HDFC Ergo', 'private'), ('ICICI Lombard', 'private'),
('Bajaj Allianz', 'private'), ('Care Health', 'private'), ('Niva Bupa', 'private'),
('Ayushman Bharat / PMJAY', 'government'), ('State Government Scheme', 'government'),
('Self-pay / No insurance', 'private');

create table investigation_masters (
  id uuid primary key default gen_random_uuid(),
  test_name text not null unique,
  category text,
  active boolean not null default true
);
insert into investigation_masters (test_name, category) values
('Fasting Blood Sugar', 'lab'), ('HbA1c', 'lab'), ('ECG', 'cardiac'), ('CBC', 'lab'),
('Serum Creatinine', 'lab'), ('Chest X-Ray', 'imaging'), ('Urine Routine', 'lab'),
('Coagulation Profile', 'lab'), ('Liver Function Test', 'lab');

create table communication_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  subject text,
  body text not null,
  active boolean not null default true,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
insert into communication_templates (name, channel, subject, body) values
('Appointment Reminder', 'sms', null, 'Dear {patient_name}, this is a reminder for your appointment at Netra Eye Hospital on {appointment_date} at {appointment_time}. Token: {token_number}.'),
('Appointment Reminder', 'whatsapp', null, 'Hi {patient_name}, your appointment at Netra Eye Hospital is confirmed for {appointment_date} at {appointment_time}.'),
('Report Ready', 'sms', null, 'Dear {patient_name}, your investigation report is ready for collection at Netra Eye Hospital.'),
('Bill Receipt', 'email', 'Your Netra Eye Hospital Invoice {bill_number}', 'Dear {patient_name}, please find attached your invoice {bill_number} for Rs. {total_amount}. Thank you for choosing Netra Eye Hospital.');

alter table hospital_settings enable row level security;
create policy "hospital_settings_select" on hospital_settings for select to authenticated using (is_staff());
create policy "hospital_settings_update" on hospital_settings for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));

alter table departments enable row level security;
create policy "departments_select" on departments for select to authenticated using (is_staff());
create policy "departments_insert" on departments for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "departments_update" on departments for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "departments_delete" on departments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table insurance_masters enable row level security;
create policy "insurance_masters_select" on insurance_masters for select to authenticated using (is_staff());
create policy "insurance_masters_insert" on insurance_masters for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "insurance_masters_update" on insurance_masters for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "insurance_masters_delete" on insurance_masters for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table investigation_masters enable row level security;
create policy "investigation_masters_select" on investigation_masters for select to authenticated using (is_staff());
create policy "investigation_masters_insert" on investigation_masters for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "investigation_masters_update" on investigation_masters for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "investigation_masters_delete" on investigation_masters for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table communication_templates enable row level security;
create policy "communication_templates_select" on communication_templates for select to authenticated using (is_staff());
create policy "communication_templates_insert" on communication_templates for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "communication_templates_update" on communication_templates for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "communication_templates_delete" on communication_templates for delete to authenticated using (has_role(variadic array[]::staff_role[]));
