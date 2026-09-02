-- Insurance/TPA formal eligibility, query/resubmission tracking, and
-- reconciliation — closes a P1 gap from the audit report. insurance_claims
-- previously had a bare status label and no structured eligibility data,
-- no way to record a TPA query and its resubmission, and no way to
-- reconcile what was actually received against what was approved.

alter table insurance_claims drop constraint insurance_claims_status_check;
alter table insurance_claims add constraint insurance_claims_status_check
  check (status in ('eligibility_check', 'pre_auth_requested', 'query_raised', 'resubmitted', 'approved', 'rejected', 'settled'));

alter table insurance_claims add column sum_insured numeric(12,2);
alter table insurance_claims add column room_rent_limit numeric(12,2);
alter table insurance_claims add column co_pay_percent numeric(5,2);
alter table insurance_claims add column eligibility_verified boolean not null default false;
alter table insurance_claims add column eligibility_verified_at timestamptz;

-- Reconciliation: what the TPA actually paid vs. what was approved.
-- Deliberately one settlement record per claim (not a payments ledger) —
-- TPA claims in this hospital settle once, and a variance/deduction is
-- what staff need to see, not a running balance.
alter table insurance_claims add column settled_amount numeric(12,2);
alter table insurance_claims add column settled_at timestamptz;
alter table insurance_claims add column deduction_amount numeric(12,2);
alter table insurance_claims add column deduction_reason text;

-- One row per TPA query raised against a claim, so a claim that goes back
-- and forth several times has a real trail instead of overwriting the
-- same "notes" field each round.
create table insurance_claim_queries (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references insurance_claims(id) on delete cascade,
  query_text text not null,
  raised_at timestamptz not null default now(),
  resubmission_notes text,
  resubmitted_at timestamptz,
  resolved boolean not null default false,
  logged_by uuid references profiles(id)
);

create index insurance_claim_queries_claim_id_idx on insurance_claim_queries(claim_id);

alter table insurance_claim_queries enable row level security;

create policy "insurance_claim_queries_select" on insurance_claim_queries for select to authenticated using (is_staff());
create policy "insurance_claim_queries_insert" on insurance_claim_queries for insert to authenticated with check (has_role('insurance_desk'::staff_role));
create policy "insurance_claim_queries_update" on insurance_claim_queries for update to authenticated using (has_role('insurance_desk'::staff_role)) with check (has_role('insurance_desk'::staff_role));
create policy "insurance_claim_queries_delete" on insurance_claim_queries for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_insurance_claim_queries after insert or update or delete on insurance_claim_queries for each row execute function log_audit_event();
