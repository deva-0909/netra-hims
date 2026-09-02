-- New role for the Laboratory/Pathology module: sample collection, result
-- entry/verification and lab-test-catalog management. Kept as its own
-- migration since adding an enum value can't share a transaction with code
-- that uses the new value.
alter type staff_role add value if not exists 'lab_technician';
