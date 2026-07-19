import type { StaffRole } from '../lib/types';

export interface RoleNav {
  patients: boolean;
  appointments: boolean;
  journeys: string[];   // clinic module keys visible in "Patient Journeys"
  support: string[];    // 'pharmacy' | 'optical' | 'billing' | 'insurance'
}

const ALL_JOURNEYS = ['general', 'retina', 'glaucoma', 'lasik', 'pediatric'];
const ALL_SUPPORT = ['pharmacy', 'optical', 'billing', 'insurance'];

export const ROLE_NAV: Record<StaffRole, RoleNav> = {
  admin: { patients: true, appointments: true, journeys: ALL_JOURNEYS, support: ALL_SUPPORT },

  // Front desk: registers patients, books/checks in appointments, and can open
  // any clinic queue to hand a patient off, but doesn't touch clinical entry.
  reception: { patients: true, appointments: true, journeys: ALL_JOURNEYS, support: [] },

  // Clinical pre-testing staff: general OPD only (vision test, refraction, IOP, imaging).
  optometrist: { patients: true, appointments: false, journeys: ['general'], support: [] },

  // Doctors move across every clinic they consult in.
  doctor: { patients: true, appointments: false, journeys: ALL_JOURNEYS, support: [] },

  // Nursing: general ward/OT-adjacent care.
  nurse: { patients: true, appointments: false, journeys: ['general'], support: [] },
  ot_staff: { patients: true, appointments: false, journeys: ['general'], support: [] },

  // Single-purpose support desks: only their own queue, no patient/journey access.
  pharmacist: { patients: false, appointments: false, journeys: [], support: ['pharmacy'] },
  optical: { patients: false, appointments: false, journeys: [], support: ['optical'] },
  billing: { patients: false, appointments: false, journeys: [], support: ['billing'] },
  insurance_desk: { patients: false, appointments: false, journeys: [], support: ['insurance'] },
};
