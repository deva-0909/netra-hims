-- ============================================================
-- NETRA HIMS — Clinical workflow tables (general OPD journey)
-- ============================================================

-- Eye-specific measurement fields are duplicated per eye with _od (right) / _os (left) suffixes,
-- following standard ophthalmology charting convention (OD = oculus dexter, OS = oculus sinister).

create table vision_tests (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  uncorrected_va_od text,
  uncorrected_va_os text,
  corrected_va_od text,
  corrected_va_os text,
  pinhole_va_od text,
  pinhole_va_os text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table preliminary_assessments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  chief_complaint text,
  duration_of_symptoms text,
  history_present_illness text,
  past_ocular_history text,
  systemic_history text,
  medication_history text,
  vitals_bp text,
  vitals_pulse text,
  vitals_blood_sugar text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table refractions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  sphere_od numeric(5,2), cylinder_od numeric(5,2), axis_od int, add_od numeric(4,2),
  sphere_os numeric(5,2), cylinder_os numeric(5,2), axis_os int, add_os numeric(4,2),
  method text default 'subjective', -- subjective | autorefractor | cycloplegic
  final_va_od text,
  final_va_os text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table iop_readings (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  iop_od numeric(4,1),
  iop_os numeric(4,1),
  method text default 'noncontact_tonometer', -- noncontact_tonometer | goldmann_applanation | icare
  measured_at timestamptz not null default now(),
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table imaging_records (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  imaging_type text not null, -- biometry | oct | fundus_photo | topography | pachymetry | visual_field | gonioscopy
  eye text check (eye in ('od','os','both')),
  axial_length_od numeric(5,2), axial_length_os numeric(5,2),
  k1_od numeric(5,2), k2_od numeric(5,2), k1_os numeric(5,2), k2_os numeric(5,2),
  iol_power_od numeric(5,2), iol_power_os numeric(5,2),
  iol_formula text,
  findings text,
  file_url text, -- pointer to Supabase Storage object, if an image/PDF was captured
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table consultations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  doctor_id uuid references profiles(id),
  anterior_segment_od text,
  anterior_segment_os text,
  posterior_segment_od text,
  posterior_segment_os text,
  diagnosis text,
  icd10_code text,
  clinical_notes text,
  plan text,
  needs_surgery boolean not null default false,
  needs_investigation boolean not null default false,
  needs_pharmacy boolean not null default false,
  needs_optical boolean not null default false,
  follow_up_days int,
  created_at timestamptz not null default now()
);

create table investigation_orders (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  test_name text not null,
  status text not null default 'ordered' check (status in ('ordered','in_progress','completed','cancelled')),
  ordered_by uuid references profiles(id),
  result text,
  result_file_url text,
  ordered_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------- Pharmacy ----------
create table drugs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form text, -- tablet | eye_drop | ointment | injection
  strength text,
  stock_qty int not null default 0,
  unit_price numeric(10,2) not null default 0,
  reorder_level int not null default 10
);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  prescribed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  drug_id uuid references drugs(id),
  drug_name_freetext text,
  dosage text,
  frequency text,
  duration_days int,
  eye text check (eye in ('od','os','both','n/a')),
  instructions text
);

create table pharmacy_dispenses (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  dispensed_by uuid references profiles(id),
  status text not null default 'pending' check (status in ('pending','partially_dispensed','dispensed','cancelled')),
  dispensed_at timestamptz,
  total_amount numeric(10,2) default 0
);

-- ---------- Optical shop ----------
create table optical_orders (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,
  order_number text not null unique,
  frame_brand text,
  frame_model text,
  frame_price numeric(10,2),
  lens_type text, -- single_vision | bifocal | progressive | contact
  lens_coating text,
  lens_price numeric(10,2),
  rx_sphere_od numeric(5,2), rx_cylinder_od numeric(5,2), rx_axis_od int,
  rx_sphere_os numeric(5,2), rx_cylinder_os numeric(5,2), rx_axis_os int,
  status text not null default 'ordered' check (status in ('ordered','in_fabrication','ready','dispensed','cancelled')),
  total_amount numeric(10,2) default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  eta_date date
);

-- ---------- Surgery & insurance & admission pathway ----------
create table surgery_recommendations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  procedure_name text not null,
  eye text check (eye in ('od','os','both')),
  urgency text default 'elective' check (urgency in ('elective','urgent','emergency')),
  recommended_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table insurance_claims (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,
  scheme text, -- e.g. star_health, ayushman_bharat, other
  policy_or_card_no text,
  package_selected text,
  claim_amount numeric(12,2),
  approved_amount numeric(12,2),
  status text not null default 'eligibility_check'
    check (status in ('eligibility_check','pre_auth_requested','approved','rejected','settled')),
  pre_auth_reference text,
  handled_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_insurance_updated before update on insurance_claims
  for each row execute function set_updated_at();

create table admissions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  bed_number text,
  admitted_at timestamptz not null default now(),
  discharged_at timestamptz,
  consent_signed boolean not null default false,
  consent_file_url text,
  admitted_by uuid references profiles(id)
);

create table ot_records (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id) on delete cascade,
  procedure_name text not null,
  eye text check (eye in ('od','os','both')),
  surgeon_id uuid references profiles(id),
  anaesthetist_id uuid references profiles(id),
  ot_room text,
  start_time timestamptz,
  end_time timestamptz,
  intra_op_notes text,
  complications text,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled'))
);

create table recovery_records (
  id uuid primary key default gen_random_uuid(),
  ot_record_id uuid not null references ot_records(id) on delete cascade,
  vitals_notes text,
  pain_score int check (pain_score between 0 and 10),
  discharge_ready boolean not null default false,
  discharge_instructions text,
  monitored_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);

-- ---------- Billing ----------
create table bills (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,
  bill_number text not null unique,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  insurance_covered numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partially_paid','paid','refunded')),
  payment_method text,
  generated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  description text not null,
  category text, -- consultation | investigation | pharmacy | optical | surgery | admission | other
  quantity int not null default 1,
  unit_price numeric(10,2) not null default 0,
  amount numeric(10,2) not null default 0
);

-- ---------- Feedback & follow-up ----------
create table feedback (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now()
);

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,
  due_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','scheduled','completed','missed')),
  notes text,
  created_at timestamptz not null default now()
);
