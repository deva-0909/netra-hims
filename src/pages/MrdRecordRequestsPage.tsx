import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const REQUESTOR_TYPES = ['patient', 'insurance', 'legal', 'referring_doctor', 'other'];
const STATUSES = ['requested', 'approved', 'issued', 'rejected'];

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [form, setForm] = useState({ requestor_type: 'patient', requestor_name: '', purpose: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['mrd-patient-search', debouncedQuery],
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
    const { error: insertError } = await supabase.from('record_requests').insert({
      patient_id: selectedPatient.id,
      requestor_type: form.requestor_type,
      requestor_name: form.requestor_name || null,
      purpose: form.purpose || null,
      notes: form.notes || null,
      authorized_by: profile?.id,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['record-requests'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log record request</h4>
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
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Requestor type</label>
          <select className="input" value={form.requestor_type} onChange={(e) => set('requestor_type', e.target.value)}>
            {REQUESTOR_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Requestor name</label><input className="input" value={form.requestor_name} onChange={(e) => set('requestor_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Purpose</label><input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="e.g. insurance claim, legal proceeding, referral" /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving || !selectedPatient}>{saving ? 'Saving…' : 'Log request'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function MrdRecordRequestsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['record-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('record_requests').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const payload: Record<string, any> = { status };
    if (status === 'issued') payload.issued_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('record_requests').update(payload).eq('id', id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['record-requests'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Record Request Register</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log request</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>Every disclosure of a patient's record outside the hospital — to the patient, an insurer, a legal request, or a referring doctor — logged with who authorized it.</p>

      {showForm && <NewRequestForm onDone={() => setShowForm(false)} />}
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Requestor</th><th>Purpose</th><th>Logged</th><th>Status</th></tr></thead>
          <tbody>
            {requests?.map((r: any) => (
              <tr key={r.id}>
                <td>{r.patients?.full_name} <span className="text-muted">({r.patients?.uhid})</span></td>
                <td>{r.requestor_type.replace(/_/g, ' ')}{r.requestor_name ? ` — ${r.requestor_name}` : ''}</td>
                <td>{r.purpose ?? '—'}</td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <select className="input" value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} style={{ width: 150 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {requests?.length === 0 && <tr><td colSpan={5} className="text-muted">No record requests logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
