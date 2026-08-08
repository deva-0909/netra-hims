-- Pharmacist deep-dive: persist the quantity actually sent to the ward per
-- IPD medication order. Previously only a "dispensed_to_ward" boolean was
-- kept — nothing recorded how much was sent, so an accidental dispense had
-- no way to reliably credit the exact amount back to stock on undo.

alter table ipd_medication_orders add column dispensed_quantity integer;
