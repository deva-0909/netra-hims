-- Critical fix: the public "Register staff" flow lets any visitor create their own
-- profiles row via `profiles_self_insert` (with_check: id = auth.uid()). Nothing
-- restricted which role they could pick, and the UI's role dropdown offered
-- 'admin' as an option — so anyone could self-register as an admin and get full
-- system access. `trg_prevent_self_role_escalation` only fires on UPDATE, not
-- INSERT, so it didn't cover this path. Block admin at the RLS layer so this is
-- enforced regardless of what the client sends.
drop policy profiles_self_insert on profiles;
create policy profiles_self_insert on profiles for insert to authenticated
  with check (id = auth.uid() and role <> 'admin'::staff_role);
