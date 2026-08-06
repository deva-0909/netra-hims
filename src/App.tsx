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
const FollowUpsPage = lazy(() => import('./pages/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })));
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
const IpdWardPage = lazy(() => import('./pages/IpdWardPage').then((m) => ({ default: m.IpdWardPage })));
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
        <Route path="ipd" element={<Suspense fallback={<PageLoading />}><IpdWardPage /></Suspense>} />
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
        <Route path="follow-ups" element={<Suspense fallback={<PageLoading />}><FollowUpsPage /></Suspense>} />
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
