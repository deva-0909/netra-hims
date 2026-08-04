# Netra HIMS - Phase 4 & 5 deploy script
# Phase 4: quality/compliance (incident reports, regulatory licenses)
# Phase 5: command center dashboard + public appointment-request page
# Run from the ROOT of your local netra-hims clone (where package.json lives).
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'package.json')) { Write-Error 'Run this from the repo root (where package.json lives).'; exit 1 }
Write-Host 'Writing Phase 4 & 5 files...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path 'src\lib' | Out-Null
Set-Content -Path 'src\lib\types.ts' -Encoding UTF8 -NoNewline -Value @'
﻿export type StaffRole =
  | 'admin' | 'reception' | 'optometrist' | 'doctor' | 'nurse'
  | 'pharmacist' | 'optical' | 'billing' | 'insurance_desk' | 'ot_staff' | 'mrd' | 'eye_bank'
  | 'hr_manager' | 'biomedical_engineer' | 'store_keeper' | 'quality_manager';

export interface Profile {
  id: string;
  full_name: string;
  role: StaffRole;
  department: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export type ClinicModule = 'general' | 'retina' | 'glaucoma' | 'lasik' | 'pediatric';

export interface Patient {
  id: string;
  uhid: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_relation: string | null;
  abha_id: string | null;
  abha_verified: boolean;
  golden_card_id: string | null;
  golden_card_verified: boolean;
  insurance_provider: string | null;
  insurance_policy_no: string | null;
  insurance_verified: boolean;
  blood_group: string | null;
  known_allergies: string | null;
  notes: string | null;
  created_at: string;
}

export type AppointmentStatus =
  | 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  clinic_module: ClinicModule;
  scheduled_at: string;
  status: AppointmentStatus;
  reason: string | null;
  is_walk_in: boolean;
  token_number: string | null;
  created_at: string;
}

export type VisitStage =
  | 'registration' | 'waiting' | 'vision_test' | 'preliminary_assessment' | 'refraction'
  | 'iop' | 'imaging' | 'consultation' | 'investigation' | 'pharmacy' | 'optical'
  | 'surgery_recommended' | 'insurance_approval' | 'admission' | 'ot' | 'recovery'
  | 'billing' | 'feedback' | 'follow_up' | 'completed' | 'cancelled';

export interface Visit {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  clinic_module: ClinicModule;
  attending_doctor_id: string | null;
  stage: VisitStage;
  token_number: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

'@
Write-Host '  wrote src\lib\types.ts'

New-Item -ItemType Directory -Force -Path 'src\components' | Out-Null
Set-Content -Path 'src\components\RoleSwitcher.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import type { StaffRole } from '../lib/types';

const ROLES: StaffRole[] = [
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff', 'mrd', 'eye_bank',
  'hr_manager', 'biomedical_engineer', 'store_keeper', 'quality_manager',
];

export function RoleSwitcher() {
  const { profile, refreshProfile } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const handleChange = async (role: StaffRole) => {
    setSwitching(true);
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ role }).eq('id', profile.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      await refreshProfile();
    }
    setSwitching(false);
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent-700)', marginBottom: 4 }}>
        Demo — viewing as
      </div>
      <select
        className="input"
        value={profile.role}
        disabled={switching}
        onChange={(e) => handleChange(e.target.value as StaffRole)}
        style={{ fontSize: 13, padding: '5px 8px', minHeight: 32 }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
        ))}
      </select>
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

'@
Write-Host '  wrote src\components\RoleSwitcher.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\AdminStaffPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import type { StaffRole } from '../lib/types';

const ROLES: StaffRole[] = [
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff', 'mrd', 'eye_bank',
  'hr_manager', 'biomedical_engineer', 'store_keeper', 'quality_manager',
];

