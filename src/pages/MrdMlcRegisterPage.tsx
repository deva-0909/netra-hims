import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const CASE_TYPES = ['road_traffic_accident', 'assault', 'burn', 'poisoning', 'suicide_attempt', 'other'];
const STATUSES = ['reported', 'pending_police_action', 'closed'];

function genMlcNumber() {
  const year = new Date().getFullYear();
  return `MLC-${year}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function NewMlcForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [form, setForm] = useState({ case_type: 'road_traffic_accident', incident_date: '', incident_details: '', police_station: '', intimation_reference: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['mrd-patient-search-mlc', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${debouncedQuery}%,uhid.ilike.%${debouncedQuery}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('mlc_cases').insert({
      patient_id: selectedPatient.id,
      mlc_number: genMlcNumber(),
      case_type: form.case_type,
      incident_date: form.incident_date || null,
      incident_details: form.incident_details || null,
      police_station: form.police_station || null,
      intimation_reference: form.intimation_reference || null,
      reported_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['mlc-cases'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Register MLC case</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 240px', position: 'relative' }}>
          <label>Patient *</label>
          <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
            </div>
          )}
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Case type</label>
          <select className="input" value={form.case_type} onChange={(e) => set('case_type', e.target.value)}>
            {CASE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Incident date</label><input className="input" type="date" value={form.incident_date} onChange={(e) => set('incident_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Incident details</label><textarea className="input" value={form.incident_details} onChange={(e) => set('incident_details', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Police station</label><input className="input" value={form.police_station} onChange={(e) => set('police_station', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Intimation reference</label><input className="input" value={form.intimation_reference} onChange={(e) => set('intimation_reference', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving || !selectedPatient}>{saving ? 'Saving…' : 'Register case'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function MrdMlcRegisterPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: cases, isLoading } = useQuery({
    queryKey: ['mlc-cases'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mlc_cases').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('mlc_cases').update({ status }).eq('id', id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['mlc-cases'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>MLC Register</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Register MLC</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>Medico-Legal Cases requiring police reporting — road traffic accidents, assault, burns, poisoning, suicide attempts.</p>

      {showForm && <NewMlcForm onDone={() => setShowForm(false)} />}
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>MLC #</th><th>Patient</th><th>Case Type</th><th>Incident Date</th><th>Police Station</th><th>Status</th></tr></thead>
          <tbody>
            {cases?.map((c: any) => (
              <tr key={c.id}>
                <td>{c.mlc_number}</td>
                <td>{c.patients?.full_name} <span className="text-muted">({c.patients?.uhid})</span></td>
                <td>{c.case_type.replace(/_/g, ' ')}</td>
                <td>{c.incident_date ? new Date(c.incident_date).toLocaleDateString() : '—'}</td>
                <td>{c.police_station ?? '—'}</td>
                <td>
                  <select className="input" value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} style={{ width: 170 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {cases?.length === 0 && <tr><td colSpan={6} className="text-muted">No MLC cases registered yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
