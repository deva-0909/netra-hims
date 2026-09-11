-- AdminHospitalSettingsPage only ever knew how to UPDATE the hospital_settings
-- row, and this table had no INSERT policy at all. On a fresh install (zero
-- rows), the page got stuck showing "Loading..." forever with no way to ever
-- create the first row — this demo instance is seeded so it didn't show up
-- there, but any genuinely new deployment would hit it immediately. Paired
-- with the AdminHospitalSettingsPage.tsx fix that now inserts when no row
-- exists yet.
create policy hospital_settings_insert on hospital_settings for insert to authenticated
  with check (has_role(variadic array[]::staff_role[]));
