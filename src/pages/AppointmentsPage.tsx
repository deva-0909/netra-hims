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
