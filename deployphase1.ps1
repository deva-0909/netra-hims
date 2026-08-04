# Netra HIMS — Phase 1 deploy script (HR core, duty roster, equipment asset register)
# Run this from the ROOT of your local netra-hims clone (where package.json lives).
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'package.json')) { Write-Error 'Run this from the repo root (where package.json lives).'; exit 1 }
Write-Host 'Writing Phase 1 files...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path 'src' | Out-Null
Set-Content -Path 'src\App.tsx' -Encoding UTF8 -NoNewline -Value @'
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

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
};

const adminLinks = [
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

New-Item -ItemType Directory -Force -Path 'src\components' | Out-Null
Set-Content -Path 'src\components\RoleSwitcher.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import type { StaffRole } from '../lib/types';

const ROLES: StaffRole[] = [
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff', 'mrd', 'eye_bank',
  'hr_manager', 'biomedical_engineer',
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

New-Item -ItemType Directory -Force -Path 'src\lib' | Out-Null
Set-Content -Path 'src\lib\types.ts' -Encoding UTF8 -NoNewline -Value @'
export type StaffRole =
  | 'admin' | 'reception' | 'optometrist' | 'doctor' | 'nurse'
  | 'pharmacist' | 'optical' | 'billing' | 'insurance_desk' | 'ot_staff' | 'mrd' | 'eye_bank'
  | 'hr_manager' | 'biomedical_engineer';

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

New-Item -ItemType Directory -Force -Path 'src\modules' | Out-Null
Set-Content -Path 'src\modules\roleNav.ts' -Encoding UTF8 -NoNewline -Value @'
import type { StaffRole } from '../lib/types';

export interface RoleNav {
  patients: boolean;
  appointments: boolean;
  waitingBoard: boolean;
  journeys: string[];   // clinic module keys visible in "Patient Journeys"
  support: string[];    // 'pharmacy' | 'pharmacy_inventory' | 'optical' | 'optical_inventory' | 'billing' | 'insurance' | 'mrd' | 'workforce' | 'hr_employees' | 'equipment_assets'
}

const ALL_JOURNEYS = ['general', 'retina', 'glaucoma', 'lasik', 'pediatric'];
const ALL_SUPPORT = ['pharmacy', 'pharmacy_inventory', 'optical', 'optical_inventory', 'billing', 'insurance', 'mrd_requests', 'mrd_mlc', 'mrd_completion', 'eye_bank_donors', 'eye_bank_tissues', 'emergency_triage', 'outreach_camps', 'workforce', 'hr_employees', 'equipment_assets'];

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
  nurse: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage', ...WORKFORCE] },
  ot_staff: { patients: true, appointments: false, waitingBoard: false, journeys: ['general'], support: ['emergency_triage', ...WORKFORCE] },

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
};

'@
Write-Host '  wrote src\modules\roleNav.ts'

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
  'hr_manager', 'biomedical_engineer',
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

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\AdminEmployeesPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { FileUploadField } from '../components/FileUploadField';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'visiting_consultant', 'intern'];
const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'resigned', 'terminated'];
const DOCUMENT_TYPES = ['id_proof', 'address_proof', 'educational_certificate', 'professional_license', 'contract', 'offer_letter', 'other'];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active: {},
  on_leave: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  suspended: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  resigned: { background: '#e8e8e8', color: '#555' },
  terminated: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
};

