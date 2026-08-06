-- ============================================================
-- NETRA HIMS — Appointments & Waiting Room deep-dive audit fixes
--
-- now_serving: a real waiting room needs a public "now serving" display,
-- but visits (patient_id, attending_doctor_id, etc.) can't be exposed to
-- anonymous kiosk screens under its existing staff-only RLS. This is a
-- narrow, purpose-built table with nothing but a token number in it —
-- publicly readable by design, staff-only to write — so a TV in the
-- waiting area can show it without broadening any clinical table's RLS.
-- ============================================================

create table now_serving (
  clinic_module text primary key,
  token_number text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table now_serving enable row level security;
create policy "now_serving_select" on now_serving for select to public using (true);
create policy "now_serving_insert" on now_serving for insert to authenticated with check (is_staff());
create policy "now_serving_update" on now_serving for update to authenticated using (is_staff()) with check (is_staff());
