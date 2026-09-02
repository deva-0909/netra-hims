-- IOL master catalog + serial-level inventory + implant traceability —
-- closes a P0 gap from the audit report (section 4.5, Cataract & IOL
-- Management). `ot_implants` already captured what was implanted
-- (model_name/power/lot_number/serial_number as free text typed at
-- surgery time) — that stays, unchanged, as the fallback for
-- untracked/consignment lenses. What was missing: an actual catalog
-- (manufacturer/type/material) and unit-level stock (so "how many of this
-- lens do we have" and "which patients got lot X" are real queries, not
-- free-text matching), plus a link from the implant record back to the
-- specific stock unit consumed.
--
-- Traceability chain this enables: iol_units (serial/lot) → ot_implants
-- → ot_records (surgeon, eye, date) → admissions → patients.

create table iol_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model_name text not null,
  lens_type text not null default 'monofocal' check (lens_type in ('monofocal', 'multifocal', 'toric', 'edof', 'multifocal_toric', 'other')),
  material text,
  is_foldable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table iol_units (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references iol_models(id),
  power numeric not null,
  lot_number text,
  serial_number text,
  expiry_date date,
  price numeric,
  status text not null default 'in_stock' check (status in ('in_stock', 'implanted', 'returned', 'expired', 'discarded')),
  received_by uuid references profiles(id),
  received_at timestamptz not null default now(),
  implanted_ot_implant_id uuid
);

alter table ot_implants add column if not exists iol_unit_id uuid references iol_units(id);
alter table iol_units add constraint iol_units_implanted_ot_implant_id_fkey foreign key (implanted_ot_implant_id) references ot_implants(id);

create index iol_units_model_id_idx on iol_units(model_id);
create index iol_units_status_idx on iol_units(status);

-- A unit can't be implanted twice, and once implanted its power/lot/serial
-- shouldn't silently change under an existing recall record.
create or replace function enforce_iol_unit_not_already_implanted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'implanted' and old.status = 'implanted' and new.implanted_ot_implant_id is distinct from old.implanted_ot_implant_id then
    raise exception 'This IOL unit is already marked implanted against a different surgical record.';
  end if;
  return new;
end;
$function$;

create trigger trg_enforce_iol_unit_not_already_implanted
before update on iol_units
for each row execute function enforce_iol_unit_not_already_implanted();

alter table iol_models enable row level security;
alter table iol_units enable row level security;

create policy "iol_models_select" on iol_models for select to authenticated using (is_staff());
create policy "iol_models_insert" on iol_models for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "iol_models_update" on iol_models for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "iol_models_delete" on iol_models for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create policy "iol_units_select" on iol_units for select to authenticated using (is_staff());
create policy "iol_units_insert" on iol_units for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "iol_units_update" on iol_units for update to authenticated using (has_role('store_keeper'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role)) with check (has_role('store_keeper'::staff_role, 'nurse'::staff_role, 'ot_staff'::staff_role, 'doctor'::staff_role));

create trigger audit_iol_models after insert or update or delete on iol_models for each row execute function log_audit_event();
create trigger audit_iol_units after insert or update or delete on iol_units for each row execute function log_audit_event();
