-- beds_update only allowed nurse/ot_staff, but three flows a doctor can
-- trigger all end with a write to beds.status: AdmitForm (IpdWardPage.tsx)
-- and admitPatient (AdmissionStage.tsx) both mark the assigned bed
-- 'occupied' right after creating the admission, TransferPanel flips both
-- the old and new bed on a ward transfer, and DischargeChecklist marks the
-- bed 'available' again on discharge. All four explicitly list 'doctor' in
-- their own CAN_MANAGE set (and admissions_insert/admissions_update/
-- visits_insert already include 'doctor') — but with beds_update excluding
-- it, a doctor-initiated admit/transfer/discharge silently fails on that
-- last write every single time. The admission itself still gets created
-- correctly (or discharged), but the bed's status is left stale — an
-- occupied bed can keep showing as available on the Bed Board (or a
-- discharged one as still occupied), a real double-booking risk in a ward.
-- Broadened to match the other IPD tables' policies, not narrowed the UI,
-- since admissions_insert/update already treat 'doctor' as a full
-- participant in the admission workflow.
drop policy beds_update on beds;
create policy beds_update on beds for update to authenticated
  using (has_role(variadic array['nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role]))
  with check (has_role(variadic array['nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role]));
