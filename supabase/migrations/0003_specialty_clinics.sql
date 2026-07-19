-- ============================================================
-- NETRA HIMS — Specialty clinic tables: retina, glaucoma, LASIK, pediatric
-- ============================================================

-- ---------- Retina clinic ----------
create table retina_exams (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  dr_grade_od text, -- e.g. no_dr | mild_npdr | moderate_npdr | severe_npdr | pdr
  dr_grade_os text,
  csme_od boolean default false,
  csme_os boolean default false,
  fundus_findings text,
  oct_findings text,
  examined_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table retina_treatments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  eye text check (eye in ('od','os','both')),
  treatment_type text, -- intravitreal_injection | laser_photocoagulation | vitrectomy | observation
  drug_name text,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table injection_records (
  id uuid primary key default gen_random_uuid(),
  retina_treatment_id uuid references retina_treatments(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  eye text check (eye in ('od','os')),
  drug_name text not null,
  batch_number text,
  dose text,
  injected_by uuid references profiles(id),
  injected_at timestamptz not null default now(),
  next_dose_due date
);

-- ---------- Glaucoma clinic ----------
create table gonioscopy_records (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  angle_grade_od text,
  angle_grade_os text,
  findings text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table visual_field_tests (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  test_pattern text default '24-2',
  eye text check (eye in ('od','os')),
  md_value numeric(5,2),   -- Mean Deviation
  psd_value numeric(5,2),  -- Pattern Standard Deviation
  reliability text,
  file_url text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table oct_rnfl_records (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  eye text check (eye in ('od','os')),
  rnfl_avg_thickness numeric(5,1),
  progression_notes text,
  file_url text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table glaucoma_plans (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  target_iop_od numeric(4,1),
  target_iop_os numeric(4,1),
  management text, -- medical | laser | surgical
  next_review_date date,
  notes text,
  planned_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- LASIK / refractive clinic ----------
create table corneal_topography (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  k1_od numeric(5,2), k2_od numeric(5,2), k1_os numeric(5,2), k2_os numeric(5,2),
  pachymetry_od numeric(6,1),
  pachymetry_os numeric(6,1),
  corneal_map_notes text,
  file_url text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table dry_eye_assessments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  tbut_od numeric(4,1), -- Tear Break-Up Time (seconds)
  tbut_os numeric(4,1),
  schirmer_od numeric(4,1),
  schirmer_os numeric(4,1),
  osdi_score numeric(5,1),
  findings text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table lasik_eligibility (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  eligible boolean,
  procedure_recommended text, -- lasik | prk | smile | not_eligible
  reason text,
  assessed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table lasik_consents (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  consent_signed boolean not null default false,
  consent_file_url text,
  signed_at timestamptz,
  witnessed_by uuid references profiles(id)
);

create table lasik_procedure_records (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  eye text check (eye in ('od','os','both')),
  procedure_type text, -- lasik | prk | smile
  surgeon_id uuid references profiles(id),
  flap_parameters text,
  ablation_parameters text,
  notes text,
  performed_at timestamptz default now()
);

create table post_procedure_reviews (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  review_day int, -- day 1, day 7, month 1, etc.
  uncorrected_va_od text,
  uncorrected_va_os text,
  complications text,
  notes text,
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Pediatric ophthalmology ----------
create table squint_assessments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  deviation_type text, -- esotropia | exotropia | hypertropia | hypotropia | none
  deviation_angle text,
  binocular_vision_status text,
  stereopsis text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table cycloplegic_refractions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  cycloplegic_agent text,
  sphere_od numeric(5,2), cylinder_od numeric(5,2), axis_od int,
  sphere_os numeric(5,2), cylinder_os numeric(5,2), axis_os int,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table pediatric_diagnoses (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  diagnosis text,
  plan text,
  patching_prescribed boolean default false,
  patching_hours_per_day numeric(4,1),
  glasses_prescribed boolean default false,
  diagnosed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table parent_followups (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,
  compliance_notes text, -- patching / glasses compliance reported by parent
  next_review_date date,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);