function NewEmployeeForm({ availableProfiles, employees, onDone }: { availableProfiles: any[]; employees: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    profile_id: '', employee_code: '', designation: '', employment_type: 'full_time', date_of_joining: '',
    date_of_birth: '', gender: '', personal_phone: '', personal_email: '', address: '',
    emergency_contact_name: '', emergency_contact_phone: '', pan_number: '', aadhaar_number: '',
    bank_account_number: '', bank_ifsc: '', monthly_salary: '', reporting_manager_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.profile_id || !form.employee_code.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('employees').insert({
      profile_id: form.profile_id,
      employee_code: form.employee_code,
      designation: form.designation || null,
      employment_type: form.employment_type,
      date_of_joining: form.date_of_joining || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      personal_phone: form.personal_phone || null,
      personal_email: form.personal_email || null,
      address: form.address || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      pan_number: form.pan_number || null,
      aadhaar_number: form.aadhaar_number || null,
      bank_account_number: form.bank_account_number || null,
      bank_ifsc: form.bank_ifsc || null,
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null,
      reporting_manager_id: form.reporting_manager_id || null,
      notes: form.notes || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['employees'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add employee record</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>
        Attach HR details to a staff member who already has a login. Staff create their own login from the login screen first ("Register staff") — this form doesn't create one.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Staff account *</label>
          <select className="input" value={form.profile_id} onChange={(e) => set('profile_id', e.target.value)} required>
            <option value="">Select…</option>
            {availableProfiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role.replace(/_/g, ' ')})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Employee code *</label><input className="input" value={form.employee_code} onChange={(e) => set('employee_code', e.target.value)} placeholder="NH-EMP-0001" required /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Designation</label><input className="input" value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="Senior Optometrist" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Employment type</label>
          <select className="input" value={form.employment_type} onChange={(e) => set('employment_type', e.target.value)}>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Date of joining</label><input className="input" type="date" value={form.date_of_joining} onChange={(e) => set('date_of_joining', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Date of birth</label><input className="input" type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Gender</label>
          <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Personal phone</label><input className="input" value={form.personal_phone} onChange={(e) => set('personal_phone', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Personal email</label><input className="input" type="email" value={form.personal_email} onChange={(e) => set('personal_email', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Emergency contact name</label><input className="input" value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Emergency contact phone</label><input className="input" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>PAN</label><input className="input" value={form.pan_number} onChange={(e) => set('pan_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Aadhaar</label><input className="input" value={form.aadhaar_number} onChange={(e) => set('aadhaar_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Bank account number</label><input className="input" value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Bank IFSC</label><input className="input" value={form.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Monthly salary (₹)</label><input className="input" type="number" value={form.monthly_salary} onChange={(e) => set('monthly_salary', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Reporting manager</label>
          <select className="input" value={form.reporting_manager_id} onChange={(e) => set('reporting_manager_id', e.target.value)}>
            <option value="">—</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add employee record'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function EmployeeRow({ emp }: { emp: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [docType, setDocType] = useState('other');
  const [docName, setDocName] = useState('');

  const { data: docs } = useQuery({
    queryKey: ['employee-documents', emp.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_documents').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (employment_status: string) => {
    await supabase.from('employees').update({ employment_status }).eq('id', emp.id);
    qc.invalidateQueries({ queryKey: ['employees'] });
  };

  const uploadDoc = async (url: string | null) => {
    if (!url) return;
    await supabase.from('employee_documents').insert({
      employee_id: emp.id, document_type: docType, document_name: docName || 'Document', document_url: url, uploaded_by: profile?.id,
    });
    setDocName('');
    qc.invalidateQueries({ queryKey: ['employee-documents', emp.id] });
  };

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {emp.employee_code}</button></td>
        <td>{emp.profiles?.full_name}<div className="text-muted" style={{ fontSize: 11 }}>{emp.profiles?.role?.replace(/_/g, ' ')}</div></td>
        <td>{emp.designation ?? '—'}</td>
        <td>{emp.employment_type?.replace(/_/g, ' ') ?? '—'}</td>
        <td>{emp.date_of_joining ?? '—'}</td>
        <td>
          <select className="input" value={emp.employment_status} onChange={(e) => updateStatus(e.target.value)} style={{ width: 130, ...STATUS_STYLE[emp.employment_status] }}>
            {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <div style={{ fontSize: 12 }} className="text-muted">
                {emp.personal_phone ?? '—'} · {emp.personal_email ?? '—'} · DOB {emp.date_of_birth ?? '—'} · Salary {emp.monthly_salary ? `₹${Number(emp.monthly_salary).toLocaleString()}/mo` : '—'}
              </div>
              <div style={{ fontSize: 12 }} className="text-muted">Emergency contact: {emp.emergency_contact_name ?? '—'} {emp.emergency_contact_phone ?? ''}</div>

              <h5 style={{ marginTop: 12, marginBottom: 4 }}>Documents</h5>
              {docs?.length ? (
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {docs.map((d: any) => <li key={d.id}><a href={d.document_url} target="_blank" rel="noreferrer">{d.document_name}</a> — {d.document_type.replace(/_/g, ' ')}{d.expiry_date ? ` (expires ${d.expiry_date})` : ''}</li>)}
                </ul>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No documents uploaded.</p>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="field" style={{ width: 180 }}>
                  <label>Document type</label>
                  <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 200 }}>
                  <label>Name</label>
                  <input className="input" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. BLS certificate" />
                </div>
                <div className="field">
                  <label>Upload</label>
                  <FileUploadField value={null} onChange={uploadDoc} folder="employees" />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AdminEmployeesPage() {
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*, profiles(full_name, role)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['all-profiles-for-hr'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const employeeProfileIds = new Set((employees ?? []).map((e: any) => e.profile_id));
  const availableProfiles = (allProfiles ?? []).filter((p: any) => !employeeProfileIds.has(p.id));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Employees (HR)</h2>
        {!showAddForm && <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add employee record</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Employment details, statutory IDs and salary — visible only to HR, admin, and each employee's own login.
      </p>

      {showAddForm && <NewEmployeeForm availableProfiles={availableProfiles} employees={employees ?? []} onDone={() => setShowAddForm(false)} />}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Type</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>
            {employees?.map((emp: any) => <EmployeeRow key={emp.id} emp={emp} />)}
            {employees?.length === 0 && <tr><td colSpan={6} className="text-muted">No employee records yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\AdminEmployeesPage.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\EquipmentAssetsPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { FileUploadField } from '../components/FileUploadField';

const CATEGORIES = ['diagnostic', 'surgical', 'laser', 'sterilization', 'emergency', 'it', 'other'];
const CRITICALITY = ['life_safety', 'clinical_critical', 'routine'];
const STATUSES = ['active', 'under_maintenance', 'decommissioned', 'disposed'];

const CRITICALITY_STYLE: Record<string, React.CSSProperties> = {
  life_safety: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  clinical_critical: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  routine: {},
};

function AddEquipmentForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    asset_tag: '', name: '', category: 'diagnostic', department: '', location: '',
    manufacturer: '', model_number: '', serial_number: '', purchase_date: '', purchase_cost: '',
    warranty_end_date: '', vendor_name: '', vendor_contact: '', criticality: 'routine', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_tag.trim() || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('equipment_assets').insert({
      asset_tag: form.asset_tag,
      name: form.name,
      category: form.category,
      department: form.department || null,
      location: form.location || null,
      manufacturer: form.manufacturer || null,
      model_number: form.model_number || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
      warranty_end_date: form.warranty_end_date || null,
      vendor_name: form.vendor_name || null,
      vendor_contact: form.vendor_contact || null,
      criticality: form.criticality,
      notes: form.notes || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['equipment-assets'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Register equipment</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Asset tag *</label><input className="input" value={form.asset_tag} onChange={(e) => set('asset_tag', e.target.value)} placeholder="NH-EQ-0001" required /></div>
        <div className="field" style={{ flex: '1 1 240px' }}><label>Name *</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Phacoemulsification Machine" required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Criticality</label>
          <select className="input" value={form.criticality} onChange={(e) => set('criticality', e.target.value)}>
            {CRITICALITY.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Location / Room</label><input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Manufacturer</label><input className="input" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Model number</label><input className="input" value={form.model_number} onChange={(e) => set('model_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Serial number</label><input className="input" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Purchase date</label><input className="input" type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Purchase cost (₹)</label><input className="input" type="number" value={form.purchase_cost} onChange={(e) => set('purchase_cost', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Warranty end date</label><input className="input" type="date" value={form.warranty_end_date} onChange={(e) => set('warranty_end_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Vendor name</label><input className="input" value={form.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Vendor contact</label><input className="input" value={form.vendor_contact} onChange={(e) => set('vendor_contact', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Register equipment'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function AmcForm({ equipmentId, onDone }: { equipmentId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ vendor_name: '', vendor_contact: '', contract_number: '', contract_type: 'amc', start_date: '', end_date: '', annual_cost: '', coverage_details: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_name.trim() || !form.start_date || !form.end_date) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('amc_contracts').insert({
      equipment_id: equipmentId,
      vendor_name: form.vendor_name,
      vendor_contact: form.vendor_contact || null,
      contract_number: form.contract_number || null,
      contract_type: form.contract_type,
      start_date: form.start_date,
      end_date: form.end_date,
      annual_cost: form.annual_cost ? Number(form.annual_cost) : null,
      coverage_details: form.coverage_details || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['equipment-assets'] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', border: '1px dashed var(--color-divider)' }}>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Vendor *</label><input className="input" value={form.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 140px' }}><label>Contact</label><input className="input" value={form.vendor_contact} onChange={(e) => set('vendor_contact', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Contract #</label><input className="input" value={form.contract_number} onChange={(e) => set('contract_number', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 120px' }}>
        <label>Type</label>
        <select className="input" value={form.contract_type} onChange={(e) => set('contract_type', e.target.value)}>
          <option value="amc">AMC (labour only)</option>
          <option value="cmc">CMC (parts included)</option>
          <option value="warranty_extension">Warranty extension</option>
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 130px' }}><label>Start date *</label><input className="input" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 130px' }}><label>End date *</label><input className="input" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Annual cost (₹)</label><input className="input" type="number" value={form.annual_cost} onChange={(e) => set('annual_cost', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 100%' }}><label>Coverage details</label><input className="input" value={form.coverage_details} onChange={(e) => set('coverage_details', e.target.value)} /></div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add contract'}</button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function EquipmentRow({ item, canManage }: { item: any; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showAmcForm, setShowAmcForm] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ['equipment-detail', item.id],
    enabled: expanded,
    queryFn: async () => {
      const [amc, docs] = await Promise.all([
        supabase.from('amc_contracts').select('*').eq('equipment_id', item.id).order('end_date', { ascending: false }),
        supabase.from('equipment_documents').select('*').eq('equipment_id', item.id).order('created_at', { ascending: false }),
      ]);
      if (amc.error) throw amc.error;
      if (docs.error) throw docs.error;
      return { amc: amc.data, docs: docs.data };
    },
  });

  const updateStatus = async (status: string) => {
    await supabase.from('equipment_assets').update({ status }).eq('id', item.id);
    qc.invalidateQueries({ queryKey: ['equipment-assets'] });
  };

  const uploadDoc = async (url: string | null) => {
    if (!url) return;
    await supabase.from('equipment_documents').insert({
      equipment_id: item.id, document_type: 'other', document_name: 'Document', document_url: url, uploaded_by: profile?.id,
    });
    qc.invalidateQueries({ queryKey: ['equipment-detail', item.id] });
  };

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {item.asset_tag}</button></td>
        <td>{item.name}<div className="text-muted" style={{ fontSize: 11 }}>{item.manufacturer} {item.model_number}</div></td>
        <td>{item.category.replace(/_/g, ' ')}</td>
        <td>{item.department ?? '—'}</td>
        <td><span className="tag tag-outline" style={CRITICALITY_STYLE[item.criticality]}>{item.criticality.replace(/_/g, ' ')}</span></td>
        <td>
          {canManage ? (
            <select className="input" value={item.status} onChange={(e) => updateStatus(e.target.value)} style={{ width: 150 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          ) : <span className="tag tag-neutral">{item.status.replace(/_/g, ' ')}</span>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <div style={{ fontSize: 12 }} className="text-muted">
                Serial {item.serial_number ?? '—'} · Purchased {item.purchase_date ?? '—'} {item.purchase_cost ? `for ₹${Number(item.purchase_cost).toLocaleString()}` : ''} · Warranty ends {item.warranty_end_date ?? '—'} · Vendor {item.vendor_name ?? '—'} {item.vendor_contact ?? ''}
              </div>
              {item.notes && <p style={{ fontSize: 13 }}>{item.notes}</p>}

              <h5 style={{ marginBottom: 4 }}>AMC / CMC contracts</h5>
              {detail?.amc?.length ? (
                <table className="table" style={{ marginBottom: 8 }}>
                  <thead><tr><th>Vendor</th><th>Type</th><th>Period</th><th>Annual cost</th><th>Status</th></tr></thead>
                  <tbody>
                    {detail.amc.map((a: any) => {
                      const expired = new Date(a.end_date) < new Date();
                      return (
                        <tr key={a.id}>
                          <td>{a.vendor_name}</td>
                          <td>{a.contract_type.toUpperCase()}</td>
                          <td>{a.start_date} → {a.end_date}</td>
                          <td>{a.annual_cost ? `₹${Number(a.annual_cost).toLocaleString()}` : '—'}</td>
                          <td><span className={`tag ${expired ? 'tag-outline' : 'tag-accent'}`} style={expired ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>{expired ? 'expired' : a.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No AMC/CMC contract on file.</p>}
              {canManage && (showAmcForm
                ? <AmcForm equipmentId={item.id} onDone={() => setShowAmcForm(false)} />
                : <button className="btn btn-secondary" onClick={() => setShowAmcForm(true)}>+ Add AMC/CMC contract</button>)}

              <h5 style={{ marginTop: 16, marginBottom: 4 }}>Documents</h5>
              {detail?.docs?.length ? (
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {detail.docs.map((d: any) => <li key={d.id}><a href={d.document_url} target="_blank" rel="noreferrer">{d.document_name}</a> — {d.document_type.replace(/_/g, ' ')}</li>)}
                </ul>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No documents uploaded.</p>}
              {canManage && (
                <div className="field" style={{ maxWidth: 300 }}>
                  <label>Upload manual / warranty / invoice</label>
                  <FileUploadField value={null} onChange={uploadDoc} folder="equipment" />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function EquipmentAssetsPage() {
  const { profile } = useAuth();
  const canManage = profile?.role === 'biomedical_engineer' || profile?.role === 'admin';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['equipment-assets', debouncedSearch],
    queryFn: async () => {
      let q = supabase.from('equipment_assets').select('*').order('asset_tag');
      if (debouncedSearch.trim()) q = q.or(`name.ilike.%${sanitizeSearchTerm(debouncedSearch)}%,asset_tag.ilike.%${sanitizeSearchTerm(debouncedSearch)}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Equipment Asset Register</h2>
        {canManage && !showAddForm && <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Register equipment</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Every diagnostic, surgical and laser instrument in the hospital. Preventive-maintenance and calibration schedules attach to these records in the next phase.
      </p>

      {showAddForm && <AddEquipmentForm onDone={() => setShowAddForm(false)} />}

      <div className="field" style={{ maxWidth: 300, marginBottom: 'var(--space-4)' }}>
        <label>Search</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Asset tag or name" />
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Asset tag</th><th>Name</th><th>Category</th><th>Department</th><th>Criticality</th><th>Status</th></tr></thead>
          <tbody>
            {items?.map((it: any) => <EquipmentRow key={it.id} item={it} canManage={canManage} />)}
            {items?.length === 0 && <tr><td colSpan={6} className="text-muted">No equipment registered yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\EquipmentAssetsPage.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\WorkforcePage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ---------------- Attendance ----------------

function AttendanceTab({ myEmployeeId, isHr }: { myEmployeeId: string | null; isHr: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: todayLog } = useQuery({
    queryKey: ['my-attendance-today', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_logs').select('*').eq('employee_id', myEmployeeId).eq('log_date', todayISO()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ['my-attendance-history', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_logs').select('*').eq('employee_id', myEmployeeId).order('log_date', { ascending: false }).limit(14);
      if (error) throw error;
      return data;
    },
  });

  const { data: allToday } = useQuery({
    queryKey: ['all-attendance-today'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_logs').select('*, employees(employee_code, profiles(full_name))').eq('log_date', todayISO()).order('check_in', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const clockIn = async () => {
    if (!myEmployeeId) return;
    setError(null);
    const { error: err } = await supabase.from('attendance_logs').insert({ employee_id: myEmployeeId, log_date: todayISO(), check_in: new Date().toISOString(), status: 'present' });
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ['my-attendance-today', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['my-attendance-history', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['all-attendance-today'] });
  };

  const clockOut = async () => {
    if (!todayLog) return;
    setError(null);
    const { error: err } = await supabase.from('attendance_logs').update({ check_out: new Date().toISOString() }).eq('id', todayLog.id);
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ['my-attendance-today', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['my-attendance-history', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['all-attendance-today'] });
  };

  if (!myEmployeeId) {
    return <p className="text-muted">HR hasn't set up an employee record for {profile?.full_name} yet — clock-in becomes available once one exists.</p>;
  }

  return (
    <div>
      <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', maxWidth: 420 }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <h4 style={{ marginTop: 0 }}>Today — {todayISO()}</h4>
        {todayLog ? (
          <div style={{ fontSize: 14 }}>
            <div>Checked in: {todayLog.check_in ? new Date(todayLog.check_in).toLocaleTimeString() : '—'}</div>
            <div>Checked out: {todayLog.check_out ? new Date(todayLog.check_out).toLocaleTimeString() : '—'}</div>
          </div>
        ) : <p className="text-muted">Not checked in yet.</p>}
        {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {!todayLog && <button className="btn btn-primary" onClick={clockIn}>Clock in</button>}
          {todayLog && !todayLog.check_out && <button className="btn btn-primary" onClick={clockOut}>Clock out</button>}
          {todayLog?.check_out && <span className="tag tag-accent">Day complete</span>}
        </div>
      </div>

      <h4>My last 14 days</h4>
      <table className="table">
        <thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead>
        <tbody>
          {history?.map((h: any) => (
            <tr key={h.id}>
              <td>{h.log_date}</td>
              <td>{h.check_in ? new Date(h.check_in).toLocaleTimeString() : '—'}</td>
              <td>{h.check_out ? new Date(h.check_out).toLocaleTimeString() : '—'}</td>
              <td><span className="tag tag-neutral">{h.status.replace(/_/g, ' ')}</span></td>
            </tr>
          ))}
          {history?.length === 0 && <tr><td colSpan={4} className="text-muted">No attendance recorded yet.</td></tr>}
        </tbody>
      </table>

      {isHr && (
        <>
          <h4 style={{ marginTop: 'var(--space-6)' }}>All staff — today</h4>
          <table className="table">
            <thead><tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead>
            <tbody>
              {allToday?.map((h: any) => (
                <tr key={h.id}>
                  <td>{h.employees?.profiles?.full_name} <span className="text-muted" style={{ fontSize: 11 }}>({h.employees?.employee_code})</span></td>
                  <td>{h.check_in ? new Date(h.check_in).toLocaleTimeString() : '—'}</td>
                  <td>{h.check_out ? new Date(h.check_out).toLocaleTimeString() : '—'}</td>
                  <td><span className="tag tag-neutral">{h.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
              {allToday?.length === 0 && <tr><td colSpan={4} className="text-muted">No one has clocked in today yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------- Leave ----------------

function LeaveApprovalRow({ req }: { req: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const decide = async (status: 'approved' | 'rejected') => {
    await supabase.from('leave_requests').update({
      status, approved_by: profile?.id, approved_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? (reason || 'Not specified') : null,
    }).eq('id', req.id);
    qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
  };

  return (
    <tr>
      <td>{req.employees?.profiles?.full_name}</td>
      <td>{req.leave_types?.name}</td>
      <td>{req.start_date} → {req.end_date} ({req.total_days}d)</td>
      <td className="text-muted">{req.reason ?? '—'}</td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => decide('approved')}>Approve</button>
          <input className="input" style={{ width: 120 }} placeholder="Reject reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => decide('rejected')}>Reject</button>
        </div>
      </td>
    </tr>
  );
}

function LeaveTab({ myEmployeeId, isHr }: { myEmployeeId: string | null; isHr: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: myRequests } = useQuery({
    queryKey: ['my-leave-requests', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_requests').select('*, leave_types(name)').eq('employee_id', myEmployeeId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pending } = useQuery({
    queryKey: ['pending-leave-requests'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_requests').select('*, employees(employee_code, profiles(full_name)), leave_types(name)').eq('status', 'pending').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myEmployeeId || !form.leave_type_id || !form.start_date || !form.end_date) return;
    const days = Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1;
    if (days <= 0) { setError('End date must be on or after the start date.'); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('leave_requests').insert({
      employee_id: myEmployeeId, leave_type_id: form.leave_type_id, start_date: form.start_date, end_date: form.end_date,
      total_days: days, reason: form.reason || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
    qc.invalidateQueries({ queryKey: ['my-leave-requests', myEmployeeId] });
    qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
  };

  return (
    <div>
      {myEmployeeId ? (
        <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', maxWidth: 560 }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h4 style={{ marginTop: 0 }}>Request leave</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label>Leave type</label>
              <select className="input" value={form.leave_type_id} onChange={(e) => set('leave_type_id', e.target.value)} required>
                <option value="">Select…</option>
                {leaveTypes?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}><label>Start date</label><input className="input" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required /></div>
            <div className="field" style={{ flex: '1 1 140px' }}><label>End date</label><input className="input" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required /></div>
            <div className="field" style={{ flex: '1 1 100%' }}><label>Reason</label><textarea className="input" value={form.reason} onChange={(e) => set('reason', e.target.value)} /></div>
          </div>
          {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit request'}</button>
          </div>
        </form>
      ) : <p className="text-muted">HR hasn't set up an employee record for {profile?.full_name} yet — leave requests become available once one exists.</p>}

      {myEmployeeId && (
        <>
          <h4>My leave requests</h4>
          <table className="table">
            <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th /></tr></thead>
            <tbody>
              {myRequests?.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.leave_types?.name}</td>
                  <td>{r.start_date} → {r.end_date}</td>
                  <td>{r.total_days}</td>
                  <td>
                    <span className="tag tag-outline" style={r.status === 'approved' ? { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' } : r.status === 'rejected' ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>
                      {r.status}
                    </span>
                    {r.status === 'rejected' && r.rejection_reason && <div className="text-muted" style={{ fontSize: 11 }}>{r.rejection_reason}</div>}
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <button
                        className="btn btn-ghost"
                        onClick={async () => {
                          await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', r.id);
                          qc.invalidateQueries({ queryKey: ['my-leave-requests', myEmployeeId] });
                          qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
                        }}
                      >
                        Withdraw
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {myRequests?.length === 0 && <tr><td colSpan={5} className="text-muted">No leave requested yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {isHr && (
        <>
          <h4 style={{ marginTop: 'var(--space-6)' }}>Pending approvals</h4>
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Reason</th><th>Decision</th></tr></thead>
            <tbody>
              {pending?.map((r: any) => <LeaveApprovalRow key={r.id} req={r} />)}
              {pending?.length === 0 && <tr><td colSpan={5} className="text-muted">Nothing pending.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------- Roster ----------------

function AssignRosterForm({ employees, shiftTemplates }: { employees: any[]; shiftTemplates: any[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employee_id: '', shift_template_id: '', roster_date: todayISO(), department: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.roster_date) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('duty_rosters').insert({
      employee_id: form.employee_id, shift_template_id: form.shift_template_id || null, roster_date: form.roster_date,
      department: form.department || null, notes: form.notes || null, created_by: profile?.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ employee_id: '', shift_template_id: '', roster_date: todayISO(), department: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['roster-upcoming-all'] });
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Assign a shift</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Employee</label>
          <select className="input" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
            <option value="">Select…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Date</label><input className="input" type="date" value={form.roster_date} onChange={(e) => set('roster_date', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Shift</label>
          <select className="input" value={form.shift_template_id} onChange={(e) => set('shift_template_id', e.target.value)}>
            <option value="">—</option>
            {shiftTemplates.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Assign shift'}</button>
      </div>
    </form>
  );
}

function AddOnCallForm({ employees }: { employees: any[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employee_id: '', department: '', start_time: '', end_time: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.start_time || !form.end_time) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('on_call_schedules').insert({
      employee_id: form.employee_id, department: form.department || null,
      on_call_date: form.start_time.slice(0, 10), start_time: form.start_time, end_time: form.end_time,
      notes: form.notes || null, created_by: profile?.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ employee_id: '', department: '', start_time: '', end_time: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['on-call-upcoming'] });
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', border: '1px dashed var(--color-divider)', marginBottom: 'var(--space-4)' }}>
      <div className="field" style={{ flex: '1 1 200px' }}>
        <label>Employee</label>
        <select className="input" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
          <option value="">Select…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.profiles?.full_name} ({e.employee_code})</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 140px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Emergency / OT" /></div>
      <div className="field" style={{ flex: '1 1 180px' }}><label>From</label><input className="input" type="datetime-local" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 180px' }}><label>To</label><input className="input" type="datetime-local" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required /></div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add on-call'}</button>
    </form>
  );
}

function RosterTab({ myEmployeeId, isHr }: { myEmployeeId: string | null; isHr: boolean }) {
  const { data: shiftTemplates } = useQuery({
    queryKey: ['shift-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_templates').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: myRoster } = useQuery({
    queryKey: ['my-roster', myEmployeeId],
    enabled: !!myEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('duty_rosters').select('*, shift_templates(name, start_time, end_time)').eq('employee_id', myEmployeeId).gte('roster_date', todayISO()).lte('roster_date', addDaysISO(14)).order('roster_date');
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoster } = useQuery({
    queryKey: ['roster-upcoming-all'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('duty_rosters').select('*, employees(employee_code, profiles(full_name)), shift_templates(name, start_time, end_time)').gte('roster_date', todayISO()).lte('roster_date', addDaysISO(14)).order('roster_date');
      if (error) throw error;
      return data;
    },
  });

  const { data: onCall } = useQuery({
    queryKey: ['on-call-upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase.from('on_call_schedules').select('*, employees(employee_code, profiles(full_name))').gte('on_call_date', todayISO()).order('on_call_date').limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: employeesForForms } = useQuery({
    queryKey: ['employees-for-roster'],
    enabled: isHr,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, employee_code, profiles(full_name)').eq('employment_status', 'active').order('employee_code');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      {isHr && <AssignRosterForm employees={employeesForForms ?? []} shiftTemplates={shiftTemplates ?? []} />}

      <h4>My upcoming shifts (next 14 days)</h4>
      <table className="table" style={{ marginBottom: 'var(--space-5)' }}>
        <thead><tr><th>Date</th><th>Shift</th><th>Department</th><th>Status</th></tr></thead>
        <tbody>
          {myRoster?.map((r: any) => (
            <tr key={r.id}>
              <td>{r.roster_date}</td>
              <td>{r.shift_templates ? `${r.shift_templates.name} (${r.shift_templates.start_time}–${r.shift_templates.end_time})` : '—'}</td>
              <td>{r.department ?? '—'}</td>
              <td><span className="tag tag-neutral">{r.status}</span></td>
            </tr>
          ))}
          {(!myEmployeeId || myRoster?.length === 0) && <tr><td colSpan={4} className="text-muted">No upcoming shifts scheduled.</td></tr>}
        </tbody>
      </table>

      <h4>On-call schedule</h4>
      {isHr && <AddOnCallForm employees={employeesForForms ?? []} />}
      <table className="table" style={{ marginBottom: 'var(--space-5)' }}>
        <thead><tr><th>Employee</th><th>Department</th><th>From</th><th>To</th></tr></thead>
        <tbody>
          {onCall?.map((o: any) => (
            <tr key={o.id}>
              <td>{o.employees?.profiles?.full_name} <span className="text-muted" style={{ fontSize: 11 }}>({o.employees?.employee_code})</span></td>
              <td>{o.department ?? '—'}</td>
              <td>{new Date(o.start_time).toLocaleString()}</td>
              <td>{new Date(o.end_time).toLocaleString()}</td>
            </tr>
          ))}
          {onCall?.length === 0 && <tr><td colSpan={4} className="text-muted">No on-call coverage scheduled.</td></tr>}
        </tbody>
      </table>

      {isHr && (
        <>
          <h4>Full roster — next 14 days</h4>
          <table className="table">
            <thead><tr><th>Date</th><th>Employee</th><th>Shift</th><th>Department</th></tr></thead>
            <tbody>
              {allRoster?.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.roster_date}</td>
                  <td>{r.employees?.profiles?.full_name}</td>
                  <td>{r.shift_templates ? r.shift_templates.name : '—'}</td>
                  <td>{r.department ?? '—'}</td>
                </tr>
              ))}
              {allRoster?.length === 0 && <tr><td colSpan={4} className="text-muted">Nothing scheduled yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export function WorkforcePage() {
  const { profile } = useAuth();
  const isHr = profile?.role === 'hr_manager' || profile?.role === 'admin';
  const [tab, setTab] = useState<'attendance' | 'leave' | 'roster'>('attendance');

  const { data: myEmployee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id').eq('profile_id', profile!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'attendance', label: 'Attendance' },
    { key: 'leave', label: 'Leave' },
    { key: 'roster', label: 'Duty Roster & On-call' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Workforce</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Attendance, leave and the duty roster — your own record, plus HR approvals if you manage them.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}
            style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'attendance' && <AttendanceTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
      {tab === 'leave' && <LeaveTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
      {tab === 'roster' && <RosterTab myEmployeeId={myEmployee?.id ?? null} isHr={isHr} />}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\WorkforcePage.tsx'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0026_workforce_asset_roles.sql' -Encoding UTF8 -NoNewline -Value @'
-- New single-purpose desks, same pattern as mrd (0019) / eye_bank (0021):
-- hr_manager runs HR, leave, attendance and the duty roster;
-- biomedical_engineer owns the equipment asset register (and, later, its
-- maintenance/calibration schedules).
alter type staff_role add value 'hr_manager';
alter type staff_role add value 'biomedical_engineer';

'@
Write-Host '  wrote supabase\migrations\0026_workforce_asset_roles.sql'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0027_hr_core.sql' -Encoding UTF8 -NoNewline -Value @'
-- ============================================================
-- NETRA HIMS — HR core: employee records, leave, attendance
-- Phase 1 of the paperless-hospital roadmap (Domain A). Employee
-- personal/financial data is a different sensitivity class from the
-- clinical tables, so reads here follow the same self-or-admin carve-out
-- already used for `profiles` (0007) rather than the staff-wide is_staff()
-- pattern used for clinical/dashboard data.
-- ============================================================

create table employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  employee_code text not null unique, -- e.g. NH-EMP-0001
  designation text,
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'visiting_consultant', 'intern')),
  employment_status text not null default 'active' check (employment_status in ('active', 'on_leave', 'suspended', 'resigned', 'terminated')),
  date_of_joining date,
  date_of_leaving date,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  personal_phone text,
  personal_email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  pan_number text,
  aadhaar_number text,
  bank_account_number text,
  bank_ifsc text,
  monthly_salary numeric(12,2),
  reporting_manager_id uuid references employees(id),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_employees_profile on employees(profile_id);
create index idx_employees_manager on employees(reporting_manager_id);
create trigger trg_employees_updated before update on employees
  for each row execute function set_updated_at();

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  document_type text not null check (document_type in ('id_proof', 'address_proof', 'educational_certificate', 'professional_license', 'contract', 'offer_letter', 'other')),
  document_name text not null,
  document_url text,
  expiry_date date, -- for licenses/registrations that need renewal tracking
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_employee_documents_employee on employee_documents(employee_id);

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_annual_days numeric(5,1) not null default 0,
  is_paid boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into leave_types (name, default_annual_days, is_paid) values
  ('Casual Leave', 12, true),
  ('Sick Leave', 12, true),
  ('Earned Leave', 15, true),
  ('Maternity Leave', 182, true),
  ('Paternity Leave', 15, true),
  ('Leave Without Pay', 0, false);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  total_days numeric(5,1) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_leave_requests_employee on leave_requests(employee_id);
create index idx_leave_requests_status on leave_requests(status);
create trigger trg_leave_requests_updated before update on leave_requests
  for each row execute function set_updated_at();

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  year int not null,
  allocated_days numeric(5,1) not null default 0,
  used_days numeric(5,1) not null default 0,
  unique (employee_id, leave_type_id, year)
);
create index idx_leave_balances_employee on leave_balances(employee_id);

create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  log_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present' check (status in ('present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off')),
  source text not null default 'web' check (source in ('web', 'manual', 'biometric')),
  remarks text,
  created_at timestamptz not null default now(),
  unique (employee_id, log_date)
);
create index idx_attendance_logs_employee on attendance_logs(employee_id);
create index idx_attendance_logs_date on attendance_logs(log_date);

-- ---------- RLS ----------
-- employees: self can read/update own row, hr_manager manages everyone.
create or replace function is_own_employee(emp_id uuid) returns boolean as $$
  select exists (select 1 from employees where id = emp_id and profile_id = auth.uid());
$$ language sql stable security definer set search_path = public;
revoke execute on function is_own_employee(uuid) from anon, public;
grant execute on function is_own_employee(uuid) to authenticated;

alter table employees enable row level security;
create policy "employees_select" on employees for select to authenticated
  using (has_role('hr_manager'::staff_role) or profile_id = auth.uid());
create policy "employees_insert" on employees for insert to authenticated
  with check (has_role('hr_manager'::staff_role));
create policy "employees_update" on employees for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "employees_delete" on employees for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

alter table employee_documents enable row level security;
create policy "employee_documents_select" on employee_documents for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "employee_documents_insert" on employee_documents for insert to authenticated
  with check (has_role('hr_manager'::staff_role));
create policy "employee_documents_update" on employee_documents for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "employee_documents_delete" on employee_documents for delete to authenticated
  using (has_role('hr_manager'::staff_role));

-- leave_types: reference list, staff-wide read (like other masters).
alter table leave_types enable row level security;
create policy "leave_types_select" on leave_types for select to authenticated using (is_staff());
create policy "leave_types_insert" on leave_types for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "leave_types_update" on leave_types for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "leave_types_delete" on leave_types for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table leave_requests enable row level security;
create policy "leave_requests_select" on leave_requests for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "leave_requests_insert" on leave_requests for insert to authenticated
  with check (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
-- hr_manager can move a request to any status (approve/reject); a staff
-- member can only withdraw their own *pending* request, never approve it
-- themselves — kept as two separate policies (OR'd together by Postgres)
-- rather than one combined check, so "approve" isn't reachable via self.
create policy "leave_requests_update_hr" on leave_requests for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "leave_requests_update_self_cancel" on leave_requests for update to authenticated
  using (is_own_employee(employee_id) and status = 'pending')
  with check (is_own_employee(employee_id) and status = 'cancelled');
create policy "leave_requests_delete" on leave_requests for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

alter table leave_balances enable row level security;
create policy "leave_balances_select" on leave_balances for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "leave_balances_insert" on leave_balances for insert to authenticated
  with check (has_role('hr_manager'::staff_role));
create policy "leave_balances_update" on leave_balances for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "leave_balances_delete" on leave_balances for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

alter table attendance_logs enable row level security;
create policy "attendance_logs_select" on attendance_logs for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "attendance_logs_insert" on attendance_logs for insert to authenticated
  with check (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "attendance_logs_update" on attendance_logs for update to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(employee_id))
  with check (has_role('hr_manager'::staff_role) or is_own_employee(employee_id));
create policy "attendance_logs_delete" on attendance_logs for delete to authenticated
  using (has_role(variadic array[]::staff_role[]));

create trigger audit_employees after insert or update or delete on employees
  for each row execute function log_audit_event();
create trigger audit_leave_requests after insert or update or delete on leave_requests
  for each row execute function log_audit_event();

'@
Write-Host '  wrote supabase\migrations\0027_hr_core.sql'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0028_duty_roster.sql' -Encoding UTF8 -NoNewline -Value @'
-- ============================================================
-- NETRA HIMS — Duty roster & on-call scheduling (Domain B)
-- Unlike the HR tables in 0027, the roster itself is operational
-- information every department needs to see (who's on today, who's
-- on-call tonight) — so reads stay staff-wide, same as clinical data.
-- Only hr_manager (and admin, via has_role) can build the roster.
-- ============================================================

create table shift_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into shift_templates (name, start_time, end_time, department) values
  ('Morning — General OPD', '08:00', '14:00', 'General OPD'),
  ('Evening — General OPD', '14:00', '20:00', 'General OPD'),
  ('OT Session — Day', '08:00', '16:00', 'OT'),
  ('Night Duty', '20:00', '08:00', null),
  ('General Shift', '09:00', '17:00', null);

create table duty_rosters (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  shift_template_id uuid references shift_templates(id),
  roster_date date not null,
  department text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'absent', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, roster_date)
);
create index idx_duty_rosters_date on duty_rosters(roster_date);
create index idx_duty_rosters_employee on duty_rosters(employee_id);

create table shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references duty_rosters(id) on delete cascade,
  requester_employee_id uuid not null references employees(id) on delete cascade,
  target_employee_id uuid references employees(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_shift_swap_roster on shift_swap_requests(roster_id);

create table on_call_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  on_call_date date not null,
  department text, -- e.g. 'emergency', 'ot'
  start_time timestamptz not null,
  end_time timestamptz not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_on_call_date on on_call_schedules(on_call_date);

-- ---------- RLS ----------
alter table shift_templates enable row level security;
create policy "shift_templates_select" on shift_templates for select to authenticated using (is_staff());
create policy "shift_templates_insert" on shift_templates for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "shift_templates_update" on shift_templates for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "shift_templates_delete" on shift_templates for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table duty_rosters enable row level security;
create policy "duty_rosters_select" on duty_rosters for select to authenticated using (is_staff());
create policy "duty_rosters_insert" on duty_rosters for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "duty_rosters_update" on duty_rosters for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "duty_rosters_delete" on duty_rosters for delete to authenticated using (has_role('hr_manager'::staff_role));

alter table shift_swap_requests enable row level security;
create policy "shift_swap_requests_select" on shift_swap_requests for select to authenticated
  using (has_role('hr_manager'::staff_role) or is_own_employee(requester_employee_id) or is_own_employee(target_employee_id));
create policy "shift_swap_requests_insert" on shift_swap_requests for insert to authenticated
  with check (has_role('hr_manager'::staff_role) or is_own_employee(requester_employee_id));
-- Same split as leave_requests: only hr_manager can approve/reject a swap;
-- the requester can withdraw their own pending request, nothing more.
create policy "shift_swap_requests_update_hr" on shift_swap_requests for update to authenticated
  using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "shift_swap_requests_update_self_cancel" on shift_swap_requests for update to authenticated
  using (is_own_employee(requester_employee_id) and status = 'pending')
  with check (is_own_employee(requester_employee_id) and status = 'cancelled');
create policy "shift_swap_requests_delete" on shift_swap_requests for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table on_call_schedules enable row level security;
create policy "on_call_schedules_select" on on_call_schedules for select to authenticated using (is_staff());
create policy "on_call_schedules_insert" on on_call_schedules for insert to authenticated with check (has_role('hr_manager'::staff_role));
create policy "on_call_schedules_update" on on_call_schedules for update to authenticated using (has_role('hr_manager'::staff_role)) with check (has_role('hr_manager'::staff_role));
create policy "on_call_schedules_delete" on on_call_schedules for delete to authenticated using (has_role('hr_manager'::staff_role));

'@
Write-Host '  wrote supabase\migrations\0028_duty_roster.sql'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0029_equipment_assets.sql' -Encoding UTF8 -NoNewline -Value @'
-- ============================================================
-- NETRA HIMS — Biomedical equipment asset register (Domain C)
-- Inventory only, no maintenance/calibration schedules yet — those are
-- Phase 2, once every instrument has an asset row to attach a schedule to.
-- Reads stay staff-wide (consistent with bills/insurance_claims, which are
-- also financial but staff-readable) — writes are biomedical_engineer-only.
-- ============================================================

create table equipment_assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique, -- e.g. NH-EQ-0001
  name text not null, -- e.g. 'Phacoemulsification Machine'
  category text not null check (category in ('diagnostic', 'surgical', 'laser', 'sterilization', 'emergency', 'it', 'other')),
  department text,
  location text, -- room / ward
  manufacturer text,
  model_number text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(12,2),
  warranty_end_date date,
  vendor_name text,
  vendor_contact text,
  criticality text not null default 'routine' check (criticality in ('life_safety', 'clinical_critical', 'routine')),
  status text not null default 'active' check (status in ('active', 'under_maintenance', 'decommissioned', 'disposed')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_equipment_assets_category on equipment_assets(category);
create index idx_equipment_assets_status on equipment_assets(status);
create trigger trg_equipment_assets_updated before update on equipment_assets
  for each row execute function set_updated_at();

create table equipment_documents (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  document_type text not null check (document_type in ('manual', 'warranty_card', 'purchase_invoice', 'calibration_certificate', 'service_report', 'other')),
  document_name text not null,
  document_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_equipment_documents_equipment on equipment_documents(equipment_id);

create table amc_contracts (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  vendor_name text not null,
  vendor_contact text,
  contract_number text,
  contract_type text not null default 'amc' check (contract_type in ('amc', 'cmc', 'warranty_extension')), -- AMC = labour only, CMC = parts included
  start_date date not null,
  end_date date not null,
  coverage_details text,
  annual_cost numeric(12,2),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_amc_contracts_equipment on amc_contracts(equipment_id);
create index idx_amc_contracts_end_date on amc_contracts(end_date);

-- ---------- RLS ----------
alter table equipment_assets enable row level security;
create policy "equipment_assets_select" on equipment_assets for select to authenticated using (is_staff());
create policy "equipment_assets_insert" on equipment_assets for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_assets_update" on equipment_assets for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_assets_delete" on equipment_assets for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table equipment_documents enable row level security;
create policy "equipment_documents_select" on equipment_documents for select to authenticated using (is_staff());
create policy "equipment_documents_insert" on equipment_documents for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_documents_update" on equipment_documents for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_documents_delete" on equipment_documents for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

alter table amc_contracts enable row level security;
create policy "amc_contracts_select" on amc_contracts for select to authenticated using (is_staff());
create policy "amc_contracts_insert" on amc_contracts for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "amc_contracts_update" on amc_contracts for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "amc_contracts_delete" on amc_contracts for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

create trigger audit_equipment_assets after insert or update or delete on equipment_assets
  for each row execute function log_audit_event();
create trigger audit_amc_contracts after insert or update or delete on amc_contracts
  for each row execute function log_audit_event();

'@
Write-Host '  wrote supabase\migrations\0029_equipment_assets.sql'

Write-Host 'All 13 files written.' -ForegroundColor Green
git add -A
git status
Write-Host "Now run: git commit -m 'Add Phase 1 foundation: HR core, duty roster, and equipment asset register' ; git push origin claude/determined-ride-o63al9" -ForegroundColor Yellow