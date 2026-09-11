-- Mirrors 0091's prescription_items.dispensed flag, for the same reason:
-- updateOpticalOrderStatus() deducts frame stock, THEN inserts a ledger row,
-- THEN updates the order's status. If the ledger insert fails after the
-- stock update already succeeded, the function returns an error without
-- ever setting status='dispensed' — so a retry (after fixing whatever broke
-- the ledger insert) re-runs the stock check/deduction from scratch,
-- double-deducting the frame. Confirmed live: frame stock went 5 -> 4 (first
-- attempt, ledger insert failed) -> 3 (retry, ledger succeeded) instead of
-- landing on the correct 4.
alter table optical_orders add column stock_deducted boolean not null default false;
