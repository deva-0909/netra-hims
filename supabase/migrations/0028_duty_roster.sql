-- ============================================================
-- NETRA HIMS — Duty roster & on-call scheduling (Domain B)
-- Unlike the HR tables in 0027, the roster itself is operational
-- information every department needs to see (who's on today, who's
-- on-call tonight) — so reads stay staff-wide, same as clinical data.
-- Only hr_manager (and admin, via has_role) can build the roster.
-- ============================================================

create table shift_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into shift_templates (name, start_time, end_time, department) values
  ('Morning — General OPD', '08:00', '14:00', 'General OPD'),
  ('Evening — General OPD', '14:00', '20:00', 'General OPD'),
  ('OT Session — Day', '08:00', '16:00', 'OT'),
  ('Night Duty', '20:00', '08:00', null),
  ('General Shift', '09:00', '17:00', null);

create table duty_rosters (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  shift_template_id uuid references shift_templates(id),
  roster_date date not null,
  department text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'absent', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, roster_date)
);
create index idx_duty_rosters_date on duty_rosters(roster_date);
create index idx_duty_rosters_employee on duty_rosters(employee_id);

create table shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references duty_rosters(id) on delete cascade,
  requester_employee_id uuid not null references employees(id) on delete cascade,
  target_employee_id uuid references employees(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_shift_swap_roster on shift_swap_requests(roster_id);

create table on_call_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  on_call_date date not null,
  department text, -- e.g. 'emergency', 'ot'
  start_time timestamptz not null,
  end_time timestamptz not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_on_call_date on on_call_schedules(on_call_date);

-- ---------- RLS ----------
alter table shift_templates enable row level security;
create policy "shift_templates_select" on shift_templates for select to authenticated using (is_staff());
create policy "shift_templates_insert" on shift_templates for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "shift_templates_update" on shift_templates for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "shift_templates_delete" on shift_templates for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table duty_rosters enable row level security;
create policy "duty_rosters_select" on duty_rosters for select to authenticated using (is_staff());
create policy "duty_rosters_insert" on duty_rosters for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "duty_rosters_update" on duty_rosters for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "duty_rosters_delete" on duty_rosters for delete to authenticated using (has_role('hr_manager'::staff_role));

alter table shift_swap_requests enable row level security;
create policy "shift_swap_requests_select" on shift_swap_requests for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(requester_employee_id) or is_own_employee(target_employee_id));
create policy "shift_swap_requests_insert" on shift_swap_requests for insert to authenticated
  with check (has_role('hr_manager'::staff_role) or is_own_employee(requester_employee_id));
-- Same split as leave_requests: only hr_manager can approve/reject a swap;
-- the requester can withdraw their own pending request, nothing more.
create policy "shift_swap_requests_update_hr" on shift_swap_requests for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "shift_swap_requests_update_self_cancel" on shift_swap_requests for update to authenticated
  using (is_own_employee(requester_employee_id) and status = 'pending')
  with check (is_own_employee(requester_employee_id) and status = 'cancelled');
create policy "shift_swap_requests_delete" on shift_swap_requests for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table on_call_schedules enable row level security;
create policy "on_call_schedules_select" on on_call_schedules for select to authenticated using (is_staff());
create policy "on_call_schedules_insert" on on_call_schedules for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "on_call_schedules_update" on on_call_schedules for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "on_call_schedules_delete" on on_call_schedules for delete to authenticated using (has_role('hr_manager'::staff_role));
