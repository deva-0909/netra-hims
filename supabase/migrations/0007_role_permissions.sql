-- ============================================================
-- NETRA HIMS — Per-role write permissions
-- SELECT stays staff-wide (any active staff can read everything,
-- needed for cross-module context like dashboards and queues).
-- INSERT/UPDATE are now scoped to the roles that plausibly do that
-- job; 'admin' is always allowed via has_role(). DELETE is admin-only
-- everywhere since the app has no delete UI.
-- ============================================================

create or replace function has_role(variadic roles staff_role[]) returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active = true and (role = 'admin' or role = any(roles))
  );
$$ language sql stable security definer set search_path = public;
revoke execute on function has_role(staff_role[]) from anon, public;
grant execute on function has_role(staff_role[]) to authenticated;

-- patients
drop policy if exists "patients_staff_all" on patients;
create policy "patients_select" on patients for select to authenticated using (is_staff());
create policy "patients_insert" on patients for insert to authenticated with check (has_role('reception'::staff_role));
create policy "patients_update" on patients for update to authenticated using (has_role('reception'::staff_role)) with check (has_role('reception'::staff_role));
create policy "patients_delete" on patients for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- appointments
drop policy if exists "appointments_staff_all" on appointments;
create policy "appointments_select" on appointments for select to authenticated using (is_staff());
create policy "appointments_insert" on appointments for insert to authenticated with check (has_role('reception'::staff_role));
create policy "appointments_update" on appointments for update to authenticated using (has_role('reception'::staff_role)) with check (has_role('reception'::staff_role));
create policy "appointments_delete" on appointments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- visits
drop policy if exists "visits_staff_all" on visits;
create policy "visits_select" on visits for select to authenticated using (is_staff());
create policy "visits_insert" on visits for insert to authenticated with check (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role));
create policy "visits_update" on visits for update to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role)) with check (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role));
create policy "visits_delete" on visits for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- vision_tests
drop policy if exists "vision_tests_staff_all" on vision_tests;
create policy "vision_tests_select" on vision_tests for select to authenticated using (is_staff());
create policy "vision_tests_insert" on vision_tests for insert to authenticated with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "vision_tests_update" on vision_tests for update to authenticated using (has_role('optometrist'::staff_role, 'doctor'::staff_role)) with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "vision_tests_delete" on vision_tests for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- preliminary_assessments
drop policy if exists "preliminary_assessments_staff_all" on preliminary_assessments;
create policy "preliminary_assessments_select" on preliminary_assessments for select to authenticated using (is_staff());
create policy "preliminary_assessments_insert" on preliminary_assessments for insert to authenticated with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "preliminary_assessments_update" on preliminary_assessments for update to authenticated using (has_role('optometrist'::staff_role, 'doctor'::staff_role)) with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "preliminary_assessments_delete" on preliminary_assessments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- refractions
drop policy if exists "refractions_staff_all" on refractions;
create policy "refractions_select" on refractions for select to authenticated using (is_staff());
create policy "refractions_insert" on refractions for insert to authenticated with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "refractions_update" on refractions for update to authenticated using (has_role('optometrist'::staff_role, 'doctor'::staff_role)) with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "refractions_delete" on refractions for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- iop_readings
drop policy if exists "iop_readings_staff_all" on iop_readings;
create policy "iop_readings_select" on iop_readings for select to authenticated using (is_staff());
create policy "iop_readings_insert" on iop_readings for insert to authenticated with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "iop_readings_update" on iop_readings for update to authenticated using (has_role('optometrist'::staff_role, 'doctor'::staff_role)) with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "iop_readings_delete" on iop_readings for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- imaging_records
drop policy if exists "imaging_records_staff_all" on imaging_records;
create policy "imaging_records_select" on imaging_records for select to authenticated using (is_staff());
create policy "imaging_records_insert" on imaging_records for insert to authenticated with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "imaging_records_update" on imaging_records for update to authenticated using (has_role('optometrist'::staff_role, 'doctor'::staff_role)) with check (has_role('optometrist'::staff_role, 'doctor'::staff_role));
create policy "imaging_records_delete" on imaging_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- consultations
drop policy if exists "consultations_staff_all" on consultations;
create policy "consultations_select" on consultations for select to authenticated using (is_staff());
create policy "consultations_insert" on consultations for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "consultations_update" on consultations for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "consultations_delete" on consultations for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- investigation_orders
drop policy if exists "investigation_orders_staff_all" on investigation_orders;
create policy "investigation_orders_select" on investigation_orders for select to authenticated using (is_staff());
create policy "investigation_orders_insert" on investigation_orders for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "investigation_orders_update" on investigation_orders for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "investigation_orders_delete" on investigation_orders for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- surgery_recommendations
drop policy if exists "surgery_recommendations_staff_all" on surgery_recommendations;
create policy "surgery_recommendations_select" on surgery_recommendations for select to authenticated using (is_staff());
create policy "surgery_recommendations_insert" on surgery_recommendations for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "surgery_recommendations_update" on surgery_recommendations for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "surgery_recommendations_delete" on surgery_recommendations for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- drugs
drop policy if exists "drugs_staff_all" on drugs;
create policy "drugs_select" on drugs for select to authenticated using (is_staff());
create policy "drugs_insert" on drugs for insert to authenticated with check (has_role('pharmacist'::staff_role));
create policy "drugs_update" on drugs for update to authenticated using (has_role('pharmacist'::staff_role)) with check (has_role('pharmacist'::staff_role));
create policy "drugs_delete" on drugs for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- prescriptions
drop policy if exists "prescriptions_staff_all" on prescriptions;
create policy "prescriptions_select" on prescriptions for select to authenticated using (is_staff());
create policy "prescriptions_insert" on prescriptions for insert to authenticated with check (has_role('doctor'::staff_role, 'pharmacist'::staff_role));
create policy "prescriptions_update" on prescriptions for update to authenticated using (has_role('doctor'::staff_role, 'pharmacist'::staff_role)) with check (has_role('doctor'::staff_role, 'pharmacist'::staff_role));
create policy "prescriptions_delete" on prescriptions for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- prescription_items
drop policy if exists "prescription_items_staff_all" on prescription_items;
create policy "prescription_items_select" on prescription_items for select to authenticated using (is_staff());
create policy "prescription_items_insert" on prescription_items for insert to authenticated with check (has_role('doctor'::staff_role, 'pharmacist'::staff_role));
create policy "prescription_items_update" on prescription_items for update to authenticated using (has_role('doctor'::staff_role, 'pharmacist'::staff_role)) with check (has_role('doctor'::staff_role, 'pharmacist'::staff_role));
create policy "prescription_items_delete" on prescription_items for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- pharmacy_dispenses
drop policy if exists "pharmacy_dispenses_staff_all" on pharmacy_dispenses;
create policy "pharmacy_dispenses_select" on pharmacy_dispenses for select to authenticated using (is_staff());
create policy "pharmacy_dispenses_insert" on pharmacy_dispenses for insert to authenticated with check (has_role('pharmacist'::staff_role));
create policy "pharmacy_dispenses_update" on pharmacy_dispenses for update to authenticated using (has_role('pharmacist'::staff_role)) with check (has_role('pharmacist'::staff_role));
create policy "pharmacy_dispenses_delete" on pharmacy_dispenses for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- optical_orders
drop policy if exists "optical_orders_staff_all" on optical_orders;
create policy "optical_orders_select" on optical_orders for select to authenticated using (is_staff());
create policy "optical_orders_insert" on optical_orders for insert to authenticated with check (has_role('optical'::staff_role));
create policy "optical_orders_update" on optical_orders for update to authenticated using (has_role('optical'::staff_role)) with check (has_role('optical'::staff_role));
create policy "optical_orders_delete" on optical_orders for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- insurance_claims
drop policy if exists "insurance_claims_staff_all" on insurance_claims;
create policy "insurance_claims_select" on insurance_claims for select to authenticated using (is_staff());
create policy "insurance_claims_insert" on insurance_claims for insert to authenticated with check (has_role('insurance_desk'::staff_role));
create policy "insurance_claims_update" on insurance_claims for update to authenticated using (has_role('insurance_desk'::staff_role)) with check (has_role('insurance_desk'::staff_role));
create policy "insurance_claims_delete" on insurance_claims for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- admissions
drop policy if exists "admissions_staff_all" on admissions;
create policy "admissions_select" on admissions for select to authenticated using (is_staff());
create policy "admissions_insert" on admissions for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "admissions_update" on admissions for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "admissions_delete" on admissions for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- ot_records
drop policy if exists "ot_records_staff_all" on ot_records;
create policy "ot_records_select" on ot_records for select to authenticated using (is_staff());
create policy "ot_records_insert" on ot_records for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "ot_records_update" on ot_records for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "ot_records_delete" on ot_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- recovery_records
drop policy if exists "recovery_records_staff_all" on recovery_records;
create policy "recovery_records_select" on recovery_records for select to authenticated using (is_staff());
create policy "recovery_records_insert" on recovery_records for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "recovery_records_update" on recovery_records for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "recovery_records_delete" on recovery_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- bills
drop policy if exists "bills_staff_all" on bills;
create policy "bills_select" on bills for select to authenticated using (is_staff());
create policy "bills_insert" on bills for insert to authenticated with check (has_role('billing'::staff_role));
create policy "bills_update" on bills for update to authenticated using (has_role('billing'::staff_role)) with check (has_role('billing'::staff_role));
create policy "bills_delete" on bills for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- bill_items
drop policy if exists "bill_items_staff_all" on bill_items;
create policy "bill_items_select" on bill_items for select to authenticated using (is_staff());
create policy "bill_items_insert" on bill_items for insert to authenticated with check (has_role('billing'::staff_role));
create policy "bill_items_update" on bill_items for update to authenticated using (has_role('billing'::staff_role)) with check (has_role('billing'::staff_role));
create policy "bill_items_delete" on bill_items for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- feedback
drop policy if exists "feedback_staff_all" on feedback;
create policy "feedback_select" on feedback for select to authenticated using (is_staff());
create policy "feedback_insert" on feedback for insert to authenticated with check (has_role('reception'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role));
create policy "feedback_update" on feedback for update to authenticated using (has_role('reception'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role)) with check (has_role('reception'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role));
create policy "feedback_delete" on feedback for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- follow_ups
drop policy if exists "follow_ups_staff_all" on follow_ups;
create policy "follow_ups_select" on follow_ups for select to authenticated using (is_staff());
create policy "follow_ups_insert" on follow_ups for insert to authenticated with check (has_role('reception'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role));
create policy "follow_ups_update" on follow_ups for update to authenticated using (has_role('reception'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role)) with check (has_role('reception'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role));
create policy "follow_ups_delete" on follow_ups for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- retina_exams
drop policy if exists "retina_exams_staff_all" on retina_exams;
create policy "retina_exams_select" on retina_exams for select to authenticated using (is_staff());
create policy "retina_exams_insert" on retina_exams for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "retina_exams_update" on retina_exams for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "retina_exams_delete" on retina_exams for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- retina_treatments
drop policy if exists "retina_treatments_staff_all" on retina_treatments;
create policy "retina_treatments_select" on retina_treatments for select to authenticated using (is_staff());
create policy "retina_treatments_insert" on retina_treatments for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "retina_treatments_update" on retina_treatments for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "retina_treatments_delete" on retina_treatments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- injection_records
drop policy if exists "injection_records_staff_all" on injection_records;
create policy "injection_records_select" on injection_records for select to authenticated using (is_staff());
create policy "injection_records_insert" on injection_records for insert to authenticated with check (has_role('doctor'::staff_role, 'nurse'::staff_role));
create policy "injection_records_update" on injection_records for update to authenticated using (has_role('doctor'::staff_role, 'nurse'::staff_role)) with check (has_role('doctor'::staff_role, 'nurse'::staff_role));
create policy "injection_records_delete" on injection_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- gonioscopy_records
drop policy if exists "gonioscopy_records_staff_all" on gonioscopy_records;
create policy "gonioscopy_records_select" on gonioscopy_records for select to authenticated using (is_staff());
create policy "gonioscopy_records_insert" on gonioscopy_records for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "gonioscopy_records_update" on gonioscopy_records for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "gonioscopy_records_delete" on gonioscopy_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- visual_field_tests
drop policy if exists "visual_field_tests_staff_all" on visual_field_tests;
create policy "visual_field_tests_select" on visual_field_tests for select to authenticated using (is_staff());
create policy "visual_field_tests_insert" on visual_field_tests for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "visual_field_tests_update" on visual_field_tests for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "visual_field_tests_delete" on visual_field_tests for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- oct_rnfl_records
drop policy if exists "oct_rnfl_records_staff_all" on oct_rnfl_records;
create policy "oct_rnfl_records_select" on oct_rnfl_records for select to authenticated using (is_staff());
create policy "oct_rnfl_records_insert" on oct_rnfl_records for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "oct_rnfl_records_update" on oct_rnfl_records for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "oct_rnfl_records_delete" on oct_rnfl_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- glaucoma_plans
drop policy if exists "glaucoma_plans_staff_all" on glaucoma_plans;
create policy "glaucoma_plans_select" on glaucoma_plans for select to authenticated using (is_staff());
create policy "glaucoma_plans_insert" on glaucoma_plans for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "glaucoma_plans_update" on glaucoma_plans for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "glaucoma_plans_delete" on glaucoma_plans for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- corneal_topography
drop policy if exists "corneal_topography_staff_all" on corneal_topography;
create policy "corneal_topography_select" on corneal_topography for select to authenticated using (is_staff());
create policy "corneal_topography_insert" on corneal_topography for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "corneal_topography_update" on corneal_topography for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "corneal_topography_delete" on corneal_topography for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- dry_eye_assessments
drop policy if exists "dry_eye_assessments_staff_all" on dry_eye_assessments;
create policy "dry_eye_assessments_select" on dry_eye_assessments for select to authenticated using (is_staff());
create policy "dry_eye_assessments_insert" on dry_eye_assessments for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "dry_eye_assessments_update" on dry_eye_assessments for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "dry_eye_assessments_delete" on dry_eye_assessments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- lasik_eligibility
drop policy if exists "lasik_eligibility_staff_all" on lasik_eligibility;
create policy "lasik_eligibility_select" on lasik_eligibility for select to authenticated using (is_staff());
create policy "lasik_eligibility_insert" on lasik_eligibility for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "lasik_eligibility_update" on lasik_eligibility for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "lasik_eligibility_delete" on lasik_eligibility for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- lasik_consents
drop policy if exists "lasik_consents_staff_all" on lasik_consents;
create policy "lasik_consents_select" on lasik_consents for select to authenticated using (is_staff());
create policy "lasik_consents_insert" on lasik_consents for insert to authenticated with check (has_role('doctor'::staff_role, 'nurse'::staff_role));
create policy "lasik_consents_update" on lasik_consents for update to authenticated using (has_role('doctor'::staff_role, 'nurse'::staff_role)) with check (has_role('doctor'::staff_role, 'nurse'::staff_role));
create policy "lasik_consents_delete" on lasik_consents for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- lasik_procedure_records
drop policy if exists "lasik_procedure_records_staff_all" on lasik_procedure_records;
create policy "lasik_procedure_records_select" on lasik_procedure_records for select to authenticated using (is_staff());
create policy "lasik_procedure_records_insert" on lasik_procedure_records for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "lasik_procedure_records_update" on lasik_procedure_records for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "lasik_procedure_records_delete" on lasik_procedure_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- post_procedure_reviews
drop policy if exists "post_procedure_reviews_staff_all" on post_procedure_reviews;
create policy "post_procedure_reviews_select" on post_procedure_reviews for select to authenticated using (is_staff());
create policy "post_procedure_reviews_insert" on post_procedure_reviews for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "post_procedure_reviews_update" on post_procedure_reviews for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "post_procedure_reviews_delete" on post_procedure_reviews for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- squint_assessments
drop policy if exists "squint_assessments_staff_all" on squint_assessments;
create policy "squint_assessments_select" on squint_assessments for select to authenticated using (is_staff());
create policy "squint_assessments_insert" on squint_assessments for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "squint_assessments_update" on squint_assessments for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "squint_assessments_delete" on squint_assessments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- cycloplegic_refractions
drop policy if exists "cycloplegic_refractions_staff_all" on cycloplegic_refractions;
create policy "cycloplegic_refractions_select" on cycloplegic_refractions for select to authenticated using (is_staff());
create policy "cycloplegic_refractions_insert" on cycloplegic_refractions for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "cycloplegic_refractions_update" on cycloplegic_refractions for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "cycloplegic_refractions_delete" on cycloplegic_refractions for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- pediatric_diagnoses
drop policy if exists "pediatric_diagnoses_staff_all" on pediatric_diagnoses;
create policy "pediatric_diagnoses_select" on pediatric_diagnoses for select to authenticated using (is_staff());
create policy "pediatric_diagnoses_insert" on pediatric_diagnoses for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "pediatric_diagnoses_update" on pediatric_diagnoses for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "pediatric_diagnoses_delete" on pediatric_diagnoses for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- parent_followups
drop policy if exists "parent_followups_staff_all" on parent_followups;
create policy "parent_followups_select" on parent_followups for select to authenticated using (is_staff());
create policy "parent_followups_insert" on parent_followups for insert to authenticated with check (has_role('doctor'::staff_role, 'nurse'::staff_role, 'reception'::staff_role));
create policy "parent_followups_update" on parent_followups for update to authenticated using (has_role('doctor'::staff_role, 'nurse'::staff_role, 'reception'::staff_role)) with check (has_role('doctor'::staff_role, 'nurse'::staff_role, 'reception'::staff_role));
create policy "parent_followups_delete" on parent_followups for delete to authenticated using (has_role(variadic array[]::staff_role[]));
-- profiles: special-cased — self can always read/update their own row (this is
-- what makes the demo role-switcher work regardless of current role), staff
-- broadly can read everyone (needed for name lookups across the app), but only
-- admin can edit or deactivate *other* people's accounts.
drop policy if exists "profiles_staff_all" on profiles;
create policy "profiles_select" on profiles for select to authenticated using (is_staff() or id = auth.uid());
create policy "profiles_update" on profiles for update to authenticated
  using (id = auth.uid() or has_role(variadic array[]::staff_role[]))
  with check (id = auth.uid() or has_role(variadic array[]::staff_role[]));
create policy "profiles_delete" on profiles for delete to authenticated using (has_role(variadic array[]::staff_role[]));
