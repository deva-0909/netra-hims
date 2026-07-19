-- ============================================================
-- NETRA HIMS — Security lint fixes
-- ============================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

revoke execute on function is_staff() from anon;
revoke execute on function is_staff() from public;
grant execute on function is_staff() to authenticated;
