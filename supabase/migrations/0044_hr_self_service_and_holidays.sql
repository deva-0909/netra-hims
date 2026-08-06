-- ============================================================
-- NETRA HIMS — HR self-service + holiday calendar + leave policy notes
--
-- employees_select already let a staff member read their own row
-- (profile_id = auth.uid()) but there was no way to update anything about
-- themselves, and no way to upload their own onboarding documents —
-- "HR self-service" and "self-service onboarding" didn't actually exist.
-- Broadens both, guarded by a trigger (mirrors prevent_self_role_escalation
-- on profiles) so a self-update can touch personal/contact fields but never
-- employment status, type, designation, salary, dates, reporting line,
-- employee code, or the profile link — those stay HR-only regardless of
-- who owns the row.
-- ============================================================

alter table employees add column onboarding_completed boolean not null default true;

create or replace function public.prevent_self_employee_field_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role(variadic array['hr_manager']::staff_role[]) then
    if new.employment_status is distinct from old.employment_status
       or new.employment_type is distinct from old.employment_type
       or new.designation is distinct from old.designation
       or new.monthly_salary is distinct from old.monthly_salary
       or new.date_of_joining is distinct from old.date_of_joining
       or new.date_of_leaving is distinct from old.date_of_leaving
       or new.reporting_manager_id is distinct from old.reporting_manager_id
       or new.employee_code is distinct from old.employee_code
       or new.profile_id is distinct from old.profile_id
    then
      raise exception 'Only HR can change employment status, type, designation, salary, dates, reporting line, employee code, or the profile link.';
    end if;
  end if;
  return new;
end;
$function$;

create trigger trg_prevent_self_employee_field_escalation
before update on employees
for each row execute function prevent_self_employee_field_escalation();

drop policy employees_update on employees;
create policy employees_update on employees for update
  using (has_role(variadic array['hr_manager']::staff_role[]) or profile_id = auth.uid())
  with check (has_role(variadic array['hr_manager']::staff_role[]) or profile_id = auth.uid());

drop policy employee_documents_insert on employee_documents;
create policy employee_documents_insert on employee_documents for insert
  with check (has_role(variadic array['hr_manager']::staff_role[]) or is_own_employee(employee_id));

create table holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  holiday_type text not null default 'public' check (holiday_type in ('public','restricted','optional')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (holiday_date)
);
alter table holidays enable row level security;
create policy holidays_select on holidays for select using (is_staff());
create policy holidays_insert on holidays for insert with check (has_role(variadic array['hr_manager']::staff_role[]));
create policy holidays_update on holidays for update using (has_role(variadic array['hr_manager']::staff_role[])) with check (has_role(variadic array['hr_manager']::staff_role[]));
create policy holidays_delete on holidays for delete using (has_role(variadic array['hr_manager']::staff_role[]));

alter table leave_types add column policy_notes text;
