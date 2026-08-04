import type { StaffRole } from '../lib/types';

export interface RoleNav {
  patients: boolean;
  appointments: boolean;
  waitingBoard: boolean;
  journeys: string[];   // clinic module keys visible in "Patient Journeys"
  support: string[];    // 'pharmacy' | 'pharmacy_inventory' | 'optical' | 'optical_inventory' | 'billing' | 'insurance' | 'mrd' | 'workforce' | 'hr_employees' | 'equipment_assets' | 'procurement_stores' | 'cssd_housekeeping'
}

const ALL_JOURNEYS = ['general', 'retina', 'glaucoma', 'lasik', 'pediatric'];
const ALL_SUPPORT = ['pharmacy', 'pharmacy_inventory', 'optical', 'optical_inventory', 'billing', 'insurance', 'mrd_requests', 'mrd_mlc', 'mrd_completion', 'eye_bank_donors', 'eye_bank_tissues', 'emergency_triage', 'outreach_camps', 'workforce', 'hr_employees', 'equipment_assets', 'procurement_stores', 'cssd_housekeeping'];

// 'Workforce' (attendance, leave, duty roster) is every staff member's own
// business — everyone clocks in, everyone can request leave, everyone needs
// to see the roster — so it's appended to every role below rather than
// gated like the single-purpose desks.
const WORKFORCE = ['workforce'];

export const ROLE_NAV: Record<StaffRole, RoleNav> = {
  admin: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: ALL_SUPPORT },

  // Front desk: registers patients, books/checks in appointments, and can open
  // any clinic queue to hand a patient off. Also handles emergency intake and
  // outreach camp coordination — both front-line/logistics tasks that fit
  // naturally with reception rather than needing their own dedicated roles.
  reception: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: ['emergency_triage', 'outreach_camps', ...WORKFORCE] },

  // Clinical pre-testing staff: general OPD only (vision test, refraction, IOP, imaging).
  optometrist: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: [...WORKFORCE] },

  // Doctors move across every clinic they consult in, and can also perform
  // emergency triage since urgent cases often arrive straight to a doctor.
  doctor: { patients: true, appointments: false, waitingBoard: false, journeys: ALL_JOURNEYS, support: ['emergency_triage', ...WORKFORCE] },

  // Nursing: general ward/OT-adjacent care, plus emergency triage intake.
  // Also the ones who actually run CSSD sterilization cycles, so they get
  // that desk too, distinct from store_keeper's housekeeping/waste remit.
  nurse: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage', 'cssd_housekeeping', ...WORKFORCE] },
  ot_staff: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage', 'cssd_housekeeping', ...WORKFORCE] },

  // Single-purpose support desks: only their own queue, no patient/journey access.
  pharmacist: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['pharmacy', 'pharmacy_inventory', ...WORKFORCE] },
  optical: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['optical', 'optical_inventory', ...WORKFORCE] },
  billing: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['billing', ...WORKFORCE] },
  insurance_desk: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['insurance', ...WORKFORCE] },

  // MRD (Medical Records Department): manages record disclosure and MLC
  // registers, and per explicit instruction has full visibility — patients,
  // every clinic journey (read/reference), and their own MRD module — no
  // restriction on what they can see, unlike the single-purpose desks above.
  mrd: { patients: true, appointments: false, waitingBoard: false, journeys: ALL_JOURNEYS, support: ['mrd_requests', 'mrd_mlc', 'mrd_completion', ...WORKFORCE] },

  // Eye Bank: donor identity and serology data is unusually sensitive, so
  // this stays a genuinely single-purpose desk like pharmacy/billing, not
  // broadened to patients/journeys.
  eye_bank: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['eye_bank_donors', 'eye_bank_tissues', ...WORKFORCE] },

  // HR Manager: runs employee records, leave approvals, attendance and the
  // duty roster hospital-wide — a single-purpose desk like pharmacy/billing,
  // plus the same Workforce self-service tab every role gets.
  hr_manager: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['hr_employees', ...WORKFORCE] },

  // Biomedical engineer: owns the equipment asset register (and, from Phase 2
  // onward, its maintenance/calibration schedules).
  biomedical_engineer: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['equipment_assets', ...WORKFORCE] },

  // Store keeper: procurement, vendors, general stores, and — since there's
  // no separate facilities role — housekeeping and biomedical waste too.
  // Sterilization cycles stay with nurse/ot_staff above (sterile processing
  // is a clinical task; store_keeper's remit is logistics, not clinical care).
  store_keeper: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['procurement_stores', 'cssd_housekeeping', ...WORKFORCE] },
};
