import type { StaffRole } from './types';
import { ROLE_NAV } from '../modules/roleNav';

// Paths reachable by every logged-in staff member regardless of role.
const ALWAYS_ALLOWED = new Set(['/']);

// Support-module paths mapped to the ROLE_NAV.support key that must be
// present for a role to reach them — mirrors Layout.tsx's SUPPORT_META so
// the sidebar and the route guard can never disagree about who sees what.
const SUPPORT_PATH_TO_KEY: Record<string, string> = {
  '/pharmacy': 'pharmacy',
  '/pharmacy/inventory': 'pharmacy_inventory',
  '/optical': 'optical',
  '/optical/inventory': 'optical_inventory',
  '/billing': 'billing',
  '/billing/collections': 'billing',
  '/insurance': 'insurance',
  '/mrd/requests': 'mrd_requests',
  '/mrd/mlc': 'mrd_mlc',
  '/mrd/completion': 'mrd_completion',
  '/eye-bank/donors': 'eye_bank_donors',
  '/eye-bank/tissues': 'eye_bank_tissues',
  '/emergency-triage': 'emergency_triage',
  '/outreach-camps': 'outreach_camps',
  '/ipd': 'ipd_ward',
  '/workforce': 'workforce',
  '/admin/employees': 'hr_employees',
  '/admin/equipment': 'equipment_assets',
  '/admin/procurement': 'procurement_stores',
  '/cssd-housekeeping': 'cssd_housekeeping',
  '/admin/quality': 'quality_compliance',
  '/appointment-requests': 'appointment_requests',
  '/follow-ups': 'follow_ups',
  '/ot-schedule': 'ot_schedule',
  '/laboratory': 'laboratory',
  '/device-integration': 'device_integration',
  '/finance': 'finance',
};

// Admin-only screens — staff/role management, hospital-wide settings,
// masters, templates, reports, audit log and the command center. Matches
// Layout.tsx's `profile?.role === 'admin'` gate on the Administration section.
const ADMIN_ONLY_PATHS = new Set([
  '/admin/command-center', '/admin/staff', '/admin/departments', '/admin/settings',
  '/admin/masters', '/admin/templates', '/admin/reports', '/admin/audit-log', '/admin/branches',
]);

/** Layer-2 route guard: is `role` allowed to view `pathname` at all, independent
 * of whether the sidebar happens to link there? Mirrors ROLE_NAV so a role
 * that can't see a module in the sidebar can't reach it by typing the URL
 * either — the sidebar was previously the only thing hiding these screens. */
export function canAccessRoute(role: StaffRole | undefined, pathname: string): boolean {
  if (!role) return false;
  if (ALWAYS_ALLOWED.has(pathname)) return true;

  const nav = ROLE_NAV[role];
  if (!nav) return false;

  if (ADMIN_ONLY_PATHS.has(pathname)) return role === 'admin';

  const supportKey = SUPPORT_PATH_TO_KEY[pathname];
  if (supportKey) return nav.support.includes(supportKey);

  if (pathname === '/patients' || pathname.startsWith('/patients/')) return nav.patients;
  if (pathname === '/appointments') return nav.appointments;
  if (pathname === '/waiting-room') return nav.waitingBoard;

  if (pathname.startsWith('/journeys/')) {
    const moduleKey = pathname.split('/')[2];
    return nav.journeys.includes(moduleKey);
  }

  if (pathname.startsWith('/visits/')) {
    // The visit workspace exposes a patient's full chart across every
    // clinical stage — reserved for roles that work directly with patients
    // or a clinic journey, plus billing/insurance_desk, who reach it
    // specifically for the "Generate Claim File" button in the page header
    // (see GenerateClaimFileButton.tsx's own ALLOWED_ROLES). Every other
    // single-purpose desk (pharmacy, optical, eye bank, HR, biomedical,
    // stores, quality) never links here and works entirely through its own
    // queue/desk page instead.
    return nav.patients || nav.journeys.length > 0 || nav.support.includes('billing') || nav.support.includes('insurance');
  }

  return false;
}
