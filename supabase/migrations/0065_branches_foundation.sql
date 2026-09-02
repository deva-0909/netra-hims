-- Multi-branch/multi-location foundation — new for the ERP-completeness
-- audit, deliberately scoped down from a full retrofit. There is no
-- branch_id anywhere in this schema today — every operational table
-- (visits, bills, inventory, procurement, ~60 tables total) and every RLS
-- policy assumes a single facility. Retrofitting that everywhere is a
-- major, invasive change with real regression risk across an already-large
-- app, and does not belong in the same pass as everything else in this
-- audit. This migration adds only the foundation: a branches table and
-- staff-to-branch assignment (mirrors the existing departments/
-- profiles.department_id pattern exactly), so a hospital group has
-- somewhere to start from. Wiring branch_id into inventory/billing/RLS is
-- a separate, dedicated future effort.

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text,
  phone text,
  is_main boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists branch_id uuid references branches(id);

alter table branches enable row level security;

create policy "branches_select" on branches for select to authenticated using (is_staff());
create policy "branches_insert" on branches for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "branches_update" on branches for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "branches_delete" on branches for delete to authenticated using (has_role(variadic array[]::staff_role[]));

insert into branches (name, code, is_main) values ('Main Branch', 'MAIN', true);
