-- optical_orders_insert only allowed role='optical', but the "Place optical
-- order" form (OpticalStage.tsx) is embedded in the visit workspace
-- specifically so a doctor/optometrist can record the Rx (sphere/cylinder/
-- axis) during a consultation. routeAccess.ts + roleNav.ts structurally keep
-- the 'optical' role OUT of the visit workspace entirely (nav.patients=false,
-- nav.journeys=[]) — it works through its own /optical queue page instead
-- (OpticalQueuePage.tsx, which is what optical_orders_update stays scoped to,
-- correctly). The net effect: no role that could actually see "Place optical
-- order" could ever successfully submit it. Broadened to the clinical roles
-- who write the Rx, keeping 'optical' too in case that desk also places
-- orders directly. UPDATE (dispensing) intentionally stays optical-only.
drop policy optical_orders_insert on optical_orders;
create policy optical_orders_insert on optical_orders for insert to authenticated
  with check (has_role(variadic array['doctor'::staff_role, 'optometrist'::staff_role, 'optical'::staff_role]));
