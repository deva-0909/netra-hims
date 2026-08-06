-- ============================================================
-- NETRA HIMS — OPD consultation fee master (gate: pay before token)
--
-- Indian OPD practice is to collect the consultation charge in advance,
-- before the token is issued — "Start a new visit" / appointment check-in
-- previously generated a token with zero payment step. A small fee master,
-- editable by admin, is enough to gate token issuance on payment.
-- ============================================================

create table consultation_fees (
  clinic_module text primary key,
  fee numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table consultation_fees enable row level security;
create policy consultation_fees_select on consultation_fees for select using (is_staff());
create policy consultation_fees_insert on consultation_fees for insert with check (has_role(variadic array[]::staff_role[]));
create policy consultation_fees_update on consultation_fees for update using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy consultation_fees_delete on consultation_fees for delete using (has_role(variadic array[]::staff_role[]));

insert into consultation_fees (clinic_module, fee) values
('general', 500), ('retina', 800), ('glaucoma', 700), ('lasik', 1000), ('pediatric', 600);
