# Netra HIMS — remove-decorative-arrows.ps1
# Run once from your project root (E:\netra-hims-app\netra-hims-app)
$root = Get-Location
Write-Host "Writing files under: $root"

$dest = Join-Path $root "src\App.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
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
        <Route path="admin/reports" element={<Suspense fallback={<PageLoading />}><AdminReportsPage /></Suspense>} />
        <Route path="admin/audit-log" element={<Suspense fallback={<PageLoading />}><AdminAuditLogPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\App.tsx"

$dest = Join-Path $root "src\modules\custom\AdmissionStage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { FileUploadField } from '../../components/FileUploadField';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { OT_ROOMS } from '../commonOptions';
import { advanceVisitStageTo } from '../../lib/advanceVisitStage';
import type { VisitStage } from '../../lib/types';

export function AdmissionStage({ visitId, stageOrder }: { visitId: string; stageOrder: VisitStage[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [bedId, setBedId] = useState('');
  const [consentSigned, setConsentSigned] = useState(false);
  const [consentFileUrl, setConsentFileUrl] = useState<string | null>(null);
  const [otForm, setOtForm] = useState({ procedure_name: '', eye: 'od', ot_room: '' });
  const [vitalsForm, setVitalsForm] = useState({ blood_pressure: '', pulse: '', temperature: '', spo2: '', notes: '' });
  const [recoveryForm, setRecoveryForm] = useState({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
  const [saving, setSaving] = useState(false);
  const [admitError, setAdmitError] = useState<string | null>(null);
  const [otError, setOtError] = useState<string | null>(null);
  const [vitalsError, setVitalsError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [dischargeError, setDischargeError] = useState<string | null>(null);

  const { data: admission } = useQuery({
    queryKey: ['admission', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('admissions').select('*, beds(bed_number, ward), ot_records(*, recovery_records(*)), ward_vitals(*)').eq('visit_id', visitId).order('admitted_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: availableBeds } = useQuery({
    queryKey: ['available-beds'],
    enabled: !admission,
    queryFn: async () => {
      const { data, error } = await supabase.from('beds').select('*').eq('status', 'available').order('bed_number');
      if (error) throw error;
      return data;
    },
  });

  const admitPatient = async () => {
    setSaving(true);
    setAdmitError(null);
    const { error } = await supabase.from('admissions').insert({
      visit_id: visitId,
      bed_id: bedId || null,
      consent_signed: consentSigned,
      consent_file_url: consentFileUrl,
      admitted_by: profile?.id,
    });
    if (error) {
      setSaving(false);
      setAdmitError(error.message);
      return;
    }
    if (bedId) {
      await supabase.from('beds').update({ status: 'occupied' }).eq('id', bedId);
      qc.invalidateQueries({ queryKey: ['available-beds'] });
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    await advanceVisitStageTo(visitId, 'admission', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const addVitals = async () => {
    if (!admission) return;
    setSaving(true);
    setVitalsError(null);
    const { error } = await supabase.from('ward_vitals').insert({
      admission_id: admission.id,
      blood_pressure: vitalsForm.blood_pressure || null,
      pulse: vitalsForm.pulse || null,
      temperature: vitalsForm.temperature || null,
      spo2: vitalsForm.spo2 || null,
      notes: vitalsForm.notes || null,
      recorded_by: profile?.id,
    });
    setSaving(false);
    if (error) {
      setVitalsError(error.message);
      return;
    }
    setVitalsForm({ blood_pressure: '', pulse: '', temperature: '', spo2: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
  };

  const addOt = async () => {
    if (!admission || !otForm.procedure_name.trim()) return;
    setSaving(true);
    setOtError(null);
    const { error } = await supabase.from('ot_records').insert({
      admission_id: admission.id,
      procedure_name: otForm.procedure_name,
      eye: otForm.eye,
      ot_room: otForm.ot_room || null,
      surgeon_id: profile?.id,
      status: 'completed',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
    });
    if (error) {
      setSaving(false);
      setOtError(error.message);
      return;
    }
    setSaving(false);
    setOtForm({ procedure_name: '', eye: 'od', ot_room: '' });
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    await advanceVisitStageTo(visitId, 'ot', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const latestOt = admission?.ot_records?.[admission.ot_records.length - 1];

  const addRecovery = async () => {
    if (!latestOt) return;
    setSaving(true);
    setRecoveryError(null);
    const { error } = await supabase.from('recovery_records').insert({
      ot_record_id: latestOt.id,
      vitals_notes: recoveryForm.vitals_notes || null,
      pain_score: Number(recoveryForm.pain_score) || 0,
      discharge_instructions: recoveryForm.discharge_instructions || null,
      monitored_by: profile?.id,
    });
    if (error) {
      setSaving(false);
      setRecoveryError(error.message);
      return;
    }
    setSaving(false);
    setRecoveryForm({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    await advanceVisitStageTo(visitId, 'recovery', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const dischargePatient = async () => {
    if (!admission) return;
    setSaving(true);
    setDischargeError(null);
    const { error } = await supabase.from('admissions').update({ discharged_at: new Date().toISOString() }).eq('id', admission.id);
    if (error) {
      setSaving(false);
      setDischargeError(error.message);
      return;
    }
    if (admission.bed_id) {
      await supabase.from('beds').update({ status: 'available' }).eq('id', admission.bed_id);
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    qc.invalidateQueries({ queryKey: ['available-beds'] });
    await advanceVisitStageTo(visitId, 'completed', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>Admission &amp; Digital Consent</h4>
        {admission ? (
          <div style={{ fontSize: 14 }}>
            Admitted {new Date(admission.admitted_at).toLocaleString()} · Bed {admission.beds?.bed_number ?? admission.bed_number ?? '—'} {admission.beds?.ward ? `(${admission.beds.ward})` : ''} ·{' '}
            <span className={`tag ${admission.consent_signed ? 'tag-accent' : 'tag-outline'}`}>
              consent {admission.consent_signed ? 'signed' : 'pending'}
            </span>
            {admission.consent_file_url && (
              <>
                {' '}
                <a href={admission.consent_file_url} target="_blank" rel="noreferrer">View consent document</a>
              </>
            )}
            <div style={{ marginTop: 10 }}>
              {admission.discharged_at ? (
                <span className="tag tag-accent">Discharged {new Date(admission.discharged_at).toLocaleString()}</span>
              ) : (
                <button className="btn btn-primary" onClick={dischargePatient} disabled={saving}>
                  {saving ? 'Discharging…' : 'Discharge patient'}
                </button>
              )}
              {dischargeError && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{dischargeError}</div>}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 'var(--space-3)' }}>
              <div className="field">
                <label>Bed</label>
                <select className="input" value={bedId} onChange={(e) => setBedId(e.target.value)}>
                  <option value="">— unassigned —</option>
                  {availableBeds?.map((b: any) => <option key={b.id} value={b.id}>{b.bed_number} {b.ward ? `(${b.ward})` : ''}</option>)}
                </select>
                {availableBeds?.length === 0 && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>No beds currently available</div>}
              </div>
              <label className="radio">
                <input type="checkbox" checked={consentSigned} onChange={(e) => setConsentSigned(e.target.checked)} />
                <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} /> Consent signed
              </label>
              <button className="btn btn-primary" onClick={admitPatient} disabled={saving}>Admit patient</button>
            </div>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Signed consent document</label>
              <FileUploadField value={consentFileUrl} onChange={setConsentFileUrl} folder="admissions" />
            </div>
            {admitError && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{admitError}</div>}
          </>
        )}
      </div>

      {admission && !admission.discharged_at && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>Ward vitals</h4>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <input className="input" style={{ flex: '0 1 120px' }} placeholder="BP (e.g. 120/80)" value={vitalsForm.blood_pressure} onChange={(e) => setVitalsForm((p) => ({ ...p, blood_pressure: e.target.value }))} />
            <input className="input" type="number" style={{ flex: '0 1 100px' }} placeholder="Pulse" value={vitalsForm.pulse} onChange={(e) => setVitalsForm((p) => ({ ...p, pulse: e.target.value }))} />
            <input className="input" type="number" step="0.1" style={{ flex: '0 1 100px' }} placeholder="Temp (°F)" value={vitalsForm.temperature} onChange={(e) => setVitalsForm((p) => ({ ...p, temperature: e.target.value }))} />
            <input className="input" type="number" style={{ flex: '0 1 100px' }} placeholder="SpO2 (%)" value={vitalsForm.spo2} onChange={(e) => setVitalsForm((p) => ({ ...p, spo2: e.target.value }))} />
            <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={vitalsForm.notes} onChange={(e) => setVitalsForm((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn btn-secondary" onClick={addVitals} disabled={saving}>+ Record vitals</button>
          </div>
          {vitalsError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{vitalsError}</div>}
          {admission.ward_vitals?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {[...admission.ward_vitals].reverse().map((v: any) => (
                <li key={v.id}>BP {v.blood_pressure || '—'} · Pulse {v.pulse || '—'} · Temp {v.temperature || '—'} · SpO2 {v.spo2 || '—'} — {new Date(v.recorded_at).toLocaleString()}</li>
              ))}
            </ul>
          ) : <p className="text-muted">No ward vitals recorded yet.</p>}
        </div>
      )}

      {admission && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>OT record</h4>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Procedure name" value={otForm.procedure_name} onChange={(e) => setOtForm((p) => ({ ...p, procedure_name: e.target.value }))} />
            <select className="input" style={{ flex: '0 1 100px' }} value={otForm.eye} onChange={(e) => setOtForm((p) => ({ ...p, eye: e.target.value }))}>
              <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
            </select>
            <div style={{ flex: '0 1 170px' }}><SelectOrOtherInput value={otForm.ot_room} options={OT_ROOMS} onChange={(v) => setOtForm((p) => ({ ...p, ot_room: v }))} placeholder="OT room" /></div>
            <button className="btn btn-secondary" onClick={addOt} disabled={saving}>+ Record OT</button>
          </div>
          {otError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{otError}</div>}
          {admission.ot_records?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {admission.ot_records.map((ot: any) => (
                <li key={ot.id}>{ot.procedure_name} ({ot.eye}) — {ot.status}</li>
              ))}
            </ul>
          ) : <p className="text-muted">No OT records yet.</p>}
        </div>
      )}

      {latestOt && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>Recovery</h4>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Vitals notes" value={recoveryForm.vitals_notes} onChange={(e) => setRecoveryForm((p) => ({ ...p, vitals_notes: e.target.value }))} />
            <input className="input" style={{ flex: '0 1 100px' }} type="number" min={0} max={10} placeholder="Pain 0-10" value={recoveryForm.pain_score} onChange={(e) => setRecoveryForm((p) => ({ ...p, pain_score: e.target.value }))} />
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Discharge instructions" value={recoveryForm.discharge_instructions} onChange={(e) => setRecoveryForm((p) => ({ ...p, discharge_instructions: e.target.value }))} />
            <button className="btn btn-secondary" onClick={addRecovery} disabled={saving}>+ Record recovery</button>
          </div>
          {recoveryError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{recoveryError}</div>}
          {latestOt.recovery_records?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {latestOt.recovery_records.map((r: any) => (
                <li key={r.id}>Pain {r.pain_score}/10 — {r.vitals_notes || 'no notes'} ({new Date(r.recorded_at).toLocaleString()})</li>
              ))}
            </ul>
          ) : <p className="text-muted">No recovery entries yet.</p>}
        </div>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\modules\custom\AdmissionStage.tsx"

$dest = Join-Path $root "src\components\RecordHistory.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { StageConfig } from '../modules/fieldTypes';

interface Props {
  stage: StageConfig;
  filterColumn: string;
  filterValue: string;
  refreshKey?: number;
}

export function RecordHistory({ stage, filterColumn, filterValue, refreshKey }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['history', stage.table, filterColumn, filterValue, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(stage.table)
        .select('*')
        .eq(filterColumn, filterValue)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-muted">Loading history…</p>;
  if (!data || data.length === 0) return <p className="text-muted">No records yet for this stage.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {data.map((row: any) => (
        <div key={row.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div className="card-meta">{new Date(row.created_at).toLocaleString()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 16px', fontSize: 13 }}>
            {stage.fields.map((f) => {
              const v = row[f.name];
              if (v === null || v === undefined || v === '') return null;
              return (
                <div key={f.name}>
                  <span className="text-muted">{f.label}: </span>
                  {f.type === 'file' ? (
                    <a href={String(v)} target="_blank" rel="noreferrer">View file</a>
                  ) : (
                    <span>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\components\RecordHistory.tsx"

$dest = Join-Path $root "src\pages\PharmacyQueuePage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { dispensePrescription } from '../lib/dispensePrescription';

export function PharmacyQueuePage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  const { data: dispenses, isLoading } = useQuery({
    queryKey: ['pharmacy-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacy_dispenses')
        .select('*, prescriptions(*, visits(patient_id, patients(full_name, uhid)), prescription_items(*, drugs(name)))')
        .order('dispensed_at', { ascending: false, nullsFirst: true });
      if (error) throw error;
      return data;
    },
  });

  const markDispensed = async (dispenseId: string, prescriptionId: string) => {
    setError(null);
    setDispensingId(dispenseId);
    const { error } = await dispensePrescription(dispenseId, prescriptionId, profile?.id);
    setDispensingId(null);
    if (error) {
      setError(error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  const pending = dispenses?.filter((d: any) => d.status !== 'dispensed') ?? [];
  const dispensed = dispenses?.filter((d: any) => d.status === 'dispensed') ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Pharmacy — Dispensing Queue</h2>
        <Link className="btn btn-secondary" to="/pharmacy/inventory">Inventory & stock</Link>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <>
          <h4>Awaiting dispense ({pending.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pending.map((d: any) => (
              <div key={d.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)' }}>
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{d.prescriptions?.visits?.patients?.full_name} ({d.prescriptions?.visits?.patients?.uhid})</strong>
                  <span className="tag tag-outline">{d.status.replace(/_/g, ' ')}</span>
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                  {d.prescriptions?.prescription_items?.map((it: any) => (
                    <li key={it.id}>{it.drugs?.name ?? it.drug_name_freetext} × {it.quantity} — {it.dosage} {it.frequency}</li>
                  ))}
                </ul>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => markDispensed(d.id, d.prescription_id)}
                  disabled={dispensingId === d.id}
                >
                  {dispensingId === d.id ? 'Dispensing…' : 'Mark dispensed'}
                </button>
              </div>
            ))}
            {pending.length === 0 && <p className="text-muted">Nothing waiting — the queue is clear.</p>}
          </div>

          <h4>Recently dispensed</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {dispensed.slice(0, 10).map((d: any) => (
              <div key={d.id} className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{d.prescriptions?.visits?.patients?.full_name} ({d.prescriptions?.visits?.patients?.uhid})</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>{d.dispensed_at ? new Date(d.dispensed_at).toLocaleString() : ''}</span>
                </div>
              </div>
            ))}
            {dispensed.length === 0 && <p className="text-muted">No dispenses yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\PharmacyQueuePage.tsx"

$dest = Join-Path $root "src\pages\WaitingBoardPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { MODULES } from '../modules/moduleConfig';

export function WaitingBoardPage() {
  const navigate = useNavigate();
  const [moduleFilter, setModuleFilter] = useState('all');

  const { data: visits, isLoading } = useQuery({
    queryKey: ['waiting-board'],
    refetchInterval: 30_000, // reception wants this to stay current without manual refresh
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, patients(full_name, uhid, phone)')
        .not('stage', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const visible = (visits ?? []).filter((v: any) => moduleFilter === 'all' || v.clinic_module === moduleFilter);

  const countsByModule = (visits ?? []).reduce((acc: Record<string, number>, v: any) => {
    acc[v.clinic_module] = (acc[v.clinic_module] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Waiting Room — All Clinics</h2>
        <span className="text-muted" style={{ fontSize: 12 }}>Auto-refreshes every 30s</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <button className={`btn ${moduleFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setModuleFilter('all')}>
          All ({visits?.length ?? 0})
        </button>
        {Object.values(MODULES).map((m) => (
          <button key={m.key} className={`btn ${moduleFilter === m.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setModuleFilter(m.key)}>
            {m.label} ({countsByModule[m.key] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Token</th><th>Patient</th><th>Phone</th><th>Clinic</th><th>Stage</th><th>Waiting since</th><th /></tr></thead>
          <tbody>
            {visible.map((v: any) => {
              const waitedMinutes = Math.round((Date.now() - new Date(v.created_at).getTime()) / 60000);
              return (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
                  <td><span className="tag tag-accent">{v.token_number ?? '—'}</span></td>
                  <td>{v.patients?.full_name} <span className="text-muted">({v.patients?.uhid})</span></td>
                  <td>{v.patients?.phone ?? '—'}</td>
                  <td>{MODULES[v.clinic_module]?.label ?? v.clinic_module}</td>
                  <td><span className="tag tag-neutral">{v.stage.replace(/_/g, ' ')}</span></td>
                  <td className={waitedMinutes > 45 ? 'text-muted' : undefined} style={waitedMinutes > 45 ? { color: '#b64545' } : undefined}>
                    {waitedMinutes} min
                  </td>
                  <td><button className="btn btn-ghost">Open</button></td>
                </tr>
              );
            })}
            {visible.length === 0 && <tr><td colSpan={7} className="text-muted">Nobody waiting right now.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\WaitingBoardPage.tsx"

$dest = Join-Path $root "src\pages\PatientDetailPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Patient, Visit, ClinicModule } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { GUARDIAN_RELATIONS, INSURANCE_SCHEMES, BLOOD_GROUPS } from '../modules/commonOptions';

const EDIT_FIELDS: { key: keyof Patient; label: string; type: 'text' | 'date' | 'select' | 'select_or_other'; options?: string[] }[] = [
  { key: 'full_name', label: 'Full name', type: 'text' },
  { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['male', 'female', 'other'] },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'guardian_name', label: 'Guardian name', type: 'text' },
  { key: 'guardian_relation', label: 'Guardian relation', type: 'select_or_other', options: GUARDIAN_RELATIONS },
  { key: 'abha_id', label: 'ABHA ID', type: 'text' },
  { key: 'golden_card_id', label: 'Golden Card ID', type: 'text' },
  { key: 'insurance_provider', label: 'Insurance provider', type: 'select_or_other', options: INSURANCE_SCHEMES },
  { key: 'insurance_policy_no', label: 'Insurance policy no.', type: 'text' },
  { key: 'blood_group', label: 'Blood group', type: 'select', options: BLOOD_GROUPS },
  { key: 'known_allergies', label: 'Known allergies (free text — safety-critical, not list-constrained)', type: 'text' },
];

function EditPatientForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, (patient[f.key] as string) ?? '']))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, string | null> = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    const { error: updateError } = await supabase.from('patients').update(payload).eq('id', patient.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['patient', patient.id] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Edit patient details</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {EDIT_FIELDS.map((f) => (
          <div className="field" key={f.key} style={{ flex: '1 1 220px' }}>
            <label>{f.label}</label>
            {f.type === 'select' ? (
              <select className="input" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">—</option>
                {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : f.type === 'select_or_other' ? (
              <SelectOrOtherInput value={form[f.key]} options={f.options ?? []} onChange={(v) => set(f.key, v)} />
            ) : (
              <input className="input" type={f.type} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newVisitModule, setNewVisitModule] = useState<ClinicModule>('general');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Patient;
    },
  });

  const { data: visits } = useQuery({
    queryKey: ['visits', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('visits').select('*').eq('patient_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Visit[];
    },
  });

  const toggleVerify = async (field: 'abha_verified' | 'golden_card_verified' | 'insurance_verified') => {
    if (!patient) return;
    setError(null);
    const { error: updateError } = await supabase.from('patients').update({ [field]: !patient[field] }).eq('id', patient.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['patient', id] });
  };

  const startVisit = async () => {
    setCreating(true);
    setError(null);
    const token = await generateToken(newVisitModule);
    const { data, error: insertError } = await supabase
      .from('visits')
      .insert({ patient_id: id, clinic_module: newVisitModule, stage: 'waiting', token_number: token })
      .select()
      .single();
    setCreating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      // Record this as a walk-in appointment too, so it shows up in Appointments'
      // history/stats instead of only existing as a visit with no paper trail.
      // Non-blocking: the visit itself already succeeded, so a failure here
      // shouldn't stop the user from proceeding — just note it.
      const { error: aptError } = await supabase.from('appointments').insert({
        patient_id: id,
        clinic_module: newVisitModule,
        scheduled_at: new Date().toISOString(),
        status: 'checked_in',
        is_walk_in: true,
        token_number: token,
      });
      if (aptError) {
        console.warn('Walk-in appointment record failed to save:', aptError.message);
      }
      navigate(`/visits/${data.id}`);
    }
  };

  if (!patient) return <p className="text-muted">Loading patient…</p>;

  return (
    <div>
      <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h2 style={{ margin: 0 }}>{patient.full_name}</h2>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {patient.uhid} · {patient.gender ?? '—'} · {patient.phone ?? 'no phone'} · DOB {patient.date_of_birth ?? '—'}
            </div>
            {patient.known_allergies && (
              <div style={{ marginTop: 6 }}><span className="tag" style={{ background: '#f6dede', color: '#8a2c2c' }}>Allergies: {patient.known_allergies}</span></div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span className={`tag ${patient.abha_verified ? 'tag-accent' : 'tag-outline'}`} style={{ cursor: 'pointer' }} onClick={() => toggleVerify('abha_verified')}>
              ABHA {patient.abha_verified ? 'verified' : 'unverified'}
            </span>
            <span className={`tag ${patient.golden_card_verified ? 'tag-accent' : 'tag-outline'}`} style={{ cursor: 'pointer' }} onClick={() => toggleVerify('golden_card_verified')}>
              Golden Card {patient.golden_card_verified ? 'verified' : 'unverified'}
            </span>
            <span className={`tag ${patient.insurance_verified ? 'tag-accent' : 'tag-outline'}`} style={{ cursor: 'pointer' }} onClick={() => toggleVerify('insurance_verified')}>
              Insurance {patient.insurance_verified ? 'verified' : 'unverified'}
            </span>
            {!editing && <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit details</button>}
          </div>
        </div>
      </div>

      {editing && <EditPatientForm patient={patient} onDone={() => setEditing(false)} />}

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0 }}>Start a new visit</h4>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Clinic module</label>
            <select className="input" value={newVisitModule} onChange={(e) => setNewVisitModule(e.target.value as ClinicModule)}>
              {Object.values(MODULES).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={startVisit} disabled={creating}>
            {creating ? 'Starting…' : 'Generate token & start visit'}
          </button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <h4>Visit history</h4>
      <table className="table">
        <thead><tr><th>Date</th><th>Module</th><th>Stage</th><th>Token</th><th /></tr></thead>
        <tbody>
          {visits?.map((v) => (
            <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
              <td>{new Date(v.created_at).toLocaleString()}</td>
              <td>{MODULES[v.clinic_module]?.label ?? v.clinic_module}</td>
              <td><span className="tag tag-neutral">{v.stage.replace(/_/g, ' ')}</span></td>
              <td>{v.token_number ?? '—'}</td>
              <td><button className="btn btn-ghost">Open</button></td>
            </tr>
          ))}
          {visits?.length === 0 && <tr><td colSpan={5} className="text-muted">No visits yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\PatientDetailPage.tsx"

$dest = Join-Path $root "src\pages\BillingQueuePage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { BillPaymentControls } from '../components/BillPaymentControls';

export function BillingQueuePage() {
  const qc = useQueryClient();
  const { data: bills, isLoading } = useQuery({
    queryKey: ['all-bills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bills')
        .select('*, patients(full_name, uhid), visits(clinic_module)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Billing</h2>
        <Link className="btn btn-secondary" to="/billing/collections">Today's collections</Link>
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Bill #</th><th>Patient</th><th>Module</th><th>Total</th><th>Payment</th></tr></thead>
          <tbody>
            {bills?.map((b: any) => (
              <tr key={b.id}>
                <td>{b.bill_number}</td>
                <td>
                  {b.patients?.full_name} <span className="text-muted">({b.patients?.uhid})</span>
                </td>
                <td>{b.visits?.clinic_module ?? '—'}</td>
                <td>₹{Number(b.total_amount).toFixed(2)}</td>
                <td><BillPaymentControls bill={b} patient={b.patients} onChanged={() => qc.invalidateQueries({ queryKey: ['all-bills'] })} /></td>
              </tr>
            ))}
            {bills?.length === 0 && <tr><td colSpan={5} className="text-muted">No bills yet. Generate one from a visit's Billing tab — <Link to="/patients">open a patient</Link> to start.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\BillingQueuePage.tsx"

$dest = Join-Path $root "src\pages\InsuranceDeskPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const STATUSES = ['eligibility_check', 'pre_auth_requested', 'approved', 'rejected', 'settled'];

export function InsuranceDeskPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: claims, isLoading } = useQuery({
    queryKey: ['insurance-claims'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_claims').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('insurance_claims').update({ status }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['insurance-claims'] });
  };

  return (
    <div>
      <h2>Insurance Desk</h2>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Scheme</th><th>Package</th><th>Claim / Approved</th><th>Document</th><th>Status</th></tr></thead>
          <tbody>
            {claims?.map((c: any) => (
              <tr key={c.id}>
                <td>{c.patients?.full_name} <span className="text-muted">({c.patients?.uhid})</span></td>
                <td>{c.scheme ?? '—'}</td>
                <td>{c.package_selected ?? '—'}</td>
                <td>₹{Number(c.claim_amount ?? 0).toFixed(0)} / ₹{Number(c.approved_amount ?? 0).toFixed(0)}</td>
                <td>{c.document_url ? <a href={c.document_url} target="_blank" rel="noreferrer">View</a> : <span className="text-muted">—</span>}</td>
                <td>
                  <select className="input" value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} style={{ width: 180 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {claims?.length === 0 && <tr><td colSpan={6} className="text-muted">No insurance claims yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\InsuranceDeskPage.tsx"

$dest = Join-Path $root "src\pages\AppointmentsPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Patient } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { APPOINTMENT_REASONS } from '../modules/commonOptions';

type DateFilter = 'upcoming' | 'today' | 'past' | 'all';

function RescheduleControl({ appointment, onDone }: { appointment: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(appointment.scheduled_at.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('appointments').update({ scheduled_at: new Date(value).toISOString() }).eq('id', appointment.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['appointments'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="input" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 190 }} />
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

export function AppointmentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedPatientQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [clinicModule, setClinicModule] = useState('general');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('upcoming');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['patient-search', debouncedPatientQuery],
    enabled: debouncedPatientQuery.length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${debouncedPatientQuery}%,uhid.ilike.%${debouncedPatientQuery}%`).limit(8);
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(full_name, uhid)')
        .order('scheduled_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const schedule = async () => {
    if (!selectedPatient || !scheduledAt) return;
    setSaving(true);
    setScheduleError(null);
    const { error } = await supabase.from('appointments').insert({
      patient_id: selectedPatient.id,
      clinic_module: clinicModule,
      scheduled_at: new Date(scheduledAt).toISOString(),
      reason: reason || null,
      is_walk_in: false,
    });
    setSaving(false);
    if (error) {
      setScheduleError(error.message);
      return;
    }
    setSelectedPatient(null);
    setPatientQuery('');
    setScheduledAt('');
    setReason('');
    qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  const checkIn = async (apt: any) => {
    setCheckingInId(apt.id);
    setCheckInError(null);
    const token = await generateToken(apt.clinic_module);
    const { data: visit, error } = await supabase.from('visits').insert({
      patient_id: apt.patient_id, appointment_id: apt.id, clinic_module: apt.clinic_module, stage: 'waiting', token_number: token,
    }).select().single();
    if (error) {
      setCheckingInId(null);
      setCheckInError(error.message);
      return;
    }
    const { error: statusError } = await supabase.from('appointments').update({ status: 'checked_in' }).eq('id', apt.id);
    qc.invalidateQueries({ queryKey: ['appointments'] });
    setCheckingInId(null);
    if (statusError) {
      setCheckInError(`Visit was created, but the appointment status didn't update: ${statusError.message}`);
    }
    if (visit) navigate(`/visits/${visit.id}`);
  };

  const updateStatus = async (id: string, status: 'cancelled' | 'no_show') => {
    setCheckInError(null);
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) {
      setCheckInError(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

  const filtered = (appointments ?? []).filter((a: any) => {
    const t = new Date(a.scheduled_at);
    if (dateFilter === 'today') return t >= todayStart && t < todayEnd;
    if (dateFilter === 'upcoming') return t >= now;
    if (dateFilter === 'past') return t < now;
    return true;
  });

  return (
    <div>
      <h2>Appointments</h2>

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0 }}>Schedule new appointment</h4>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 240px', position: 'relative' }}>
            <label>Patient</label>
            <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
              onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
            {!selectedPatient && matches && matches.length > 0 && (
              <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                {matches.map((p) => (
                  <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Clinic module</label>
            <select className="input" value={clinicModule} onChange={(e) => setClinicModule(e.target.value)}>
              {Object.values(MODULES).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Date &amp; time</label>
            <input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Reason</label>
            <SelectOrOtherInput value={reason} options={APPOINTMENT_REASONS} onChange={setReason} />
          </div>
          <button className="btn btn-primary" onClick={schedule} disabled={saving || !selectedPatient}>Schedule</button>
        </div>
        {!selectedPatient && <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No matching patient yet? <Link to="/patients?new=1">Register one</Link>.</p>}
        {scheduleError && <div style={{ color: '#b64545', fontSize: 13, marginTop: 4 }}>{scheduleError}</div>}
      </div>

      {checkInError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{checkInError}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-3)' }}>
        {(['upcoming', 'today', 'past', 'all'] as DateFilter[]).map((f) => (
          <button key={f} className={`btn ${dateFilter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDateFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <table className="table">
        <thead><tr><th>When</th><th>Patient</th><th>Module</th><th>Status</th><th /></tr></thead>
        <tbody>
          {filtered.map((a: any) => (
            <tr key={a.id}>
              <td>{new Date(a.scheduled_at).toLocaleString()}</td>
              <td>
                {a.patients?.full_name} <span className="text-muted">({a.patients?.uhid})</span>
                {a.is_walk_in && <span className="tag tag-outline" style={{ marginLeft: 6, fontSize: 10 }}>walk-in</span>}
              </td>
              <td>{MODULES[a.clinic_module]?.label ?? a.clinic_module}</td>
              <td><span className="tag tag-neutral">{a.status.replace(/_/g, ' ')}</span></td>
              <td>
                {a.status === 'scheduled' && (
                  reschedulingId === a.id ? (
                    <RescheduleControl appointment={a} onDone={() => setReschedulingId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost" onClick={() => checkIn(a)} disabled={checkingInId === a.id}>
                        {checkingInId === a.id ? 'Checking in…' : 'Check in'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setReschedulingId(a.id)}>Reschedule</button>
                      <button className="btn btn-ghost" onClick={() => updateStatus(a.id, 'no_show')}>No-show</button>
                      <button className="btn btn-ghost" onClick={() => updateStatus(a.id, 'cancelled')}>Cancel</button>
                    </div>
                  )
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={5} className="text-muted">No appointments in this range.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\AppointmentsPage.tsx"

$dest = Join-Path $root "src\pages\OpticalQueuePage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { updateOpticalOrderStatus } from '../lib/dispenseOpticalOrder';

const STATUSES = ['ordered', 'in_fabrication', 'ready', 'dispensed', 'cancelled'];

export function OpticalQueuePage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['optical-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('optical_orders').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (order: any, status: string) => {
    setError(null);
    setUpdatingId(order.id);
    const { error } = await updateOpticalOrderStatus(order.id, status, order.frame_item_id);
    setUpdatingId(null);
    if (error) {
      setError(error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['optical-orders'] });
    qc.invalidateQueries({ queryKey: ['eyewear-items'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Optical Shop — Order Tracking</h2>
        <Link className="btn btn-secondary" to="/optical/inventory">Inventory & stock</Link>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Order #</th><th>Patient</th><th>Frame</th><th>Lens</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {orders?.map((o: any) => (
              <tr key={o.id}>
                <td>{o.order_number}</td>
                <td>{o.patients?.full_name} <span className="text-muted">({o.patients?.uhid})</span></td>
                <td>{o.frame_brand} {o.frame_model}</td>
                <td>{o.lens_type}</td>
                <td>₹{Number(o.total_amount ?? 0).toFixed(2)}</td>
                <td>
                  <select className="input" value={o.status} onChange={(e) => updateStatus(o, e.target.value)} disabled={updatingId === o.id} style={{ width: 160 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {orders?.length === 0 && <tr><td colSpan={6} className="text-muted">No optical orders yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\OpticalQueuePage.tsx"

$dest = Join-Path $root "src\pages\JourneyQueuePage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { MODULES } from '../modules/moduleConfig';

export function JourneyQueuePage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const config = module ? MODULES[module] : undefined;

  const { data: visits, isLoading } = useQuery({
    queryKey: ['journey-queue', module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, patients(full_name, uhid, phone)')
        .eq('clinic_module', module)
        .not('stage', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!config) return <p>Unknown module.</p>;

  return (
    <div>
      <h2>{config.label} — Active Queue</h2>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Token</th><th>Patient</th><th>UHID</th><th>Stage</th><th>Started</th><th /></tr></thead>
          <tbody>
            {visits?.map((v: any) => (
              <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
                <td>{v.token_number ?? '—'}</td>
                <td>{v.patients?.full_name}</td>
                <td>{v.patients?.uhid}</td>
                <td><span className="tag tag-neutral">{v.stage.replace(/_/g, ' ')}</span></td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
                <td><button className="btn btn-ghost">Open</button></td>
              </tr>
            ))}
            {visits?.length === 0 && <tr><td colSpan={6} className="text-muted">No active visits in this clinic right now.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\JourneyQueuePage.tsx"

$dest = Join-Path $root "src\pages\PatientsPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { GUARDIAN_RELATIONS, INSURANCE_SCHEMES, BLOOD_GROUPS } from '../modules/commonOptions';
import type { Patient } from '../lib/types';

function generateUhid() {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `NH-${suffix}`;
}

function PatientForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', gender: '', phone: '', email: '', address: '',
    guardian_name: '', guardian_relation: '', abha_id: '', golden_card_id: '',
    insurance_provider: '', insurance_policy_no: '', blood_group: '', known_allergies: '',
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setSaving(true);
    setError(null);
    const payload: any = { ...form, uhid: generateUhid(), created_by: profile?.id };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    const { error: insertError } = await supabase.from('patients').insert(payload);
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['patients'] });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Register patient — Walk-in / New</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label>Full name *</label>
          <input className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Date of birth</label>
          <input type="date" className="input" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Gender</label>
          <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Phone</label>
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}>
          <label>Address</label>
          <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>

        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Guardian name (if minor / guardian-assisted)</label>
          <input className="input" value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Guardian relation</label>
          <SelectOrOtherInput value={form.guardian_relation} options={GUARDIAN_RELATIONS} onChange={(v) => set('guardian_relation', v)} />
        </div>

        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>ABHA ID</label>
          <input className="input" value={form.abha_id} onChange={(e) => set('abha_id', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Golden Card ID</label>
          <input className="input" value={form.golden_card_id} onChange={(e) => set('golden_card_id', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Insurance provider</label>
          <SelectOrOtherInput value={form.insurance_provider} options={INSURANCE_SCHEMES} onChange={(v) => set('insurance_provider', v)} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Insurance policy no.</label>
          <input className="input" value={form.insurance_policy_no} onChange={(e) => set('insurance_policy_no', e.target.value)} />
        </div>

        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Blood group</label>
          <select className="input" value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)}>
            <option value="">—</option>
            {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}>
          <label>Known allergies</label>
          <input className="input" value={form.known_allergies} onChange={(e) => set('known_allergies', e.target.value)} placeholder="Free text — allergy details are safety-critical, not constrained to a list" />
        </div>
      </div>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}

      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Register patient'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function PatientsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const showForm = params.get('new') === '1';

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', debouncedSearch],
    queryFn: async () => {
      let q = supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(50);
      if (debouncedSearch.trim()) {
        q = q.or(`full_name.ilike.%${debouncedSearch}%,uhid.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Patient[];
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Patients</h2>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setParams({ new: '1' })}>+ Register patient</button>
        )}
      </div>

      {showForm && <PatientForm onDone={() => setParams({})} />}

      <div className="field" style={{ maxWidth: 360, marginBottom: 'var(--space-4)' }}>
        <label>Search by name, UHID or phone</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Existing Patient Search" />
      </div>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>UHID</th><th>Name</th><th>Phone</th><th>Gender</th><th>Registered</th><th /></tr>
          </thead>
          <tbody>
            {patients?.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${p.id}`)}>
                <td>{p.uhid}</td>
                <td>{p.full_name}</td>
                <td>{p.phone ?? '—'}</td>
                <td>{p.gender ?? '—'}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
                <td><Link className="btn btn-ghost" to={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()}>Open</Link></td>
              </tr>
            ))}
            {patients?.length === 0 && (
              <tr><td colSpan={6} className="text-muted">No patients found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\PatientsPage.tsx"

$dest = Join-Path $root "src\pages\AdminAuditLogPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const TABLES = ['bills', 'insurance_claims', 'profiles'];

function summarizeChange(entry: any): string {
  if (entry.action === 'INSERT') return 'Created';
  if (entry.action === 'DELETE') return 'Deleted';
  // For updates, show which fields actually changed
  const oldV = entry.old_value ?? {};
  const newV = entry.new_value ?? {};
  const changed = Object.keys(newV).filter((k) => k !== 'updated_at' && JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]));
  if (changed.length === 0) return 'Updated';
  return `Changed: ${changed.map((k) => `${k} set to ${newV[k]}`).join(', ')}`;
}

export function AdminAuditLogPage() {
  const [tableFilter, setTableFilter] = useState('all');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['audit-log', tableFilter],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*, profiles!audit_log_changed_by_fkey(full_name)').order('changed_at', { ascending: false }).limit(100);
      if (tableFilter !== 'all') q = q.eq('table_name', tableFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <h2>Audit Log</h2>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Tracks changes to bills, insurance claims, and staff profiles — the tables where "who changed this" matters most.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)' }}>
        <button className={`btn ${tableFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTableFilter('all')}>All</button>
        {TABLES.map((t) => (
          <button key={t} className={`btn ${tableFilter === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTableFilter(t)}>
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Table</th><th>Action</th><th>By</th><th>Details</th></tr></thead>
          <tbody>
            {entries?.map((e: any) => (
              <tr key={e.id}>
                <td>{new Date(e.changed_at).toLocaleString()}</td>
                <td>{e.table_name}</td>
                <td><span className="tag tag-neutral">{e.action}</span></td>
                <td>{e.profiles?.full_name ?? 'system'}</td>
                <td style={{ fontSize: 12 }}>{summarizeChange(e)}</td>
              </tr>
            ))}
            {entries?.length === 0 && <tr><td colSpan={5} className="text-muted">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\AdminAuditLogPage.tsx"

$dest = Join-Path $root "src\components\PatientChartSummary.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { ModuleConfig } from '../modules/fieldTypes';

interface Props {
  visitId: string;
  moduleConfig: ModuleConfig;
  excludeStageKey?: string; // don't repeat the tab the user is currently on
}

/** Fetches the single latest row from every non-custom stage table for this
 * visit, in parallel, so a doctor can see what pretesting/prior exams already
 * found without clicking through every tab first. */
export function PatientChartSummary({ visitId, moduleConfig, excludeStageKey }: Props) {
  const [open, setOpen] = useState(false);

  const stages = moduleConfig.stages.filter((s) => !s.custom && s.key !== excludeStageKey && s.fields.length > 0);

  const { data } = useQuery({
    queryKey: ['chart-summary', visitId, moduleConfig.key],
    enabled: open,
    queryFn: async () => {
      const results = await Promise.all(
        stages.map(async (s) => {
          const { data } = await supabase
            .from(s.table)
            .select('*')
            .eq('visit_id', visitId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return { stage: s, row: data };
        })
      );
      return results.filter((r) => r.row);
    },
  });

  return (
    <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--color-text)' }}
      >
        {open ? '[Hide]' : '[Show]'} Patient chart summary
        <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 400 }}>
          — everything recorded so far on this visit, at a glance
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
          {data === undefined && <p className="text-muted" style={{ gridColumn: '1 / -1' }}>Loading…</p>}
          {data?.length === 0 && <p className="text-muted" style={{ gridColumn: '1 / -1' }}>No prior records on this visit yet.</p>}
          {data?.map(({ stage, row }) => (
            <div key={stage.key} className="card" style={{ padding: 'var(--space-3)', background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{stage.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginBottom: 6 }}>{new Date(row.created_at).toLocaleString()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
                {stage.fields.map((f) => {
                  const v = row[f.name];
                  if (v === null || v === undefined || v === '' || f.type === 'file') return null;
                  return (
                    <div key={f.name}>
                      <span className="text-muted">{f.label}: </span>
                      <span>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\components\PatientChartSummary.tsx"

Write-Host ""
Write-Host "Done. Now run: npm run build" -ForegroundColor Green