import type { StaffRole } from '../lib/types';

export interface RoleNav {
  patients: boolean;
  appointments: boolean;
  waitingBoard: boolean;
  journeys: string[];   // clinic module keys visible in "Patient Journeys"
  support: string[];    // 'pharmacy' | 'pharmacy_inventory' | 'optical' | 'optical_inventory' | 'billing' | 'insurance' | 'mrd' | 'ipd_ward' | 'workforce' | 'hr_employees' | 'equipment_assets' | 'procurement_stores' | 'cssd_housekeeping' | 'quality_compliance' | 'appointment_requests'
}

const ALL_JOURNEYS = ['general', 'retina', 'glaucoma', 'lasik', 'cornea', 'oculoplasty', 'uveitis', 'low_vision', 'pediatric'];
const ALL_SUPPORT = ['pharmacy', 'pharmacy_inventory', 'optical', 'optical_inventory', 'billing', 'insurance', 'mrd_requests', 'mrd_mlc', 'mrd_completion', 'eye_bank_donors', 'eye_bank_tissues', 'emergency_triage', 'outreach_camps', 'ipd_ward', 'workforce', 'hr_employees', 'equipment_assets', 'procurement_stores', 'cssd_housekeeping', 'quality_compliance', 'appointment_requests', 'follow_ups', 'clinical_recalls', 'ot_schedule', 'laboratory', 'device_integration', 'finance'];

// Laboratory — mirrors exactly the roles the lab_orders_select RLS policy
// grants read access to, so the nav never offers a screen the database
// would then refuse to serve.
const LABORATORY = ['laboratory'];

// Follow-ups Due is only actionable for the roles the follow_ups RLS update
// policy actually grants (reception, doctor, nurse) — appended to those
// rather than every role that can merely read the underlying table, since a
// status dropdown that silently fails on save would be worse than not
// showing the screen at all.
const FOLLOW_UPS = ['follow_ups'];

// Clinical Recalls — injection-due, glaucoma-review-due, surgery-advised-
// not-converted, LASIK-pending. Read access mirrors is_staff() (all four
// source tables), but appended alongside FOLLOW_UPS since the "Create
// follow-up" action needs the same follow_ups insert roles anyway, and
// the two screens are used together for the same recall-calling workflow.
const CLINICAL_RECALLS = ['clinical_recalls'];

// OT Schedule — the actual OT team: doctors, nurses, OT staff. Not reception/
// billing/insurance_desk (they already see IPD ward context via IPD_WARD).
const OT_SCHEDULE = ['ot_schedule'];

// IPD / Ward Management — mirrors exactly the roles the admissions_select
// RLS policy already grants read access to (reception, optometrist, doctor,
// nurse, ot_staff, mrd, billing, insurance_desk), so the nav never offers a
// screen the database would then refuse to serve.
const IPD_WARD = ['ipd_ward'];

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
  reception: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: ['emergency_triage', 'outreach_camps', 'appointment_requests', ...IPD_WARD, ...WORKFORCE, ...FOLLOW_UPS, ...CLINICAL_RECALLS] },

  // Clinical pre-testing staff: general OPD only (vision test, refraction, IOP, imaging).
  optometrist: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: [...IPD_WARD, ...WORKFORCE, ...LABORATORY, 'device_integration'] },

  // Doctors move across every clinic they consult in, and can also perform
  // emergency triage since urgent cases often arrive straight to a doctor.
  doctor: { patients: true, appointments: false, waitingBoard: false, journeys: ALL_JOURNEYS, support: ['emergency_triage', ...IPD_WARD, ...WORKFORCE, ...FOLLOW_UPS, ...CLINICAL_RECALLS, ...OT_SCHEDULE, ...LABORATORY, 'device_integration'] },

  // Nursing: general ward/OT-adjacent care, plus emergency triage intake.
  // Also the ones who actually run CSSD sterilization cycles, so they get
  // that desk too, distinct from store_keeper's housekeeping/waste remit.
  // IPD/Ward Management is core to nursing/OT work — admissions, bed board,
  // ward vitals charting, discharge.
  nurse: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage', 'cssd_housekeeping', ...IPD_WARD, ...WORKFORCE, ...FOLLOW_UPS, ...CLINICAL_RECALLS, ...OT_SCHEDULE, ...LABORATORY] },
  ot_staff: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage', 'cssd_housekeeping', ...IPD_WARD, ...WORKFORCE, ...OT_SCHEDULE, ...LABORATORY] },

  // Single-purpose support desks: only their own queue, no patient/journey access.
  pharmacist: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['pharmacy', 'pharmacy_inventory', ...WORKFORCE] },
  optical: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['optical', 'optical_inventory', ...WORKFORCE] },
  billing: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['billing', ...IPD_WARD, ...WORKFORCE] },
  insurance_desk: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['insurance', ...IPD_WARD, ...WORKFORCE] },

  // MRD (Medical Records Department): manages record disclosure and MLC
  // registers, and per explicit instruction has full visibility — patients,
  // every clinic journey (read/reference), and their own MRD module — no
  // restriction on what they can see, unlike the single-purpose desks above.
  mrd: { patients: true, appointments: false, waitingBoard: false, journeys: ALL_JOURNEYS, support: ['mrd_requests', 'mrd_mlc', 'mrd_completion', ...IPD_WARD, ...WORKFORCE, ...LABORATORY] },

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
  biomedical_engineer: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['equipment_assets', 'device_integration', ...WORKFORCE] },

  // Store keeper: procurement, vendors, general stores, and — since there's
  // no separate facilities role — housekeeping and biomedical waste too.
  // Sterilization cycles stay with nurse/ot_staff above (sterile processing
  // is a clinical task; store_keeper's remit is logistics, not clinical care).
  store_keeper: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['procurement_stores', 'cssd_housekeeping', ...WORKFORCE] },

  // Quality manager: incident reporting and regulatory license/compliance
  // tracking (AERB laser licences, biomedical waste authorization, NABH).
  quality_manager: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['quality_compliance', 'mrd_completion', ...WORKFORCE, ...LABORATORY] },

  // Lab technician: owns the test catalog, order/sample/result workflow —
  // a single-purpose desk like pharmacy/billing. Also reconciles incoming
  // device readings for lab_result-type readings.
  lab_technician: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: [...LABORATORY, 'device_integration', ...WORKFORCE] },

  // Accountant: general ledger, expenses, chart of accounts, P&L/balance
  // sheet — a single-purpose desk like pharmacy/billing.
  accountant: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['finance', ...WORKFORCE] },
};
