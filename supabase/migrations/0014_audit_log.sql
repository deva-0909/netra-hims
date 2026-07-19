create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb
);

alter table audit_log enable row level security;
create policy "audit_log_select" on audit_log for select to authenticated using (has_role(variadic array[]::staff_role[]));

create or replace function log_audit_event() returns trigger as $$
begin
  insert into audit_log (table_name, record_id, action, changed_by, old_value, new_value)
  values (
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) else null end
  );
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer set search_path = public;

create trigger audit_bills after insert or update or delete on bills
  for each row execute function log_audit_event();
create trigger audit_insurance_claims after insert or update or delete on insurance_claims
  for each row execute function log_audit_event();
create trigger audit_profiles after update on profiles
  for each row execute function log_audit_event();
