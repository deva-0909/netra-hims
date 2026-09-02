-- Optical lab job-card workflow and warranty/repair tracking — closes a
-- P1 gap from the audit report. optical_orders.status (ordered ->
-- in_fabrication -> ready -> dispensed) is a coarse business-flow field
-- used for billing/dispensing gating and stays as-is; this adds a
-- granular manufacturing-floor checklist alongside it (who cut the
-- lens, who fitted it, who did QC, who handed it over — with
-- timestamps), plus a repair/warranty claim log that didn't exist at
-- all before.

create table optical_job_card_stages (
  id uuid primary key default gen_random_uuid(),
  optical_order_id uuid not null references optical_orders(id) on delete cascade,
  stage text not null check (stage in ('cutting', 'fitting', 'quality_check', 'ready_for_delivery', 'delivered')),
  completed_by uuid references profiles(id),
  completed_at timestamptz not null default now(),
  notes text,
  unique (optical_order_id, stage)
);

create table optical_repairs (
  id uuid primary key default gen_random_uuid(),
  optical_order_id uuid not null references optical_orders(id) on delete cascade,
  issue_description text not null,
  reported_at timestamptz not null default now(),
  warranty_covered boolean not null default false,
  repair_status text not null default 'reported' check (repair_status in ('reported', 'in_repair', 'repaired', 'replaced', 'not_covered')),
  resolved_at timestamptz,
  resolution_notes text,
  handled_by uuid references profiles(id)
);

create index optical_job_card_stages_order_id_idx on optical_job_card_stages(optical_order_id);
create index optical_repairs_order_id_idx on optical_repairs(optical_order_id);

alter table optical_job_card_stages enable row level security;
alter table optical_repairs enable row level security;

-- Mirrors optical_orders exactly (optical role only).
create policy "optical_job_card_stages_select" on optical_job_card_stages for select to authenticated using (is_staff());
create policy "optical_job_card_stages_insert" on optical_job_card_stages for insert to authenticated with check (has_role('optical'::staff_role));
create policy "optical_job_card_stages_update" on optical_job_card_stages for update to authenticated using (has_role('optical'::staff_role)) with check (has_role('optical'::staff_role));
create policy "optical_job_card_stages_delete" on optical_job_card_stages for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create policy "optical_repairs_select" on optical_repairs for select to authenticated using (is_staff());
create policy "optical_repairs_insert" on optical_repairs for insert to authenticated with check (has_role('optical'::staff_role));
create policy "optical_repairs_update" on optical_repairs for update to authenticated using (has_role('optical'::staff_role)) with check (has_role('optical'::staff_role));
create policy "optical_repairs_delete" on optical_repairs for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_optical_job_card_stages after insert or update or delete on optical_job_card_stages for each row execute function log_audit_event();
create trigger audit_optical_repairs after insert or update or delete on optical_repairs for each row execute function log_audit_event();
