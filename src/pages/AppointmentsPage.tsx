import { Fragment, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Patient } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { APPOINTMENT_REASONS } from '../modules/commonOptions';
import { useAuth } from '../lib/AuthContext';
import { collectConsultationFee, linkConsultationBillToVisit } from '../lib/collectConsultationFee';
import { SendCommunicationPanel } from '../components/SendCommunicationPanel';

function genUhid() {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `NH-${suffix}`;
}

type DateFilter = 'upcoming' | 'today' | 'past' | 'all';
const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'other'];

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

function CheckInControl({ appointment, defaultFee, doctors, onDone, onCheckedIn }: { appointment: any; defaultFee: number; doctors: { id: string; full_name: string }[]; onDone: () => void; onCheckedIn: (visitId: string) => void }) {
  const { profile } = useAuth();
  const [fee, setFee] = useState(String(defaultFee));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [doctorId, setDoctorId] = useState(appointment.doctor_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    const feeAmount = Number(fee) || 0;
    let consultationBillId: string | null = null;
    if (feeAmount > 0) {
      const { error: payError, billId } = await collectConsultationFee(appointment.patient_id, appointment.clinic_module, feeAmount, paymentMethod, profile?.id);
      if (payError || !billId) { setSaving(false); setError(payError ?? 'Could not collect the consultation fee.'); return; }
      consultationBillId = billId;
    }
    const token = await generateToken(appointment.clinic_module);
    const { data: visit, error: visitError } = await supabase.from('visits').insert({
      patient_id: appointment.patient_id, appointment_id: appointment.id, clinic_module: appointment.clinic_module, stage: 'waiting', token_number: token,
      attending_doctor_id: doctorId || null,
    }).select().single();
    if (visitError || !visit) { setSaving(false); setError(visitError?.message ?? 'Could not create the visit.'); return; }
    if (consultationBillId) await linkConsultationBillToVisit(consultationBillId, visit.id);
    const { error: statusError } = await supabase.from('appointments').update({ status: 'checked_in', doctor_id: doctorId || null }).eq('id', appointment.id);
    setSaving(false);
    if (statusError) { setError(`Visit was created, but the appointment status didn't update: ${statusError.message}`); return; }
    onCheckedIn(visit.id);
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="input" style={{ width: 90 }} type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} title="Consultation fee" />
      <select className="input" style={{ width: 120 }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
      </select>
      <select className="input" style={{ width: 160 }} value={doctorId} onChange={(e) => setDoctorId(e.target.value)} title="Attending doctor">
        <option value="">— No doctor assigned —</option>
        {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
      </select>
      <button className="btn btn-primary" onClick={confirm} disabled={saving}>{saving ? 'Processing…' : 'Confirm & check in'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

export function AppointmentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestId = params.get('requestId');
  const { profile } = useAuth();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedPatientQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [clinicModule, setClinicModule] = useState('general');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingInApptId, setCheckingInApptId] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('upcoming');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [remindingApptId, setRemindingApptId] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const { data: request } = useQuery({
    queryKey: ['appointment-request', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase.from('appointment_requests').select('*').eq('id', requestId).single();
      if (error) throw error;
      return data;
    },
  });

  // Deep-linked from a request — a receptionist calling the patient back
  // shouldn't have to retype what they already submitted online.
  useEffect(() => {
    if (request && !prefilled) {
      setPatientQuery(request.phone ?? request.full_name ?? '');
      setClinicModule(request.preferred_clinic_module ?? 'general');
      if (request.preferred_date) setScheduledAt(`${request.preferred_date}T09:00`);
      if (request.reason) setReason(request.reason);
      setPrefilled(true);
    }
  }, [request, prefilled]);

  const { data: matches } = useQuery({
    queryKey: ['patient-search', debouncedPatientQuery],
    enabled: debouncedPatientQuery.length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').is('merged_into', null).or(`full_name.ilike.%${debouncedPatientQuery}%,uhid.ilike.%${debouncedPatientQuery}%,phone.ilike.%${debouncedPatientQuery}%`).limit(8);
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });

  const registerFromRequest = async () => {
    if (!request) return;
    setRegistering(true);
    setRegisterError(null);
    const { data: newPatient, error } = await supabase.from('patients').insert({
      full_name: request.full_name, phone: request.phone, uhid: genUhid(), created_by: profile?.id,
    }).select().single();
    setRegistering(false);
    if (error || !newPatient) { setRegisterError(error?.message ?? 'Could not register the patient.'); return; }
    setSelectedPatient(newPatient as Patient);
    setPatientQuery('');
  };

  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(id, full_name, uhid, phone, email)')
        .order('scheduled_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: fees } = useQuery({
    queryKey: ['consultation-fees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultation_fees').select('*');
      if (error) throw error;
      return data as { clinic_module: string; fee: number }[];
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-for-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'doctor').eq('active', true).order('full_name');
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
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
      doctor_id: doctorId || null,
    });
    setSaving(false);
    if (error) {
      setScheduleError(error.message);
      return;
    }
    if (requestId && request?.status === 'pending') {
      await supabase.from('appointment_requests').update({ status: 'contacted', staff_notes: [request.staff_notes, 'Appointment scheduled.'].filter(Boolean).join(' ') }).eq('id', requestId);
    }
    setSelectedPatient(null);
    setPatientQuery('');
    setScheduledAt('');
    setReason('');
    setDoctorId('');
    setParams({});
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['appointment-requests'] });
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
        {request && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 8 }}>
            From request by {request.full_name} ({request.phone}) — submitted {new Date(request.created_at).toLocaleDateString()}.
          </div>
        )}
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
          <div className="field">
            <label>Preferred doctor</label>
            <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">— Any —</option>
              {doctors?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={schedule} disabled={saving || !selectedPatient}>Schedule</button>
        </div>
        {!selectedPatient && request && (!matches || matches.length === 0) && (
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            No matching patient. <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 12 }} onClick={registerFromRequest} disabled={registering}>
              {registering ? 'Registering…' : `Register ${request.full_name} as a new patient`}
            </button>
          </p>
        )}
        {!selectedPatient && !request && <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No matching patient yet? <Link to="/patients?new=1">Register one</Link>.</p>}
        {registerError && <div style={{ color: '#b64545', fontSize: 13, marginTop: 4 }}>{registerError}</div>}
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
        <thead><tr><th>When</th><th>Patient</th><th>Module</th><th>Doctor</th><th>Status</th><th /></tr></thead>
        <tbody>
          {filtered.map((a: any) => (
            <Fragment key={a.id}>
            <tr>
              <td>{new Date(a.scheduled_at).toLocaleString()}</td>
              <td>
                {a.patients?.full_name} <span className="text-muted">({a.patients?.uhid})</span>
                {a.is_walk_in && <span className="tag tag-outline" style={{ marginLeft: 6, fontSize: 10 }}>walk-in</span>}
              </td>
              <td>{MODULES[a.clinic_module]?.label ?? a.clinic_module}</td>
              <td className="text-muted">{doctors?.find((d) => d.id === a.doctor_id)?.full_name ?? '—'}</td>
              <td><span className="tag tag-neutral">{a.status.replace(/_/g, ' ')}</span></td>
              <td>
                {a.status === 'scheduled' && (
                  reschedulingId === a.id ? (
                    <RescheduleControl appointment={a} onDone={() => setReschedulingId(null)} />
                  ) : checkingInApptId === a.id ? (
                    <CheckInControl
                      appointment={a}
                      defaultFee={fees?.find((f) => f.clinic_module === a.clinic_module)?.fee ?? 0}
                      doctors={doctors ?? []}
                      onDone={() => setCheckingInApptId(null)}
                      onCheckedIn={(visitId) => { setCheckingInApptId(null); qc.invalidateQueries({ queryKey: ['appointments'] }); navigate(`/visits/${visitId}`); }}
                    />
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost" onClick={() => setCheckingInApptId(a.id)}>Check in</button>
                      <button className="btn btn-ghost" onClick={() => setReschedulingId(a.id)}>Reschedule</button>
                      <button className="btn btn-ghost" onClick={() => setRemindingApptId(remindingApptId === a.id ? null : a.id)}>Send reminder</button>
                      <button className="btn btn-ghost" onClick={() => updateStatus(a.id, 'no_show')}>No-show</button>
                      <button className="btn btn-ghost" onClick={() => updateStatus(a.id, 'cancelled')}>Cancel</button>
                    </div>
                  )
                )}
              </td>
            </tr>
            {remindingApptId === a.id && a.patients && (
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  <SendCommunicationPanel
                    patient={a.patients}
                    context={{
                      appointment_date: new Date(a.scheduled_at).toLocaleDateString(),
                      appointment_time: new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }}
                    onClose={() => setRemindingApptId(null)}
                  />
                </td>
              </tr>
            )}
            </Fragment>
          ))}
          {filtered.length === 0 && <tr><td colSpan={6} className="text-muted">No appointments in this range.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