export function AdminStaffPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateRole = async (id: string, role: StaffRole) => {
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['staff'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ active: !active }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['staff'] });
  };

  return (
    <div>
      <h2>Staff Administration</h2>
      <p className="text-muted" style={{ fontSize: 13 }}>
        New staff create their own account from the login screen ("Register staff"); use this page to assign the correct role and activate/deactivate access.
      </p>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Active</th><th>Joined</th></tr></thead>
          <tbody>
            {staff?.map((s: any) => {
              const isSelf = s.id === profile?.id;
              return (
                <tr key={s.id}>
                  <td>{s.full_name}{isSelf && <span className="tag tag-outline" style={{ marginLeft: 6 }}>you</span>}</td>
                  <td>
                    <select className="input" value={s.role} onChange={(e) => updateRole(s.id, e.target.value as StaffRole)} style={{ width: 160 }}>
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    <button
                      className={`btn ${s.active ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => toggleActive(s.id, s.active)}
                      disabled={isSelf && s.active}
                      title={isSelf && s.active ? "You can't deactivate your own account — it would lock you out." : undefined}
                    >
                      {s.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\AdminStaffPage.tsx'

New-Item -ItemType Directory -Force -Path 'src\modules' | Out-Null
Set-Content -Path 'src\modules\roleNav.ts' -Encoding UTF8 -NoNewline -Value @'
import type { StaffRole } from '../lib/types';

export interface RoleNav {
  patients: boolean;
  appointments: boolean;
  waitingBoard: boolean;
  journeys: string[];   // clinic module keys visible in "Patient Journeys"
  support: string[];    // 'pharmacy' | 'pharmacy_inventory' | 'optical' | 'optical_inventory' | 'billing' | 'insurance' | 'mrd' | 'workforce' | 'hr_employees' | 'equipment_assets' | 'procurement_stores' | 'cssd_housekeeping' | 'quality_compliance' | 'appointment_requests'
}

const ALL_JOURNEYS = ['general', 'retina', 'glaucoma', 'lasik', 'pediatric'];
const ALL_SUPPORT = ['pharmacy', 'pharmacy_inventory', 'optical', 'optical_inventory', 'billing', 'insurance', 'mrd_requests', 'mrd_mlc', 'mrd_completion', 'eye_bank_donors', 'eye_bank_tissues', 'emergency_triage', 'outreach_camps', 'workforce', 'hr_employees', 'equipment_assets', 'procurement_stores', 'cssd_housekeeping', 'quality_compliance', 'appointment_requests'];

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
  reception: { patients: true, appointments: true, waitingBoard: true, journeys: ALL_JOURNEYS, support: ['emergency_triage', 'outreach_camps', 'appointment_requests', ...WORKFORCE] },

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

  // Quality manager: incident reporting and regulatory license/compliance
  // tracking (AERB laser licences, biomedical waste authorization, NABH).
  quality_manager: { patients: false, appointments: false, waitingBoard: false, journeys: [], support: ['quality_compliance', ...WORKFORCE] },
};

'@
Write-Host '  wrote src\modules\roleNav.ts'

New-Item -ItemType Directory -Force -Path 'src\components' | Out-Null
Set-Content -Path 'src\components\Layout.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, DEMO_MODE } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';
import { ROLE_NAV } from '../modules/roleNav';
import { RoleSwitcher } from './RoleSwitcher';
import { useIsMobile } from '../lib/useIsMobile';
import { ErrorBoundary } from './ErrorBoundary';

const SUPPORT_META: Record<string, { to: string; label: string }> = {
  pharmacy: { to: '/pharmacy', label: 'Pharmacy' },
  pharmacy_inventory: { to: '/pharmacy/inventory', label: 'Pharmacy Inventory' },
  optical: { to: '/optical', label: 'Optical' },
  optical_inventory: { to: '/optical/inventory', label: 'Optical Inventory' },
  billing: { to: '/billing', label: 'Billing' },
  insurance: { to: '/insurance', label: 'Insurance Desk' },
  mrd_requests: { to: '/mrd/requests', label: 'Record Requests' },
  mrd_mlc: { to: '/mrd/mlc', label: 'MLC Register' },
  mrd_completion: { to: '/mrd/completion', label: 'Completion Dashboard' },
  eye_bank_donors: { to: '/eye-bank/donors', label: 'Eye Bank — Donors' },
  eye_bank_tissues: { to: '/eye-bank/tissues', label: 'Eye Bank — Tissues' },
  emergency_triage: { to: '/emergency-triage', label: 'Emergency Triage' },
  outreach_camps: { to: '/outreach-camps', label: 'Outreach Camps' },
  workforce: { to: '/workforce', label: 'Attendance, Leave & Roster' },
  hr_employees: { to: '/admin/employees', label: 'Employees (HR)' },
  equipment_assets: { to: '/admin/equipment', label: 'Equipment Register' },
  procurement_stores: { to: '/admin/procurement', label: 'Procurement & Stores' },
  cssd_housekeeping: { to: '/cssd-housekeeping', label: 'CSSD & Housekeeping' },
  quality_compliance: { to: '/admin/quality', label: 'Quality & Compliance' },
  appointment_requests: { to: '/appointment-requests', label: 'Appointment Requests' },
};

const adminLinks = [
  { to: '/admin/command-center', label: 'Command Center' },
  { to: '/admin/staff', label: 'Staff & Roles' },
  { to: '/admin/departments', label: 'Doctors & Departments' },
  { to: '/admin/settings', label: 'Hospital Settings' },
  { to: '/admin/masters', label: 'Insurance & Investigation Masters' },
  { to: '/admin/templates', label: 'Communication Templates' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit-log', label: 'Audit Log' },
];

function NavSection({ title, links, onNavigate }: { title: string; links: { to: string; label: string }[]; onNavigate: () => void }) {
  if (links.length === 0) return null;
  return (
    <>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent-700)', padding: '13.6px 6.8px 4px' }}>
        {title}
      </div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          onClick={onNavigate}
          style={({ isActive }) => ({
            display: 'block',
            padding: '10px 6.8px',
            fontSize: 14,
            color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)',
            background: isActive ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
            borderRadius: 'var(--radius-md)',
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </>
  );
}

const topLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: 'block',
  padding: '10px 6.8px',
  fontSize: 14,
  fontWeight: 600,
  color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)',
});

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fall back to showing nothing extra if role is somehow unrecognized —
  // Dashboard is always available so the app never looks fully empty.
  const nav = (profile && ROLE_NAV[profile.role]) ?? { patients: false, appointments: false, waitingBoard: false, journeys: [], support: [] };

  const journeyLinks = nav.journeys
    .map((key) => MODULES[key])
    .filter(Boolean)
    .map((m) => ({ to: `/journeys/${m.key}`, label: m.label }));

  const supportLinks = nav.support.map((key) => SUPPORT_META[key]).filter(Boolean);

  // Close the drawer automatically whenever the route changes (mobile only).
  const closeDrawer = () => setDrawerOpen(false);

  const sidebarContent = (
    <>
      <div style={{ padding: '0 6.8px 20.4px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.01em' }}>NETRA HIMS</div>
        <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
          360&deg; Eye Hospital
        </div>
      </div>

      <NavLink to="/" onClick={closeDrawer} style={topLinkStyle}>Dashboard</NavLink>
      {nav.patients && <NavLink to="/patients" onClick={closeDrawer} style={topLinkStyle}>Patients</NavLink>}
      {nav.appointments && <NavLink to="/appointments" onClick={closeDrawer} style={topLinkStyle}>Appointments</NavLink>}
      {nav.waitingBoard && <NavLink to="/waiting-room" onClick={closeDrawer} style={topLinkStyle}>Waiting Room</NavLink>}

      <NavSection title="Patient Journeys" links={journeyLinks} onNavigate={closeDrawer} />
      <NavSection title="Support Modules" links={supportLinks} onNavigate={closeDrawer} />
      {profile?.role === 'admin' && <NavSection title="Administration" links={adminLinks} onNavigate={closeDrawer} />}

      <div style={{ marginTop: 'auto', paddingTop: '13.6px', borderTop: '1px solid var(--color-divider)' }}>
        <div style={{ fontSize: 12, marginBottom: 8 }}>{profile?.full_name}</div>
        <RoleSwitcher />
        {!DEMO_MODE && (
          <button
            className="btn btn-secondary btn-block"
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--color-divider)', flex: 'none' }}>
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            style={{ background: 'none', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', width: 40, height: 40, fontSize: 18, cursor: 'pointer' }}
          >
            &#9776;
          </button>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>NETRA HIMS</div>
        </div>

        {drawerOpen && (
          <div
            onClick={closeDrawer}
            style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--color-neutral-900, #111) 45%, transparent)', zIndex: 40 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0, width: 'min(80vw, 280px)',
                background: 'var(--color-bg)', borderRight: '1px solid var(--color-divider)',
                display: 'flex', flexDirection: 'column', padding: '20.4px 13.6px', overflowY: 'auto', zIndex: 41,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button aria-label="Close menu" onClick={closeDrawer} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        <div key={location.pathname} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <div style={{ padding: 'var(--space-4)' }}>
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
      <div style={{ width: 236, flex: 'none', borderRight: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', padding: '20.4px 13.6px', overflowY: 'auto' }}>
        {sidebarContent}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto', overflowX: 'auto' }}>
        <div style={{ padding: 'var(--space-6)' }}>
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

'@
Write-Host '  wrote src\components\Layout.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\LoginPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import type { StaffRole } from '../lib/types';

const ROLES: StaffRole[] = [
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff', 'mrd', 'eye_bank',
];

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<StaffRole>('reception');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName, role);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigate('/');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <form onSubmit={handleSubmit} className="card blueprint elev-md" style={{ width: 'min(380px, 100%)', padding: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, marginBottom: 2 }}>NETRA HIMS</div>
        <div className="text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
          360&deg; Eye Hospital — Staff Access
        </div>

        <div className="seg" style={{ marginBottom: 'var(--space-4)' }}>
          <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={mode === 'signin'} onChange={() => setMode('signin')} />
            Sign in
          </label>
          <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={mode === 'signup'} onChange={() => setMode('signup')} />
            Register staff
          </label>
        </div>

        {mode === 'signup' && (
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
        )}

        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>

        {mode === 'signup' && (
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="role">Role</label>
            <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        )}

        {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {mode === 'signup' && (
          <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-3)' }}>
            The first registered account should choose "admin" so it can manage other staff afterwards.
          </p>
        )}

        <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-3)' }}>
          Patient? <Link to="/request-appointment">Request an appointment</Link> — no login needed.
        </p>
      </form>
    </div>
  );
}

'@
Write-Host '  wrote src\pages\LoginPage.tsx'

New-Item -ItemType Directory -Force -Path 'src' | Out-Null
Set-Content -Path 'src\App.tsx' -Encoding UTF8 -NoNewline -Value @'
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequestAppointmentPage } from './pages/RequestAppointmentPage';

// Route-level code splitting: each page only downloads when a user actually
// navigates to it, so e.g. a pharmacist's browser never fetches the LASIK or
// retina clinic bundles. Login and Dashboard stay eager since they're on the
// critical path for first paint.
const PatientsPage = lazy(() => import('./pages/PatientsPage').then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage').then((m) => ({ default: m.PatientDetailPage })));
const VisitWorkspacePage = lazy(() => import('./pages/VisitWorkspacePage').then((m) => ({ default: m.VisitWorkspacePage })));
const JourneyQueuePage = lazy(() => import('./pages/JourneyQueuePage').then((m) => ({ default: m.JourneyQueuePage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })));
const WaitingBoardPage = lazy(() => import('./pages/WaitingBoardPage').then((m) => ({ default: m.WaitingBoardPage })));
const PharmacyQueuePage = lazy(() => import('./pages/PharmacyQueuePage').then((m) => ({ default: m.PharmacyQueuePage })));
const PharmacyInventoryPage = lazy(() => import('./pages/PharmacyInventoryPage').then((m) => ({ default: m.PharmacyInventoryPage })));
const OpticalQueuePage = lazy(() => import('./pages/OpticalQueuePage').then((m) => ({ default: m.OpticalQueuePage })));
const OpticalInventoryPage = lazy(() => import('./pages/OpticalInventoryPage').then((m) => ({ default: m.OpticalInventoryPage })));
const BillingQueuePage = lazy(() => import('./pages/BillingQueuePage').then((m) => ({ default: m.BillingQueuePage })));
const CollectionsReportPage = lazy(() => import('./pages/CollectionsReportPage').then((m) => ({ default: m.CollectionsReportPage })));
const InsuranceDeskPage = lazy(() => import('./pages/InsuranceDeskPage').then((m) => ({ default: m.InsuranceDeskPage })));
const AdminStaffPage = lazy(() => import('./pages/AdminStaffPage').then((m) => ({ default: m.AdminStaffPage })));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminAuditLogPage = lazy(() => import('./pages/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage })));
const AdminDepartmentsPage = lazy(() => import('./pages/AdminDepartmentsPage').then((m) => ({ default: m.AdminDepartmentsPage })));
const AdminHospitalSettingsPage = lazy(() => import('./pages/AdminHospitalSettingsPage').then((m) => ({ default: m.AdminHospitalSettingsPage })));
const AdminMastersPage = lazy(() => import('./pages/AdminMastersPage').then((m) => ({ default: m.AdminMastersPage })));
const AdminCommunicationTemplatesPage = lazy(() => import('./pages/AdminCommunicationTemplatesPage').then((m) => ({ default: m.AdminCommunicationTemplatesPage })));
const PacsViewerPage = lazy(() => import('./pages/PacsViewerPage').then((m) => ({ default: m.PacsViewerPage })));
const MrdRecordRequestsPage = lazy(() => import('./pages/MrdRecordRequestsPage').then((m) => ({ default: m.MrdRecordRequestsPage })));
const MrdMlcRegisterPage = lazy(() => import('./pages/MrdMlcRegisterPage').then((m) => ({ default: m.MrdMlcRegisterPage })));
const MrdCompletionDashboardPage = lazy(() => import('./pages/MrdCompletionDashboardPage').then((m) => ({ default: m.MrdCompletionDashboardPage })));
const EyeBankDonorsPage = lazy(() => import('./pages/EyeBankDonorsPage').then((m) => ({ default: m.EyeBankDonorsPage })));
const EyeBankTissuesPage = lazy(() => import('./pages/EyeBankTissuesPage').then((m) => ({ default: m.EyeBankTissuesPage })));
const EmergencyTriagePage = lazy(() => import('./pages/EmergencyTriagePage').then((m) => ({ default: m.EmergencyTriagePage })));
const OutreachCampsPage = lazy(() => import('./pages/OutreachCampsPage').then((m) => ({ default: m.OutreachCampsPage })));
const WorkforcePage = lazy(() => import('./pages/WorkforcePage').then((m) => ({ default: m.WorkforcePage })));
const AdminEmployeesPage = lazy(() => import('./pages/AdminEmployeesPage').then((m) => ({ default: m.AdminEmployeesPage })));
const EquipmentAssetsPage = lazy(() => import('./pages/EquipmentAssetsPage').then((m) => ({ default: m.EquipmentAssetsPage })));
const ProcurementStoresPage = lazy(() => import('./pages/ProcurementStoresPage').then((m) => ({ default: m.ProcurementStoresPage })));
const CssdHousekeepingPage = lazy(() => import('./pages/CssdHousekeepingPage').then((m) => ({ default: m.CssdHousekeepingPage })));
const QualityCompliancePage = lazy(() => import('./pages/QualityCompliancePage').then((m) => ({ default: m.QualityCompliancePage })));
const CommandCenterPage = lazy(() => import('./pages/CommandCenterPage').then((m) => ({ default: m.CommandCenterPage })));
const AppointmentRequestsPage = lazy(() => import('./pages/AppointmentRequestsPage').then((m) => ({ default: m.AppointmentRequestsPage })));

function PageLoading() {
  return <div className="text-muted" style={{ padding: 'var(--space-6)' }}>Loading…</div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!profile) {
    return (
      <div style={{ padding: 40, maxWidth: 480 }}>
        <h3>Account pending setup</h3>
        <p className="text-muted">
          Your login succeeded but no active staff profile was found. Ask an admin to activate your account
          from Administration, Staff section.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/request-appointment" element={<Suspense fallback={<PageLoading />}><RequestAppointmentPage /></Suspense>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RequireProfile>
              <Layout />
            </RequireProfile>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<Suspense fallback={<PageLoading />}><PatientsPage /></Suspense>} />
        <Route path="patients/:id" element={<Suspense fallback={<PageLoading />}><PatientDetailPage /></Suspense>} />
        <Route path="patients/:id/pacs" element={<Suspense fallback={<PageLoading />}><PacsViewerPage /></Suspense>} />
        <Route path="mrd/requests" element={<Suspense fallback={<PageLoading />}><MrdRecordRequestsPage /></Suspense>} />
        <Route path="mrd/mlc" element={<Suspense fallback={<PageLoading />}><MrdMlcRegisterPage /></Suspense>} />
        <Route path="mrd/completion" element={<Suspense fallback={<PageLoading />}><MrdCompletionDashboardPage /></Suspense>} />
        <Route path="eye-bank/donors" element={<Suspense fallback={<PageLoading />}><EyeBankDonorsPage /></Suspense>} />
        <Route path="eye-bank/tissues" element={<Suspense fallback={<PageLoading />}><EyeBankTissuesPage /></Suspense>} />
        <Route path="emergency-triage" element={<Suspense fallback={<PageLoading />}><EmergencyTriagePage /></Suspense>} />
        <Route path="outreach-camps" element={<Suspense fallback={<PageLoading />}><OutreachCampsPage /></Suspense>} />
        <Route path="workforce" element={<Suspense fallback={<PageLoading />}><WorkforcePage /></Suspense>} />
        <Route path="admin/employees" element={<Suspense fallback={<PageLoading />}><AdminEmployeesPage /></Suspense>} />
        <Route path="admin/equipment" element={<Suspense fallback={<PageLoading />}><EquipmentAssetsPage /></Suspense>} />
        <Route path="admin/procurement" element={<Suspense fallback={<PageLoading />}><ProcurementStoresPage /></Suspense>} />
        <Route path="cssd-housekeeping" element={<Suspense fallback={<PageLoading />}><CssdHousekeepingPage /></Suspense>} />
        <Route path="admin/quality" element={<Suspense fallback={<PageLoading />}><QualityCompliancePage /></Suspense>} />
        <Route path="admin/command-center" element={<Suspense fallback={<PageLoading />}><CommandCenterPage /></Suspense>} />
        <Route path="appointment-requests" element={<Suspense fallback={<PageLoading />}><AppointmentRequestsPage /></Suspense>} />
        <Route path="visits/:id" element={<Suspense fallback={<PageLoading />}><VisitWorkspacePage /></Suspense>} />
        <Route path="journeys/:module" element={<Suspense fallback={<PageLoading />}><JourneyQueuePage /></Suspense>} />
        <Route path="appointments" element={<Suspense fallback={<PageLoading />}><AppointmentsPage /></Suspense>} />
        <Route path="waiting-room" element={<Suspense fallback={<PageLoading />}><WaitingBoardPage /></Suspense>} />
        <Route path="pharmacy" element={<Suspense fallback={<PageLoading />}><PharmacyQueuePage /></Suspense>} />
        <Route path="pharmacy/inventory" element={<Suspense fallback={<PageLoading />}><PharmacyInventoryPage /></Suspense>} />
        <Route path="optical" element={<Suspense fallback={<PageLoading />}><OpticalQueuePage /></Suspense>} />
        <Route path="optical/inventory" element={<Suspense fallback={<PageLoading />}><OpticalInventoryPage /></Suspense>} />
        <Route path="billing" element={<Suspense fallback={<PageLoading />}><BillingQueuePage /></Suspense>} />
        <Route path="billing/collections" element={<Suspense fallback={<PageLoading />}><CollectionsReportPage /></Suspense>} />
        <Route path="insurance" element={<Suspense fallback={<PageLoading />}><InsuranceDeskPage /></Suspense>} />
        <Route path="admin/staff" element={<Suspense fallback={<PageLoading />}><AdminStaffPage /></Suspense>} />
        <Route path="admin/departments" element={<Suspense fallback={<PageLoading />}><AdminDepartmentsPage /></Suspense>} />
        <Route path="admin/settings" element={<Suspense fallback={<PageLoading />}><AdminHospitalSettingsPage /></Suspense>} />
        <Route path="admin/masters" element={<Suspense fallback={<PageLoading />}><AdminMastersPage /></Suspense>} />
        <Route path="admin/templates" element={<Suspense fallback={<PageLoading />}><AdminCommunicationTemplatesPage /></Suspense>} />
        <Route path="admin/reports" element={<Suspense fallback={<PageLoading />}><AdminReportsPage /></Suspense>} />
        <Route path="admin/audit-log" element={<Suspense fallback={<PageLoading />}><AdminAuditLogPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

'@
Write-Host '  wrote src\App.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\QualityCompliancePage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { FileUploadField } from '../components/FileUploadField';

const INCIDENT_TYPES = ['adverse_event', 'near_miss', 'needle_stick', 'fall', 'medication_error', 'equipment_failure', 'other'];
const SEVERITIES = ['minor', 'moderate', 'major', 'critical'];
const LICENSE_TYPES = ['aerb_laser', 'biomedical_waste_authorization', 'fire_noc', 'pollution_control', 'trade_license', 'nabh_accreditation', 'drug_license', 'other'];

const SEVERITY_STYLE: Record<string, React.CSSProperties> = {
  minor: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  moderate: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  major: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  critical: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3', fontWeight: 700 },
};
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  open: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  under_review: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
  closed: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  active: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  expired: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  renewal_pending: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysUntil = (dateStr: string) => Math.round((new Date(dateStr).getTime() - new Date(todayISO()).getTime()) / 86400000);

// ---------------- Incident Reports ----------------

function ReportIncidentForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ incident_type: 'near_miss', severity: 'minor', department: '', description: '', immediate_action_taken: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('incident_reports').insert({
      incident_type: form.incident_type, severity: form.severity, department: form.department || null,
      description: form.description, immediate_action_taken: form.immediate_action_taken || null, reported_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['incident-reports'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Report an incident</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>Log on behalf of whoever reported it — adverse events, near-misses, needle-stick injuries, falls, medication errors.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Type</label>
          <select className="input" value={form.incident_type} onChange={(e) => set('incident_type', e.target.value)}>
            {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Severity</label>
          <select className="input" value={form.severity} onChange={(e) => set('severity', e.target.value)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>What happened? *</label><textarea className="input" value={form.description} onChange={(e) => set('description', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Immediate action taken</label><textarea className="input" value={form.immediate_action_taken} onChange={(e) => set('immediate_action_taken', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function IncidentRow({ incident }: { incident: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState(incident.review_notes ?? '');

  const decide = async (status: string) => {
    await supabase.from('incident_reports').update({
      status, review_notes: reviewNotes || null, reviewed_by: profile?.id,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', incident.id);
    qc.invalidateQueries({ queryKey: ['incident-reports'] });
  };

  return (
    <tr>
      <td>{new Date(incident.incident_date).toLocaleDateString()}</td>
      <td>{incident.incident_type.replace(/_/g, ' ')}</td>
      <td><span className="tag tag-outline" style={SEVERITY_STYLE[incident.severity]}>{incident.severity}</span></td>
      <td className="text-muted" style={{ maxWidth: 260 }}>{incident.description}</td>
      <td><span className="tag tag-outline" style={STATUS_STYLE[incident.status]}>{incident.status.replace(/_/g, ' ')}</span></td>
      <td>
        {incident.status !== 'closed' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" style={{ width: 140 }} placeholder="Review notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
            {incident.status === 'open' && <button className="btn btn-ghost" onClick={() => decide('under_review')}>Review</button>}
            <button className="btn btn-ghost" onClick={() => decide('closed')}>Close</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function IncidentReportsTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incident-reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('incident_reports').select('*').order('incident_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Adverse events, near-misses and safety incidents — visible only to quality_manager and admin.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Report incident</button>}
      </div>
      {showForm && <ReportIncidentForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Description</th><th>Status</th><th /></tr></thead>
          <tbody>
            {incidents?.map((i: any) => <IncidentRow key={i.id} incident={i} />)}
            {incidents?.length === 0 && <tr><td colSpan={6} className="text-muted">No incidents reported.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Regulatory Licenses ----------------

function AddLicenseForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ license_type: 'aerb_laser', license_number: '', issuing_authority: '', issue_date: '', expiry_date: '', notes: '' });
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.expiry_date) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('regulatory_licenses').insert({
      license_type: form.license_type, license_number: form.license_number || null, issuing_authority: form.issuing_authority || null,
      issue_date: form.issue_date || null, expiry_date: form.expiry_date, document_url: docUrl, notes: form.notes || null, created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['regulatory-licenses'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add license / registration</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Type</label>
          <select className="input" value={form.license_type} onChange={(e) => set('license_type', e.target.value)}>
            {LICENSE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>License number</label><input className="input" value={form.license_number} onChange={(e) => set('license_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Issuing authority</label><input className="input" value={form.issuing_authority} onChange={(e) => set('issuing_authority', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Issue date</label><input className="input" type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Expiry date *</label><input className="input" type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Certificate document</label>
          <FileUploadField value={docUrl} onChange={setDocUrl} folder="compliance" />
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add license'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function RegulatoryLicensesTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: licenses, isLoading } = useQuery({
    queryKey: ['regulatory-licenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regulatory_licenses').select('*').order('expiry_date');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>AERB laser licences, biomedical waste authorization, fire NOC, NABH accreditation and other statutory registrations.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add license</button>}
      </div>
      {showForm && <AddLicenseForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Type</th><th>Number</th><th>Authority</th><th>Expiry</th><th>Status</th><th>Document</th></tr></thead>
          <tbody>
            {licenses?.map((l: any) => {
              const days = daysUntil(l.expiry_date);
              return (
                <tr key={l.id}>
                  <td>{l.license_type.replace(/_/g, ' ')}</td>
                  <td>{l.license_number ?? '—'}</td>
                  <td>{l.issuing_authority ?? '—'}</td>
                  <td>
                    <span className="tag tag-outline" style={days < 0 ? SEVERITY_STYLE.critical : days <= 60 ? STATUS_STYLE.renewal_pending : STATUS_STYLE.active}>
                      {l.expiry_date} {days < 0 ? `(${Math.abs(days)}d overdue)` : `(${days}d left)`}
                    </span>
                  </td>
                  <td><span className="tag tag-outline" style={STATUS_STYLE[l.status]}>{l.status.replace(/_/g, ' ')}</span></td>
                  <td>{l.document_url ? <a href={l.document_url} target="_blank" rel="noreferrer">view</a> : '—'}</td>
                </tr>
              );
            })}
            {licenses?.length === 0 && <tr><td colSpan={6} className="text-muted">No licenses on file.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export function QualityCompliancePage() {
  const [tab, setTab] = useState<'incidents' | 'licenses'>('incidents');
  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'incidents', label: 'Incident Reports' },
    { key: 'licenses', label: 'Regulatory Licenses' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Quality & Compliance</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Incident reporting and the statutory registrations that keep the hospital compliant.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'incidents' && <IncidentReportsTab />}
      {tab === 'licenses' && <RegulatoryLicensesTab />}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\QualityCompliancePage.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\AppointmentRequestsPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  contacted: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  declined: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
};

function RequestRow({ req }: { req: any }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(req.staff_notes ?? '');

  const decide = async (status: string) => {
    await supabase.from('appointment_requests').update({ status, staff_notes: notes || null }).eq('id', req.id);
    qc.invalidateQueries({ queryKey: ['appointment-requests'] });
  };

  return (
    <tr>
      <td>{new Date(req.created_at).toLocaleString()}</td>
      <td>{req.full_name}</td>
      <td>{req.phone}</td>
      <td>{req.preferred_clinic_module}</td>
      <td>{req.preferred_date ?? '—'}</td>
      <td className="text-muted" style={{ maxWidth: 200 }}>{req.reason ?? '—'}</td>
      <td><span className="tag tag-outline" style={STATUS_STYLE[req.status]}>{req.status}</span></td>
      <td>
        {req.status === 'pending' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" style={{ width: 120 }} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn btn-ghost" onClick={() => decide('contacted')}>Contacted</button>
            <button className="btn btn-ghost" onClick={() => decide('declined')}>Decline</button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function AppointmentRequestsPage() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['appointment-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointment_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Appointment Requests</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>
        Submitted from the public request form. Call back, then register the patient and book the visit as usual from{' '}
        <Link to="/patients">Patients</Link> — nothing here creates a patient record automatically.
      </p>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Submitted</th><th>Name</th><th>Phone</th><th>Clinic</th><th>Preferred date</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>
            {requests?.map((r: any) => <RequestRow key={r.id} req={r} />)}
            {requests?.length === 0 && <tr><td colSpan={8} className="text-muted">No requests yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\AppointmentRequestsPage.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\RequestAppointmentPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const CLINICS = [
  { value: 'general', label: 'General Eye Checkup' },
  { value: 'retina', label: 'Retina Clinic' },
  { value: 'glaucoma', label: 'Glaucoma Clinic' },
  { value: 'lasik', label: 'LASIK / Refractive Surgery' },
  { value: 'pediatric', label: 'Pediatric Eye Care' },
];

export function RequestAppointmentPage() {
  const [form, setForm] = useState({ full_name: '', phone: '', preferred_clinic_module: 'general', preferred_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) return;
    setSaving(true);
    setError(null);
    // Deliberately not chaining .select() here: an unauthenticated visitor
    // has no read access to this table (by design — see 0036 migration), and
    // reading the row back after insert would fail Postgres's RETURNING
    // visibility check even though the insert itself succeeds.
    const { error: insertError } = await supabase.from('appointment_requests').insert({
      full_name: form.full_name, phone: form.phone, preferred_clinic_module: form.preferred_clinic_module,
      preferred_date: form.preferred_date || null, reason: form.reason || null,
    });
    setSaving(false);
    if (insertError) { setError("Something went wrong — please call the hospital directly instead."); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
        <div className="card blueprint elev-md" style={{ width: 'min(420px, 100%)', padding: 'var(--space-6)', textAlign: 'center' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, marginBottom: 8 }}>Request received</div>
          <p className="text-muted">Thank you, {form.full_name.split(' ')[0]}. Our front desk will call you at {form.phone} to confirm your appointment.</p>
          <Link className="btn btn-secondary" style={{ marginTop: 12, display: 'inline-block' }} to="/">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <form onSubmit={submit} className="card blueprint elev-md" style={{ width: 'min(440px, 100%)', padding: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, marginBottom: 2 }}>NETRA HIMS</div>
        <div className="text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
          Request an Appointment
        </div>
        <p className="text-muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 'var(--space-4)' }}>
          Tell us a bit about your visit and our front desk will call you back to confirm.
        </p>

        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="full_name">Your name *</label>
          <input id="full_name" className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="phone">Phone number *</label>
          <input id="phone" className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="clinic">What do you need?</label>
          <select id="clinic" className="input" value={form.preferred_clinic_module} onChange={(e) => set('preferred_clinic_module', e.target.value)}>
            {CLINICS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="preferred_date">Preferred date</label>
          <input id="preferred_date" className="input" type="date" value={form.preferred_date} onChange={(e) => set('preferred_date', e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="reason">Anything we should know?</label>
          <textarea id="reason" className="input" value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Optional" />
        </div>

        {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Request appointment'}
        </button>

        <p className="text-muted" style={{ fontSize: 11, marginTop: 'var(--space-3)' }}>
          For staff sign-in, go to <Link to="/login">the staff login</Link>.
        </p>
      </form>
    </div>
  );
}

'@
Write-Host '  wrote src\pages\RequestAppointmentPage.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\CommandCenterPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (dateStr: string) => Math.round((new Date(dateStr).getTime() - new Date(todayISO()).getTime()) / 86400000);
function dueStyle(days: number): React.CSSProperties {
  if (days < 0) return { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' };
  if (days <= 14) return { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' };
  return { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' };
}

async function countLowStock(table: string) {
  const { data } = await supabase.from(table).select('stock_qty, reorder_level');
  return (data ?? []).filter((d: any) => d.stock_qty <= d.reorder_level).length;
}

async function countRows(table: string, filter: (q: any) => any) {
  const { count } = await filter(supabase.from(table).select('*', { count: 'exact', head: true }));
  return count ?? 0;
}

export function CommandCenterPage() {
  const { data } = useQuery({
    queryKey: ['command-center'],
    queryFn: async () => {
      const [
        maintenanceDue, amcExpiring, licensesExpiring, lowStockDrugs, lowStockEyewear, lowStockStores,
        pendingLeave, pendingRequisitions, openIncidents, housekeepingDue, pendingAppointmentRequests,
        expiringAmc, expiringLicenses,
      ] = await Promise.all([
        countRows('maintenance_schedules', (q) => q.eq('active', true).lte('next_due_date', plusDaysISO(30))),
        countRows('amc_contracts', (q) => q.eq('status', 'active').lte('end_date', plusDaysISO(30))),
        countRows('regulatory_licenses', (q) => q.lte('expiry_date', plusDaysISO(60))),
        countLowStock('drugs'),
        countLowStock('eyewear_items'),
        countLowStock('general_stores_inventory'),
        countRows('leave_requests', (q) => q.eq('status', 'pending')),
        countRows('purchase_requisitions', (q) => q.eq('status', 'pending')),
        countRows('incident_reports', (q) => q.neq('status', 'closed')),
        countRows('housekeeping_schedules', (q) => q.eq('active', true).lte('next_due_date', todayISO())),
        countRows('appointment_requests', (q) => q.eq('status', 'pending')),
        supabase.from('amc_contracts').select('*, equipment_assets(name, asset_tag)').eq('status', 'active').lte('end_date', plusDaysISO(30)).order('end_date').then((r) => r.data ?? []),
        supabase.from('regulatory_licenses').select('*').lte('expiry_date', plusDaysISO(60)).order('expiry_date').then((r) => r.data ?? []),
      ]);
      return {
        maintenanceDue, amcExpiring, licensesExpiring, lowStockDrugs, lowStockEyewear, lowStockStores,
        pendingLeave, pendingRequisitions, openIncidents, housekeepingDue, pendingAppointmentRequests,
        expiringAmc, expiringLicenses,
      };
    },
  });

  const tiles = [
    { label: 'Equipment maintenance/calibration due', value: data?.maintenanceDue, to: '/admin/equipment' },
    { label: 'AMC/CMC contracts expiring (30d)', value: data?.amcExpiring, to: '/admin/equipment' },
    { label: 'Regulatory licenses expiring (60d)', value: data?.licensesExpiring, to: '/admin/quality' },
    { label: 'Open incident reports', value: data?.openIncidents, to: '/admin/quality' },
    { label: 'Drugs low on stock', value: data?.lowStockDrugs, to: '/pharmacy/inventory' },
    { label: 'Eyewear low on stock', value: data?.lowStockEyewear, to: '/optical/inventory' },
    { label: 'General stores low on stock', value: data?.lowStockStores, to: '/admin/procurement' },
    { label: 'Housekeeping overdue', value: data?.housekeepingDue, to: '/cssd-housekeeping' },
    { label: 'Leave requests pending', value: data?.pendingLeave, to: '/workforce' },
    { label: 'Purchase requisitions pending', value: data?.pendingRequisitions, to: '/admin/procurement' },
    { label: 'Appointment requests pending', value: data?.pendingAppointmentRequests, to: '/appointment-requests' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Command Center</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>
        Everything due, overdue or expiring across the hospital, in one place.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} style={{ color: 'inherit' }}>
            <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div className="card-kicker">Overview</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 600 }}>{t.value ?? '—'}</div>
              <div className="card-body">{t.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <h4>AMC/CMC contracts expiring within 30 days</h4>
      <table className="table" style={{ marginBottom: 'var(--space-6)' }}>
        <thead><tr><th>Equipment</th><th>Vendor</th><th>Ends</th></tr></thead>
        <tbody>
          {data?.expiringAmc.map((a: any) => {
            const days = daysUntil(a.end_date);
            return (
              <tr key={a.id}>
                <td>{a.equipment_assets?.name} <span className="text-muted" style={{ fontSize: 11 }}>({a.equipment_assets?.asset_tag})</span></td>
                <td>{a.vendor_name}</td>
                <td><span className="tag tag-outline" style={dueStyle(days)}>{a.end_date} ({days}d)</span></td>
              </tr>
            );
          })}
          {(!data?.expiringAmc || data.expiringAmc.length === 0) && <tr><td colSpan={3} className="text-muted">Nothing expiring soon.</td></tr>}
        </tbody>
      </table>

      <h4>Regulatory licenses expiring within 60 days</h4>
      <table className="table">
        <thead><tr><th>Type</th><th>Number</th><th>Expires</th></tr></thead>
        <tbody>
          {data?.expiringLicenses.map((l: any) => {
            const days = daysUntil(l.expiry_date);
            return (
              <tr key={l.id}>
                <td>{l.license_type.replace(/_/g, ' ')}</td>
                <td>{l.license_number ?? '—'}</td>
                <td><span className="tag tag-outline" style={dueStyle(days)}>{l.expiry_date} ({days}d)</span></td>
              </tr>
            );
          })}
          {(!data?.expiringLicenses || data.expiringLicenses.length === 0) && <tr><td colSpan={3} className="text-muted">Nothing expiring soon.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

'@
Write-Host '  wrote src\pages\CommandCenterPage.tsx'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0034_quality_manager_role.sql' -Encoding UTF8 -NoNewline -Value @'
-- Phase 4 of the paperless-hospital roadmap: quality/compliance (Domain I)
-- gets its own desk, same pattern as hr_manager/biomedical_engineer/store_keeper.
alter type staff_role add value 'quality_manager';

'@
Write-Host '  wrote supabase\migrations\0034_quality_manager_role.sql'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0035_quality_compliance.sql' -Encoding UTF8 -NoNewline -Value @'
-- ============================================================
-- NETRA HIMS — Quality, incident & regulatory compliance (Domain I)
-- Phase 4 of the paperless-hospital roadmap.
--
-- incident_reports is the one exception to this app's staff-wide-read
-- convention: adverse events, near-misses and medication errors are
-- safety/HR-sensitive in a way clinical and asset data isn't, so reads
-- follow the audit_log precedent (admin/quality_manager only) instead.
-- regulatory_licenses (AERB, biomedical waste authorization, fire NOC,
-- NABH) is compliance status, not sensitive — stays staff-wide readable.
-- ============================================================

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  incident_date timestamptz not null default now(),
  incident_type text not null check (incident_type in ('adverse_event', 'near_miss', 'needle_stick', 'fall', 'medication_error', 'equipment_failure', 'other')),
  severity text not null default 'minor' check (severity in ('minor', 'moderate', 'major', 'critical')),
  department text,
  patient_id uuid references patients(id),
  description text not null,
  immediate_action_taken text,
  reported_by uuid references profiles(id),
  status text not null default 'open' check (status in ('open', 'under_review', 'closed')),
  reviewed_by uuid references profiles(id),
  review_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_incident_reports_status on incident_reports(status);
create trigger trg_incident_reports_updated before update on incident_reports
  for each row execute function set_updated_at();

create table regulatory_licenses (
  id uuid primary key default gen_random_uuid(),
  license_type text not null check (license_type in ('aerb_laser', 'biomedical_waste_authorization', 'fire_noc', 'pollution_control', 'trade_license', 'nabh_accreditation', 'drug_license', 'other')),
  license_number text,
  issuing_authority text,
  issue_date date,
  expiry_date date not null,
  document_url text,
  status text not null default 'active' check (status in ('active', 'expired', 'renewal_pending')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_regulatory_licenses_expiry on regulatory_licenses(expiry_date);
create trigger trg_regulatory_licenses_updated before update on regulatory_licenses
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table incident_reports enable row level security;
create policy "incident_reports_select" on incident_reports for select to authenticated using (has_role('quality_manager'::staff_role));
create policy "incident_reports_insert" on incident_reports for insert to authenticated with check (is_staff());
create policy "incident_reports_update" on incident_reports for update to authenticated using (has_role('quality_manager'::staff_role)) with check (has_role('quality_manager'::staff_role));
create policy "incident_reports_delete" on incident_reports for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table regulatory_licenses enable row level security;
create policy "regulatory_licenses_select" on regulatory_licenses for select to authenticated using (is_staff());
create policy "regulatory_licenses_insert" on regulatory_licenses for insert to authenticated with check (has_role('quality_manager'::staff_role));
create policy "regulatory_licenses_update" on regulatory_licenses for update to authenticated using (has_role('quality_manager'::staff_role)) with check (has_role('quality_manager'::staff_role));
create policy "regulatory_licenses_delete" on regulatory_licenses for delete to authenticated using (has_role('quality_manager'::staff_role));

create trigger audit_incident_reports after insert or update or delete on incident_reports
  for each row execute function log_audit_event();
create trigger audit_regulatory_licenses after insert or update or delete on regulatory_licenses
  for each row execute function log_audit_event();

'@
Write-Host '  wrote supabase\migrations\0035_quality_compliance.sql'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0036_appointment_requests.sql' -Encoding UTF8 -NoNewline -Value @'
-- ============================================================
-- NETRA HIMS — Public appointment requests (Domain J, patient self-service)
-- Phase 5 of the paperless-hospital roadmap.
--
-- This is the one table in the whole schema writable by an unauthenticated
-- visitor: a lightweight "call me back" form on a public page, not a real
-- patient/appointment record. Reception reviews these and, if they proceed,
-- registers the patient and books the appointment through the normal
-- Patients/Appointments flow — nothing here auto-creates a patient record,
-- so a spammed request can't forge one.
-- ============================================================

create table appointment_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  preferred_clinic_module text not null check (preferred_clinic_module in ('general', 'retina', 'glaucoma', 'lasik', 'pediatric')),
  preferred_date date,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'declined')),
  staff_notes text,
  created_at timestamptz not null default now()
);
create index idx_appointment_requests_status on appointment_requests(status);

alter table appointment_requests enable row level security;
create policy "appointment_requests_insert" on appointment_requests for insert to public with check (true);
create policy "appointment_requests_select" on appointment_requests for select to authenticated using (is_staff());
create policy "appointment_requests_update" on appointment_requests for update to authenticated using (has_role('reception'::staff_role)) with check (has_role('reception'::staff_role));
create policy "appointment_requests_delete" on appointment_requests for delete to authenticated using (has_role(variadic array[]::staff_role[]));

'@
Write-Host '  wrote supabase\migrations\0036_appointment_requests.sql'

Write-Host 'All Phase 4 & 5 files written.' -ForegroundColor Green
git add -A
git status
Write-Host "Now run: git commit -m 'Add Phase 4 & 5: quality/compliance, command center, public appointment requests' ; git push origin claude/determined-ride-o63al9" -ForegroundColor Yellow