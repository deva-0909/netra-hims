-- New single-purpose desks, same pattern as mrd (0019) / eye_bank (0021):
-- hr_manager runs HR, leave, attendance and the duty roster;
-- biomedical_engineer owns the equipment asset register (and, later, its
-- maintenance/calibration schedules).
alter type staff_role add value 'hr_manager';
alter type staff_role add value 'biomedical_engineer';
