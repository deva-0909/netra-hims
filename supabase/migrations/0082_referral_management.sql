-- Referral Management — closes a P2 gap from the audit report
-- (referring-doctor tracking + conversion reporting). patients.referral_source
-- was already a coarse category (e.g. "Doctor Referral", "Camp") with no
-- identity behind a doctor referral — this adds a real registry of
-- external referring doctors and links a patient's registration to one.

create table referring_doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  qualification text,
  clinic_or_hospital_name text,
  phone text,
  email text,
  specialty text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table patients add column referring_doctor_id uuid references referring_doctors(id);

alter table referring_doctors enable row level security;

create policy "referring_doctors_select" on referring_doctors for select to authenticated using (is_staff());
create policy "referring_doctors_insert" on referring_doctors for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "referring_doctors_update" on referring_doctors for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "referring_doctors_delete" on referring_doctors for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_referring_doctors after insert or update or delete on referring_doctors for each row execute function log_audit_event();
