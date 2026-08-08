-- Nurse-POV deep-dive: ipd_progress_notes was hard-restricted to doctor
-- inserts at the RLS level, so nurses had no way to chart any free-text
-- nursing note (only numeric vitals and medication administration logs).
-- Add a note_type so the same table can carry both, and let nurses insert
-- their own nursing notes without opening the door to them writing doctor
-- notes.

alter table ipd_progress_notes add column note_type text not null default 'doctor' check (note_type in ('doctor', 'nursing'));

drop policy "ipd_progress_notes_insert" on ipd_progress_notes;
create policy "ipd_progress_notes_insert" on ipd_progress_notes for insert to authenticated
  with check (
    (note_type = 'doctor' and has_role('doctor'::staff_role))
    or (note_type = 'nursing' and has_role('nurse'::staff_role, 'doctor'::staff_role))
  );
