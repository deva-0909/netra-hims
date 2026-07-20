import type { StaffRole } from '../lib/types';

export interface RoleNav {
  patients: boolean;
  appointments: boolean;
  waitingBoard: boolean;
  journeys: string[];   // clinic module keys visible in "Patient Journeys"
  support: string[];    // 'pharmacy' | 'pharmacy_inventory' | 'optical' | 'optical_inventory' | 'billing' | 'insurance' | 'mrd'
}

const ALL_JOURNEYS = ['general', 'retina', 'glaucoma', 'lasik', 'pediatric'];
const ALL_SUPPORT = ['pharmacy', 'pharmacy_inventory', 'optical', 'optical_inventory', 'billing', 'insurance', 'mrd_requests', 'mrd_mlc', 'mrd_completion'];

export const ROLE_NAV: Record<StaffRole, RoleNav> = {
  admin: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: ALL_SUPPORT },

  // Front desk: registers patients, books/checks in appointments, and can open
  // any clinic queue to hand a patient off, but doesn't touch clinical entry.
  reception: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: [] },

  // Clinical pre-testing staff: general OPD only (vision test, refraction, IOP, imaging).
  optometrist: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: [] },

  // Doctors move across every clinic they consult in.
  doctor: { patients: true, appointments: false, waitingBoard: false, journeys: ALL_JOURNEYS, support: [] },

  // Nursing: general ward/OT-adjacent care.
  nurse: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: [] },
  ot_staff: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: [] },

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
};
