-- Patient self-service portal — new for the ERP-completeness audit.
-- Patients previously had no way to see their own records/bills/reports or
-- book anything themselves; the only patient-facing surface was a public
-- appointment REQUEST form (staff-mediated). This adds a genuine but
-- deliberately minimal v1: email-OTP login (reusing Supabase Auth's own
-- passwordless flow — no SMS/WhatsApp gateway needed) into a read-only
-- view of the patient's own appointments, bills and verified lab reports.
-- Self-booking/rescheduling is NOT built here — that's a well-defined,
-- separate next step once this read-only foundation is in use.
--
-- Patients authenticate through the same auth.users table staff do, but
-- via a different linking column (portal_user_id) rather than a profiles
-- row, so every existing staff-only RLS policy (has_role()/is_staff(),
-- both keyed off `profiles`) already excludes a patient session with zero
-- changes — this migration only ADDS narrowly-scoped self-access policies,
-- it doesn't touch any existing one.

alter table patients add column if not exists portal_user_id uuid references auth.users(id);
create unique index if not exists patients_portal_user_id_key on patients(portal_user_id) where portal_user_id is not null;

create or replace function is_own_patient_record(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from patients where id = target_patient_id and portal_user_id = auth.uid()
  );
$function$;

create policy "patients_select_own_portal" on patients for select to authenticated using (portal_user_id = auth.uid());
create policy "appointments_select_own_portal" on appointments for select to authenticated using (is_own_patient_record(patient_id));
create policy "bills_select_own_portal" on bills for select to authenticated using (is_own_patient_record(patient_id));
create policy "lab_orders_select_own_portal" on lab_orders for select to authenticated using (is_own_patient_record(patient_id));

-- Only verified results are visible to the patient — a pending/unverified
-- value shouldn't reach them before a lab technician has signed off on it.
create policy "lab_order_items_select_own_portal" on lab_order_items for select to authenticated using (
  status = 'verified' and exists (
    select 1 from lab_orders lo where lo.id = lab_order_items.lab_order_id and is_own_patient_record(lo.patient_id)
  )
);
