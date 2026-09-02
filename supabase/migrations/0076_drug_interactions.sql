-- Drug-interaction and allergy alerting — closes a P1 gap from the audit
-- report (Pharmacy). A curated, hospital-maintainable list of known
-- interaction pairs (not an attempt at a full national drug-interaction
-- database, which is unrealistic to build here) plus a free-text
-- known_allergies substring check against the drug name being
-- prescribed. Both are advisory warnings shown while writing a
-- prescription, never a hard block — consistent with every other
-- clinical-safety check added this session (pre-op assessment, WHO
-- safety checklist).

create table drug_interactions (
  id uuid primary key default gen_random_uuid(),
  drug_a_id uuid not null references drugs(id) on delete cascade,
  drug_b_id uuid not null references drugs(id) on delete cascade,
  severity text not null default 'moderate' check (severity in ('moderate', 'severe')),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (drug_a_id <> drug_b_id)
);

-- Prevents both (A,B) and (B,A) being entered as separate rows for the
-- same pair — uuid is byte-orderable so least/greatest gives a stable
-- canonical ordering regardless of which drug was picked as "a" or "b".
create unique index drug_interactions_pair_idx on drug_interactions (least(drug_a_id, drug_b_id), greatest(drug_a_id, drug_b_id));

alter table drug_interactions enable row level security;

create policy "drug_interactions_select" on drug_interactions for select to authenticated using (is_staff());
create policy "drug_interactions_insert" on drug_interactions for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "drug_interactions_update" on drug_interactions for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "drug_interactions_delete" on drug_interactions for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_drug_interactions after insert or update or delete on drug_interactions for each row execute function log_audit_event();
