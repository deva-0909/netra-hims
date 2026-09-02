-- New role for the Financial Accounting / General Ledger module. Kept as
-- its own migration since adding an enum value can't share a transaction
-- with code that uses the new value.
alter type staff_role add value if not exists 'accountant';
