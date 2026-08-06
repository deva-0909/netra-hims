-- ============================================================
-- NETRA HIMS — Let the public demo account switch its own role
--
-- prevent_self_role_escalation (see 0007/0016-era security work) blocks any
-- non-admin from changing their own role or active flag — correct for real
-- staff, but it also blocked the sidebar's "Demo — viewing as" switcher,
-- which needs the single shared demo account to hop roles freely so
-- visitors can preview the nav for each staff type.
--
-- Fix: tag that one seeded account with is_demo_account and let the trigger
-- skip enforcement only for it. The flag itself is guarded by the same
-- has_role(admin) check as role/active, so a self-registered account can
-- never grant itself the bypass.
-- ============================================================

alter table profiles add column is_demo_account boolean not null default false;

update profiles set is_demo_account = true where id = 'ea1164d7-437b-434e-8145-0aea7af51cf4';

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.is_demo_account is distinct from old.is_demo_account
     and not has_role(VARIADIC ARRAY[]::staff_role[]) then
    raise exception 'Only an admin can change the demo-account flag.';
  end if;

  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and not old.is_demo_account
     and not has_role(VARIADIC ARRAY[]::staff_role[]) then
    raise exception 'Only an admin can change a staff member''s role or active status.';
  end if;

  return new;
end;
$function$;
