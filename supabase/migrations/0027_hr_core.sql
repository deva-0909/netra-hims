-- ============================================================
-- NETRA HIMS â€” HR core: employee records, leave, attendance
-- Phase 1 of the paperless-hospital roadmap (Domain A). Employee
-- personal/financial data is a different sensitivity class from the
-- clinical tables, so reads here follow the same self-or-admin carve-out
-- already used for `profiles` (0007) rather than the staff-wide is_staff()
-- pattern used for clinical/dashboard data.
-- ============================================================

create table employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  employee_code text not null unique, -- e.g. NH-EMP-0001
  designation text,
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'visiting_consultant', 'intern')),
  employment_status text not null default 'active' check (employment_status in ('active', 'on_leave', 'suspended', 'resigned', 'terminated')),
  date_of_joining date,
  date_of_leaving date,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  personal_phone text,
  personal_email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  pan_number text,
  aadhaar_number text,
  bank_account_number text,
  bank_ifsc text,
  monthly_salary numeric(12,2),
  reporting_manager_id uuid references employees(id),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_employees_profile on employees(profile_id);
create index idx_employees_manager on employees(reporting_manager_id);
create trigger trg_employees_updated before update on employees
  for each row execute function set_updated_at();

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  document_type text not null check (document_type in ('id_proof', 'address_proof', 'educational_certificate', 'professional_license', 'contract', 'offer_letter', 'other')),
  document_name text not null,
  document_url text,
  expiry_date date, -- for licenses/registrations that need renewal tracking
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_employee_documents_employee on employee_documents(employee_id);

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_annual_days numeric(5,1) not null default 0,
  is_paid boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into leave_types (name, default_annual_days, is_paid) values
  ('Casual Leave', 12, true),
  ('Sick Leave', 12, true),
  ('Earned Leave', 15, true),
  ('Maternity Leave', 182, true),
  ('Paternity Leave', 15, true),
  ('Leave Without Pay', 0, false);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  total_days numeric(5,1) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_leave_requests_employee on leave_requests(employee_id);
create index idx_leave_requests_status on leave_requests(status);
create trigger trg_leave_requests_updated before update on leave_requests
  for each row execute function set_updated_at();

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  year int not null,
  allocated_days numeric(5,1) not null default 0,
  used_days numeric(5,1) not null default 0,
  unique (employee_id, leave_type_id, year)
);
create index idx_leave_balances_employee on leave_balances(employee_id);

create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  log_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present' check (status in ('present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off')),
  source text not null default 'web' check (source in ('web', 'manual', 'biometric')),
  remarks text,
  created_at timestamptz not null default now(),
  unique (employee_id, log_date)
);
create index idx_attendance_logs_employee on attendance_logs(employee_id);
create index idx_attendance_logs_date on attendance_logs(log_date);

-- ---------- RLS ----------
-- employees: self can read/update own row, hr_manager manages everyone.
create or replace function is_own_employee(emp_id uuid) returns boolean as $$
  select exists (select 1 from employees where id = emp_id and profile_id = auth.uid());
$$ language sql stable security definer set search_path = public;
revoke execute on function is_own_employee(uuid) from anon, public;
grant execute on function is_own_employee(uuid) to authenticated;

alter table employees enable row level security;
create policy "employees_select" on employees for select to authenticated
  using (has_role('hr_manager'::staff_role) or profile_id = auth.uid());
create policy "employees_insert" on employees for insert to authenticated
  with check (has_role('hr_manager'::staff_role));
create policy "employees_update" on employees for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "employees_delete" on employees for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

alter table employee_documents enable row level security;
create policy "employee_documents_select" on employee_documents for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "employee_documents_insert" on employee_documents for insert to authenticated
  with check (has_role('hr_manager'::staff_role));
create policy "employee_documents_update" on employee_documents for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "employee_documents_delete" on employee_documents for delete to authenticated
  using (has_role('hr_manager'::staff_role));

-- leave_types: reference list, staff-wide read (like other masters).
alter table leave_types enable row level security;
create policy "leave_types_select" on leave_types for select to authenticated using (is_staff());
create policy "leave_types_insert" on leave_types for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "leave_types_update" on leave_types for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "leave_types_delete" on leave_types for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table leave_requests enable row level security;
create policy "leave_requests_select" on leave_requests for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "leave_requests_insert" on leave_requests for insert to authenticated
  with check (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
-- hr_manager can move a request to any status (approve/reject); a staff
-- member can only withdraw their own *pending* request, never approve it
-- themselves â€” kept as two separate policies (OR'd together by Postgres)
-- rather than one combined check, so "approve" isn't reachable via self.
create policy "leave_requests_update_hr" on leave_requests for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "leave_requests_update_self_cancel" on leave_requests for update to authenticated
  using (is_own_employee(employee_id) and status = 'pending')
  with check (is_own_employee(employee_id) and status = 'cancelled');
create policy "leave_requests_delete" on leave_requests for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

alter table leave_balances enable row level security;
create policy "leave_balances_select" on leave_balances for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "leave_balances_insert" on leave_balances for insert to authenticated
  with check (has_role('hr_manager'::staff_role));
create policy "leave_balances_update" on leave_balances for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "leave_balances_delete" on leave_balances for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

alter table attendance_logs enable row level security;
create policy "attendance_logs_select" on attendance_logs for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "attendance_logs_insert" on attendance_logs for insert to authenticated
  with check (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "attendance_logs_update" on attendance_logs for update to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id))
  with check (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "attendance_logs_delete" on attendance_logs for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

create trigger audit_employees after insert or update or delete on employees
  for each row execute function log_audit_event();
create trigger audit_leave_requests after insert or update or delete on leave_requests
  for each row execute function log_audit_event();
