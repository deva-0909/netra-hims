import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { VisitWorkspacePage } from './pages/VisitWorkspacePage';
import { JourneyQueuePage } from './pages/JourneyQueuePage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PharmacyQueuePage } from './pages/PharmacyQueuePage';
import { OpticalQueuePage } from './pages/OpticalQueuePage';
import { BillingQueuePage } from './pages/BillingQueuePage';
import { InsuranceDeskPage } from './pages/InsuranceDeskPage';
import { AdminStaffPage } from './pages/AdminStaffPage';

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
          Your login succeeded but no staff profile was found. Ask an admin to register you, or sign out and use
          "Register staff" on the login screen.
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
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="visits/:id" element={<VisitWorkspacePage />} />
        <Route path="journeys/:module" element={<JourneyQueuePage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="pharmacy" element={<PharmacyQueuePage />} />
        <Route path="optical" element={<OpticalQueuePage />} />
        <Route path="billing" element={<BillingQueuePage />} />
        <Route path="insurance" element={<InsuranceDeskPage />} />
        <Route path="admin/staff" element={<AdminStaffPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
