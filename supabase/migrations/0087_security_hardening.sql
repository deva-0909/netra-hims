-- Security hardening (P3): session/device visibility and an emergency-
-- access audit trail. MFA itself needs no schema — Supabase Auth manages
-- TOTP factors internally (auth.mfa_factors), reached entirely through
-- the client SDK's supabase.auth.mfa.* API.
--
-- emergency_access_log is a declare-and-log audit trail, not a technical
-- access gate: patients/consultations are already staff-wide readable
-- (is_staff()) in this app, so there is no existing restriction to
-- "break" through. Its value is the mandatory-reason record itself,
-- reviewable by admin — the same documentation NABH expects for
-- emergency access, without pretending to bypass a restriction that
-- doesn't exist here.

create table login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signed_in_at timestamptz not null default now(),
  user_agent text,
  device_label text
);

create index login_sessions_user_id_idx on login_sessions(user_id);
create index login_sessions_signed_in_at_idx on login_sessions(signed_in_at);

create table emergency_access_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  accessed_by uuid not null references profiles(id),
  reason text not null,
  accessed_at timestamptz not null default now()
);

create index emergency_access_log_patient_id_idx on emergency_access_log(patient_id);

alter table login_sessions enable row level security;
alter table emergency_access_log enable row level security;

-- Any authenticated user may log their own sign-in; only admin reviews
-- the roster (this is security-posture data, narrower than the app's
-- usual staff-wide-read default — same precedent as incident_reports).
create policy "login_sessions_insert" on login_sessions for insert to authenticated with check (user_id = auth.uid());
create policy "login_sessions_select" on login_sessions for select to authenticated using (has_role(variadic array[]::staff_role[]));
create policy "login_sessions_delete" on login_sessions for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- Any staff member can declare emergency access to a patient record
-- (only for themselves — accessed_by must be their own id); only admin
-- reviews the log.
create policy "emergency_access_log_insert" on emergency_access_log for insert to authenticated with check (is_staff() and accessed_by = auth.uid());
create policy "emergency_access_log_select" on emergency_access_log for select to authenticated using (has_role(variadic array[]::staff_role[]));
