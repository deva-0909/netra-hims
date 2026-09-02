import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { portalSupabase } from '../lib/portalSupabaseClient';
import { usePortalAuth } from '../lib/PortalAuthContext';

function ProfileTab({ patient }: { patient: any }) {
  return (
    <div className="card" style={{ padding: 'var(--space-4)', maxWidth: 480 }}>
      <h4 style={{ marginTop: 0 }}>{patient.full_name}</h4>
      <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div><span className="text-muted">UHID:</span> {patient.uhid}</div>
        <div><span className="text-muted">Date of birth:</span> {patient.date_of_birth ?? '—'}</div>
        <div><span className="text-muted">Gender:</span> {patient.gender ?? '—'}</div>
        <div><span className="text-muted">Phone:</span> {patient.phone ?? '—'}</div>
        <div><span className="text-muted">Email:</span> {patient.email ?? '—'}</div>
      </div>
      <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-3)' }}>To update these details, contact the hospital front desk.</p>
    </div>
  );
}

function AppointmentsTab({ patientId }: { patientId: string }) {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['portal-appointments', patientId],
    queryFn: async () => {
      const { data, error } = await portalSupabase.from('appointments').select('*').eq('patient_id', patientId).order('scheduled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted">Loading…</p>;
  return (
    <table className="table">
      <thead><tr><th>Date</th><th>Clinic</th><th>Status</th></tr></thead>
      <tbody>
        {appointments?.map((a: any) => (
          <tr key={a.id}>
            <td>{new Date(a.scheduled_at).toLocaleString()}</td>
            <td>{a.clinic_module?.replace(/_/g, ' ')}</td>
            <td><span className="tag tag-outline">{a.status}</span></td>
          </tr>
        ))}
        {appointments?.length === 0 && <tr><td colSpan={3} className="text-muted">No appointments on file.</td></tr>}
      </tbody>
    </table>
  );
}

function BillsTab({ patientId }: { patientId: string }) {
  const { data: bills, isLoading } = useQuery({
    queryKey: ['portal-bills', patientId],
    queryFn: async () => {
      const { data, error } = await portalSupabase.from('bills').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted">Loading…</p>;
  return (
    <table className="table">
      <thead><tr><th>Date</th><th>Bill #</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead>
      <tbody>
        {bills?.map((b: any) => (
          <tr key={b.id}>
            <td>{new Date(b.created_at).toLocaleDateString()}</td>
            <td>{b.bill_number}</td>
            <td>₹{Number(b.total_amount).toLocaleString()}</td>
            <td>₹{Number(b.amount_paid).toLocaleString()}</td>
            <td><span className="tag tag-outline">{b.payment_status?.replace(/_/g, ' ')}</span></td>
          </tr>
        ))}
        {bills?.length === 0 && <tr><td colSpan={5} className="text-muted">No bills on file.</td></tr>}
      </tbody>
    </table>
  );
}

function LabReportsTab({ patientId }: { patientId: string }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['portal-lab-orders', patientId],
    queryFn: async () => {
      const { data, error } = await portalSupabase.from('lab_orders').select('*, lab_order_items(*, lab_test_catalog(test_name, unit))').eq('patient_id', patientId).order('order_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted">Loading…</p>;
  return (
    <div>
      {orders?.map((o: any) => {
        const verifiedItems = (o.lab_order_items ?? []).filter((it: any) => it.status === 'verified');
        if (verifiedItems.length === 0) return null;
        return (
          <div key={o.id} className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div className="text-muted" style={{ fontSize: 12 }}>{new Date(o.order_date).toLocaleDateString()}</div>
            <table className="table" style={{ marginTop: 4 }}>
              <thead><tr><th>Test</th><th>Result</th></tr></thead>
              <tbody>
                {verifiedItems.map((it: any) => (
                  <tr key={it.id}><td>{it.lab_test_catalog?.test_name}</td><td>{it.result_value ?? it.result_numeric} {it.lab_test_catalog?.unit ?? ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {(!orders || orders.every((o: any) => (o.lab_order_items ?? []).every((it: any) => it.status !== 'verified'))) && (
        <p className="text-muted">No lab reports available yet.</p>
      )}
    </div>
  );
}

export function PortalDashboardPage() {
  const { session, patient, loading, signOut } = usePortalAuth();
  const [tab, setTab] = useState<'profile' | 'appointments' | 'bills' | 'labs'>('profile');

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!session) return <Navigate to="/portal/login" replace />;
  if (!patient) {
    return (
      <div style={{ padding: 40, maxWidth: 480 }}>
        <h3>No patient record linked</h3>
        <p className="text-muted">Your login succeeded, but no patient record is linked to this account yet. Sign in again with your UHID, or contact the hospital front desk.</p>
        <button className="btn btn-secondary" onClick={signOut}>Sign out</button>
      </div>
    );
  }

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'profile', label: 'My Profile' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'bills', label: 'Bills' },
    { key: 'labs', label: 'Lab Reports' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20 }}>NETRA HIMS — Patient Portal</div>
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Welcome, {patient.full_name}</p>
        </div>
        <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab patient={patient} />}
      {tab === 'appointments' && <AppointmentsTab patientId={patient.id} />}
      {tab === 'bills' && <BillsTab patientId={patient.id} />}
      {tab === 'labs' && <LabReportsTab patientId={patient.id} />}
    </div>
  );
}
