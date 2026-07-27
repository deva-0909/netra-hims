import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';

const PRIORITIES = [
  { value: 'critical', label: 'Critical — immediate attention (e.g. penetrating trauma, chemical injury)' },
  { value: 'urgent', label: 'Urgent — within the hour (e.g. sudden vision loss, acute severe pain)' },
  { value: 'semi_urgent', label: 'Semi-urgent — same day (e.g. foreign body, moderate injury)' },
];

export function EmergencyTriagePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [clinicModule, setClinicModule] = useState('general');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [onsetDescription, setOnsetDescription] = useState('');
  const [priority, setPriority] = useState('urgent');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['triage-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedQuery);
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !chiefComplaint.trim()) return;
    setSaving(true);
    setError(null);

    const token = await generateToken(clinicModule);
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .insert({
        patient_id: selectedPatient.id,
        clinic_module: clinicModule,
        stage: 'waiting',
        token_number: token,
        is_emergency: true,
        triage_priority: priority,
      })
      .select()
      .single();

    if (visitError || !visit) {
      setSaving(false);
      setError(visitError?.message ?? 'Could not create visit.');
      return;
    }

    const { error: triageError } = await supabase.from('emergency_triage_notes').insert({
      visit_id: visit.id,
      chief_complaint: chiefComplaint,
      onset_description: onsetDescription || null,
      priority,
      triaged_by: profile?.id,
    });

    setSaving(false);
    if (triageError) {
      setError(`Visit created, but the triage note failed to save: ${triageError.message}`);
      return;
    }
    navigate(`/visits/${visit.id}`);
  };

  return (
    <div>
      <h2>Emergency Triage</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        For urgent cases that need to bypass the normal appointment queue. This generates a priority-flagged token immediately and routes the patient straight into the right clinic.
      </p>

      <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', maxWidth: 700 }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div className="field" style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
          <label>Patient *</label>
          <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
            </div>
          )}
          {!selectedPatient && <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>Patient not registered yet? <Link to="/patients?new=1">Register them first</Link>, then return here.</div>}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Route to clinic</label>
            <select className="input" value={clinicModule} onChange={(e) => setClinicModule(e.target.value)}>
              {Object.values(MODULES).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 100%' }}>
            <label>Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label>Chief complaint *</label>
          <textarea className="input" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} required placeholder="e.g. sudden loss of vision in left eye since this morning" />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label>Onset / additional details</label>
          <textarea className="input" value={onsetDescription} onChange={(e) => setOnsetDescription(e.target.value)} placeholder="When did it start, any known cause, relevant history" />
        </div>

        {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving || !selectedPatient}>
          {saving ? 'Creating priority visit…' : 'Generate priority token & start visit'}
        </button>
      </form>
    </div>
  );
}
