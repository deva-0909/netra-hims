-- ============================================================
-- NETRA HIMS — Core schema: staff profiles, patients, visits
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Roles ----------
create type staff_role as enum (
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff'
);

-- Staff profiles, one row per auth.users member
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role staff_role not null,
  department text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Patients ----------
create table patients (
  id uuid primary key default gen_random_uuid(),
  uhid text not null unique, -- Unique Health ID, e.g. NH-000001
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male','female','other')),
  phone text,
  email text,
  address text,
  guardian_name text,        -- for pediatric / guardian-assisted registration
  guardian_relation text,
  abha_id text,               -- Ayushman Bharat Health Account
  abha_verified boolean not null default false,
  golden_card_id text,        -- Ayushman Bharat / state scheme golden card
  golden_card_verified boolean not null default false,
  insurance_provider text,
  insurance_policy_no text,
  insurance_verified boolean not null default false,
  blood_group text,
  known_allergies text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_patients_uhid on patients(uhid);
create index idx_patients_phone on patients(phone);
create index idx_patients_name on patients using gin (to_tsvector('simple', full_name));

-- ---------- Appointments ----------
create type appointment_status as enum ('scheduled','checked_in','in_progress','completed','cancelled','no_show');

create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid references profiles(id),
  clinic_module text not null default 'general', -- general | retina | glaucoma | lasik | pediatric | optical
  scheduled_at timestamptz not null,
  status appointment_status not null default 'scheduled',
  reason text,
  is_walk_in boolean not null default false,
  token_number text,
  created_at timestamptz not null default now()
);

create index idx_appt_patient on appointments(patient_id);
create index idx_appt_scheduled on appointments(scheduled_at);

-- ---------- Visits (a single encounter that threads through the whole journey) ----------
create type visit_stage as enum (
  'registration','waiting','vision_test','preliminary_assessment','refraction',
  'iop','imaging','consultation','investigation','pharmacy','optical',
  'surgery_recommended','insurance_approval','admission','ot','recovery',
  'billing','feedback','follow_up','completed','cancelled'
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  appointment_id uuid references appointments(id),
  clinic_module text not null default 'general',
  attending_doctor_id uuid references profiles(id),
  stage visit_stage not null default 'registration',
  token_number text,
  checked_in_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_visits_patient on visits(patient_id);
create index idx_visits_stage on visits(stage);

-- updated_at trigger helper, reused by later migrations
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_patients_updated before update on patients
  for each row execute function set_updated_at();
create trigger trg_visits_updated before update on visits
  for each row execute function set_updated_at();
