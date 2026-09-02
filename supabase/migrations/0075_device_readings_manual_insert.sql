-- device_readings previously had no insert policy for authenticated
-- users at all — only the device-ingest edge function (service role)
-- could create rows. That's correct for the normal path, but leaves no
-- way to recover a failed submission (device_ingest_failures) when the
-- fix is obvious (e.g. firmware sent "lab-result" instead of
-- "lab_result") short of asking the instrument to resend, which staff
-- can't always trigger. Mirrors device_readings_update's role set
-- exactly, so anyone who can reconcile a reading can also manually
-- recreate one from a corrected failure payload.

create policy "device_readings_insert" on device_readings for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'lab_technician'::staff_role, 'biomedical_engineer'::staff_role));
