-- ============================================================
-- NETRA HIMS — Row Level Security
-- Internal staff tool: any authenticated user with an active
-- profile row may read/write. Tighten per-role later if needed.
-- ============================================================

create or replace function is_staff() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and active = true);
$$ language sql stable security definer set search_path = public;

alter table profiles enable row level security;
create policy "profiles_staff_all" on profiles for all to authenticated using (is_staff()) with check (is_staff());

alter table patients enable row level security;
create policy "patients_staff_all" on patients for all to authenticated using (is_staff()) with check (is_staff());

alter table appointments enable row level security;
create policy "appointments_staff_all" on appointments for all to authenticated using (is_staff()) with check (is_staff());

alter table visits enable row level security;
create policy "visits_staff_all" on visits for all to authenticated using (is_staff()) with check (is_staff());

alter table vision_tests enable row level security;
create policy "vision_tests_staff_all" on vision_tests for all to authenticated using (is_staff()) with check (is_staff());

alter table preliminary_assessments enable row level security;
create policy "preliminary_assessments_staff_all" on preliminary_assessments for all to authenticated using (is_staff()) with check (is_staff());

alter table refractions enable row level security;
create policy "refractions_staff_all" on refractions for all to authenticated using (is_staff()) with check (is_staff());

alter table iop_readings enable row level security;
create policy "iop_readings_staff_all" on iop_readings for all to authenticated using (is_staff()) with check (is_staff());

alter table imaging_records enable row level security;
create policy "imaging_records_staff_all" on imaging_records for all to authenticated using (is_staff()) with check (is_staff());

alter table consultations enable row level security;
create policy "consultations_staff_all" on consultations for all to authenticated using (is_staff()) with check (is_staff());

alter table investigation_orders enable row level security;
create policy "investigation_orders_staff_all" on investigation_orders for all to authenticated using (is_staff()) with check (is_staff());

alter table drugs enable row level security;
create policy "drugs_staff_all" on drugs for all to authenticated using (is_staff()) with check (is_staff());

alter table prescriptions enable row level security;
create policy "prescriptions_staff_all" on prescriptions for all to authenticated using (is_staff()) with check (is_staff());

alter table prescription_items enable row level security;
create policy "prescription_items_staff_all" on prescription_items for all to authenticated using (is_staff()) with check (is_staff());

alter table pharmacy_dispenses enable row level security;
create policy "pharmacy_dispenses_staff_all" on pharmacy_dispenses for all to authenticated using (is_staff()) with check (is_staff());

alter table optical_orders enable row level security;
create policy "optical_orders_staff_all" on optical_orders for all to authenticated using (is_staff()) with check (is_staff());

alter table surgery_recommendations enable row level security;
create policy "surgery_recommendations_staff_all" on surgery_recommendations for all to authenticated using (is_staff()) with check (is_staff());

alter table insurance_claims enable row level security;
create policy "insurance_claims_staff_all" on insurance_claims for all to authenticated using (is_staff()) with check (is_staff());

alter table admissions enable row level security;
create policy "admissions_staff_all" on admissions for all to authenticated using (is_staff()) with check (is_staff());

alter table ot_records enable row level security;
create policy "ot_records_staff_all" on ot_records for all to authenticated using (is_staff()) with check (is_staff());

alter table recovery_records enable row level security;
create policy "recovery_records_staff_all" on recovery_records for all to authenticated using (is_staff()) with check (is_staff());

alter table bills enable row level security;
create policy "bills_staff_all" on bills for all to authenticated using (is_staff()) with check (is_staff());

alter table bill_items enable row level security;
create policy "bill_items_staff_all" on bill_items for all to authenticated using (is_staff()) with check (is_staff());

alter table feedback enable row level security;
create policy "feedback_staff_all" on feedback for all to authenticated using (is_staff()) with check (is_staff());

alter table follow_ups enable row level security;
create policy "follow_ups_staff_all" on follow_ups for all to authenticated using (is_staff()) with check (is_staff());

alter table retina_exams enable row level security;
create policy "retina_exams_staff_all" on retina_exams for all to authenticated using (is_staff()) with check (is_staff());

alter table retina_treatments enable row level security;
create policy "retina_treatments_staff_all" on retina_treatments for all to authenticated using (is_staff()) with check (is_staff());

alter table injection_records enable row level security;
create policy "injection_records_staff_all" on injection_records for all to authenticated using (is_staff()) with check (is_staff());

alter table gonioscopy_records enable row level security;
create policy "gonioscopy_records_staff_all" on gonioscopy_records for all to authenticated using (is_staff()) with check (is_staff());

alter table visual_field_tests enable row level security;
create policy "visual_field_tests_staff_all" on visual_field_tests for all to authenticated using (is_staff()) with check (is_staff());

alter table oct_rnfl_records enable row level security;
create policy "oct_rnfl_records_staff_all" on oct_rnfl_records for all to authenticated using (is_staff()) with check (is_staff());

alter table glaucoma_plans enable row level security;
create policy "glaucoma_plans_staff_all" on glaucoma_plans for all to authenticated using (is_staff()) with check (is_staff());

alter table corneal_topography enable row level security;
create policy "corneal_topography_staff_all" on corneal_topography for all to authenticated using (is_staff()) with check (is_staff());

alter table dry_eye_assessments enable row level security;
create policy "dry_eye_assessments_staff_all" on dry_eye_assessments for all to authenticated using (is_staff()) with check (is_staff());

alter table lasik_eligibility enable row level security;
create policy "lasik_eligibility_staff_all" on lasik_eligibility for all to authenticated using (is_staff()) with check (is_staff());

alter table lasik_consents enable row level security;
create policy "lasik_consents_staff_all" on lasik_consents for all to authenticated using (is_staff()) with check (is_staff());

alter table lasik_procedure_records enable row level security;
create policy "lasik_procedure_records_staff_all" on lasik_procedure_records for all to authenticated using (is_staff()) with check (is_staff());

alter table post_procedure_reviews enable row level security;
create policy "post_procedure_reviews_staff_all" on post_procedure_reviews for all to authenticated using (is_staff()) with check (is_staff());

alter table squint_assessments enable row level security;
create policy "squint_assessments_staff_all" on squint_assessments for all to authenticated using (is_staff()) with check (is_staff());

alter table cycloplegic_refractions enable row level security;
create policy "cycloplegic_refractions_staff_all" on cycloplegic_refractions for all to authenticated using (is_staff()) with check (is_staff());

alter table pediatric_diagnoses enable row level security;
create policy "pediatric_diagnoses_staff_all" on pediatric_diagnoses for all to authenticated using (is_staff()) with check (is_staff());

alter table parent_followups enable row level security;
create policy "parent_followups_staff_all" on parent_followups for all to authenticated using (is_staff()) with check (is_staff());

create policy "profiles_self_read" on profiles for select to authenticated using (id = auth.uid());
create policy "profiles_self_insert" on profiles for insert to authenticated with check (id = auth.uid());