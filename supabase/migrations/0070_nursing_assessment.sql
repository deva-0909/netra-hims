-- Structured nursing assessment — closes a gap from the audit report
-- (section 4.16, IPD & Nursing). ward_vitals already captures numeric
-- vitals, and ipd_progress_notes already gives nurses a free-text
-- note/handover mechanism (note_type='nursing') — this adds the
-- structured fields neither of those covers: fall risk, pain score, and
-- fluid intake/output. Mirrors ward_vitals exactly (same insert roles,
-- same admission_id shape).

create table nursing_assessments (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id),
  fall_risk text check (fall_risk in ('low', 'moderate', 'high')),
  pain_score integer check (pain_score between 0 and 10),
  intake_ml numeric,
  output_ml numeric,
  mobility_status text,
  notes text,
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);

create index nursing_assessments_admission_id_idx on nursing_assessments(admission_id);

alter table nursing_assessments enable row level security;

create policy "nursing_assessments_select" on nursing_assessments for select to authenticated using (is_staff());
create policy "nursing_assessments_insert" on nursing_assessments for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "nursing_assessments_update" on nursing_assessments for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));
create policy "nursing_assessments_delete" on nursing_assessments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_nursing_assessments after insert or update or delete on nursing_assessments for each row execute function log_audit_event();
