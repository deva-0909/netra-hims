import type { StaffRole } from '../lib/types';

export interface RoleNav {
  patients: boolean;
  appointments: boolean;
  waitingBoard: boolean;
  journeys: string[];   // clinic module keys visible in "Patient Journeys"
  support: string[];    // 'pharmacy' | 'pharmacy_inventory' | 'optical' | 'optical_inventory' | 'billing' | 'insurance' | 'mrd'
}

const ALL_JOURNEYS = ['general', 'retina', 'glaucoma', 'lasik', 'pediatric'];
const ALL_SUPPORT = ['pharmacy', 'pharmacy_inventory', 'optical', 'optical_inventory', 'billing', 'insurance', 'mrd_requests', 'mrd_mlc', 'mrd_completion', 'eye_bank_donors', 'eye_bank_tissues', 'emergency_triage', 'outreach_camps'];

export const ROLE_NAV: Record<StaffRole, RoleNav> = {
  admin: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: ALL_SUPPORT },

  // Front desk: registers patients, books/checks in appointments, and can open
  // any clinic queue to hand a patient off. Also handles emergency intake and
  // outreach camp coordination — both front-line/logistics tasks that fit
  // naturally with reception rather than needing their own dedicated roles.
  reception: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: ['emergency_triage', 'outreach_camps'] },

  // Clinical pre-testing staff: general OPD only (vision test, refraction, IOP, imaging).
  optometrist: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: [] },

  // Doctors move across every clinic they consult in, and can also perform
  // emergency triage since urgent cases often arrive straight to a doctor.
  doctor: { patients: true, appointments: false, waitingBoard: false, journeys: ALL_JOURNEYS, support: ['emergency_triage'] },

  // Nursing: general ward/OT-adjacent care, plus emergency triage intake.
  nurse: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage'] },
  ot_staff: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage'] },

  // Single-purpose support desks: only their own queue, no patient/journey access.
  pharmacist: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['pharmacy', 'pharmacy_inventory'] },
  optical: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['optical', 'optical_inventory'] },
  billing: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['billing'] },
  insurance_desk: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['insurance'] },

  // MRD (Medical Records Department): manages record disclosure and MLC
  // registers, and per explicit instruction has full visibility — patients,
  // every clinic journey (read/reference), and their own MRD module — no
  // restriction on what they can see, unlike the single-purpose desks above.
  mrd: { patients: true, appointments: false, waitingBoard: false, journeys: ALL_JOURNEYS, support: ['mrd_requests', 'mrd_mlc', 'mrd_completion'] },

  // Eye Bank: donor identity and serology data is unusually sensitive, so
  // this stays a genuinely single-purpose desk like pharmacy/billing, not
  // broadened to patients/journeys.
  eye_bank: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['eye_bank_donors', 'eye_bank_tissues'] },
};
