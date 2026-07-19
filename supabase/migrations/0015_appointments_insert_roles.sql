drop policy "appointments_insert" on appointments;
create policy "appointments_insert" on appointments for insert to authenticated
  with check (has_role('reception'::staff_role, 'optometrist'::staff_role, 'doctor'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role));
