-- Org-wide deep-dive, cross-cutting fixes.
--
-- 1. Migration-drift backfill: the live database already has audit_log
--    triggers on ~20 tables (amc_contracts, bills, biomedical_waste_log,
--    calibration_certificates, deposits, employee_exits, employees,
--    equipment_assets, incident_reports, insurance_claims, leave_requests,
--    maintenance_work_orders, ot_safety_checklists, patient_grievances,
--    po_payments, profiles, purchase_order_items, purchase_orders,
--    regulatory_licenses, surgical_consents) that were never captured in a
--    committed migration file — same class of drift as the earlier
--    stock_receipts.adjustment_reason fix. Recorded here as idempotent
--    drop-if-exists/create pairs so the repo's migration history matches
--    live reality and is reproducible on a fresh environment.
-- 2. Genuinely new coverage: patients (to catch merge changes), mlc_cases,
--    record_requests, admissions — tables where "who changed this" matters
--    but nothing was ever tracking it, live or otherwise.
-- 3. quality_manager was granted nav access to MRD's Completion Dashboard
--    (app-code change in roleNav.ts) but had no SELECT access to most of
--    the tables that dashboard reads — broadened here so it isn't just an
--    empty page.

drop trigger if exists audit_amc_contracts on amc_contracts;
create trigger audit_amc_contracts after insert or update or delete on amc_contracts for each row execute function log_audit_event();

drop trigger if exists audit_biomedical_waste_log on biomedical_waste_log;
create trigger audit_biomedical_waste_log after insert or update or delete on biomedical_waste_log for each row execute function log_audit_event();

drop trigger if exists audit_calibration_certificates on calibration_certificates;
create trigger audit_calibration_certificates after insert or update or delete on calibration_certificates for each row execute function log_audit_event();

drop trigger if exists audit_deposits on deposits;
create trigger audit_deposits after insert or update or delete on deposits for each row execute function log_audit_event();

drop trigger if exists audit_employee_exits on employee_exits;
create trigger audit_employee_exits after insert or update or delete on employee_exits for each row execute function log_audit_event();

drop trigger if exists audit_employees on employees;
create trigger audit_employees after insert or update or delete on employees for each row execute function log_audit_event();

drop trigger if exists audit_equipment_assets on equipment_assets;
create trigger audit_equipment_assets after insert or update or delete on equipment_assets for each row execute function log_audit_event();

drop trigger if exists audit_incident_reports on incident_reports;
create trigger audit_incident_reports after insert or update or delete on incident_reports for each row execute function log_audit_event();

drop trigger if exists audit_leave_requests on leave_requests;
create trigger audit_leave_requests after insert or update or delete on leave_requests for each row execute function log_audit_event();

drop trigger if exists audit_maintenance_work_orders on maintenance_work_orders;
create trigger audit_maintenance_work_orders after insert or update or delete on maintenance_work_orders for each row execute function log_audit_event();

drop trigger if exists audit_ot_safety_checklists on ot_safety_checklists;
create trigger audit_ot_safety_checklists after insert or update or delete on ot_safety_checklists for each row execute function log_audit_event();

drop trigger if exists audit_patient_grievances on patient_grievances;
create trigger audit_patient_grievances after insert or update or delete on patient_grievances for each row execute function log_audit_event();

drop trigger if exists audit_po_payments on po_payments;
create trigger audit_po_payments after insert or update or delete on po_payments for each row execute function log_audit_event();

drop trigger if exists audit_purchase_order_items on purchase_order_items;
create trigger audit_purchase_order_items after insert or update or delete on purchase_order_items for each row execute function log_audit_event();

drop trigger if exists audit_purchase_orders on purchase_orders;
create trigger audit_purchase_orders after insert or update or delete on purchase_orders for each row execute function log_audit_event();

drop trigger if exists audit_regulatory_licenses on regulatory_licenses;
create trigger audit_regulatory_licenses after insert or update or delete on regulatory_licenses for each row execute function log_audit_event();

drop trigger if exists audit_surgical_consents on surgical_consents;
create trigger audit_surgical_consents after insert or update or delete on surgical_consents for each row execute function log_audit_event();

-- Genuinely new coverage.
drop trigger if exists audit_patients on patients;
create trigger audit_patients after update on patients for each row execute function log_audit_event();

drop trigger if exists audit_mlc_cases on mlc_cases;
create trigger audit_mlc_cases after insert or update on mlc_cases for each row execute function log_audit_event();

drop trigger if exists audit_record_requests on record_requests;
create trigger audit_record_requests after insert or update on record_requests for each row execute function log_audit_event();

drop trigger if exists audit_admissions on admissions;
create trigger audit_admissions after insert or update on admissions for each row execute function log_audit_event();

-- quality_manager read-access broadening for the MRD Completion Dashboard.
drop policy "admissions_select" on admissions;
create policy "admissions_select" on admissions for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'billing'::staff_role, 'insurance_desk'::staff_role, 'quality_manager'::staff_role));

drop policy "patients_select" on patients;
create policy "patients_select" on patients for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'billing'::staff_role, 'insurance_desk'::staff_role, 'optical'::staff_role, 'pharmacist'::staff_role, 'quality_manager'::staff_role));

drop policy "lasik_consents_select" on lasik_consents;
create policy "lasik_consents_select" on lasik_consents for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'quality_manager'::staff_role));

drop policy "lasik_procedure_records_select" on lasik_procedure_records;
create policy "lasik_procedure_records_select" on lasik_procedure_records for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'billing'::staff_role, 'insurance_desk'::staff_role, 'quality_manager'::staff_role));

drop policy "surgery_recommendations_select" on surgery_recommendations;
create policy "surgery_recommendations_select" on surgery_recommendations for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'billing'::staff_role, 'insurance_desk'::staff_role, 'quality_manager'::staff_role));

drop policy "ot_records_select" on ot_records;
create policy "ot_records_select" on ot_records for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'billing'::staff_role, 'insurance_desk'::staff_role, 'quality_manager'::staff_role));

drop policy "bills_select" on bills;
create policy "bills_select" on bills for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'billing'::staff_role, 'quality_manager'::staff_role));

drop policy "feedback_select" on feedback;
create policy "feedback_select" on feedback for select to authenticated using (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'mrd'::staff_role, 'quality_manager'::staff_role));
