-- Enforce non-negative billing amounts at the database layer, so a client-side
-- bug or a direct API call can't produce a negative line item or bill total.
alter table bills
  add constraint bills_subtotal_nonneg check (subtotal >= 0),
  add constraint bills_discount_nonneg check (discount >= 0),
  add constraint bills_tax_nonneg check (tax >= 0),
  add constraint bills_insurance_covered_nonneg check (insurance_covered >= 0),
  add constraint bills_total_amount_nonneg check (total_amount >= 0),
  add constraint bills_amount_paid_nonneg check (amount_paid >= 0);

alter table bill_items
  add constraint bill_items_quantity_positive check (quantity > 0),
  add constraint bill_items_unit_price_nonneg check (unit_price >= 0),
  add constraint bill_items_amount_nonneg check (amount >= 0);
