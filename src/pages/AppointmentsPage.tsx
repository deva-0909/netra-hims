import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Patient } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';

export function AppointmentsPage() {
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [clinicModule, setClinicModule] = useState('general');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: matches } = useQuery({
    queryKey: ['patient-search', patientQuery],
    enabled: patientQuery.length > 1,
    queryFn: async () => {
      const { data } = await supabase.from('patients').select('*').or(`full_name.ilike.%${patientQuery}%,uhid.ilike.%${patientQuery}%`).limit(8);
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
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const schedule = async () => {
    if (!selectedPatient || !scheduledAt) return;
    setSaving(true);
    await supabase.from('appointments').insert({
      patient_id: selectedPatient.id,
      clinic_module: clinicModule,
      scheduled_at: new Date(scheduledAt).toISOString(),
      reason: reason || null,
    });
    setSaving(false);
    setSelectedPatient(null);
    setPatientQuery('');
    setScheduledAt('');
    setReason('');
    qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  const checkIn = async (apt: any) => {
    const { data: visit } = await supabase.from('visits').insert({
      patient_id: apt.patient_id, appointment_id: apt.id, clinic_module: apt.clinic_module, stage: 'waiting',
    }).select().single();
    await supabase.from('appointments').update({ status: 'checked_in' }).eq('id', apt.id);
    qc.invalidateQueries({ queryKey: ['appointments'] });
    if (visit) window.location.href = `/visits/${visit.id}`;
  };

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
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={schedule} disabled={saving || !selectedPatient}>Schedule</button>
        </div>
        {!selectedPatient && <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No matching patient yet? <Link to="/patients?new=1">Register one</Link>.</p>}
      </div>

      <table className="table">
        <thead><tr><th>When</th><th>Patient</th><th>Module</th><th>Status</th><th /></tr></thead>
        <tbody>
          {appointments?.map((a: any) => (
            <tr key={a.id}>
              <td>{new Date(a.scheduled_at).toLocaleString()}</td>
              <td>{a.patients?.full_name} <span className="text-muted">({a.patients?.uhid})</span></td>
              <td>{MODULES[a.clinic_module]?.label ?? a.clinic_module}</td>
              <td><span className="tag tag-neutral">{a.status.replace(/_/g, ' ')}</span></td>
              <td>{a.status === 'scheduled' && <button className="btn btn-ghost" onClick={() => checkIn(a)}>Check in →</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
