import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Patient, Visit, ClinicModule } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { DbSelectOrOtherInput } from '../components/DbSelectOrOtherInput';
import { GUARDIAN_RELATIONS, BLOOD_GROUPS } from '../modules/commonOptions';
import { printPatientRegistrationSlip } from '../lib/printPatientRegistrationSlip';

const EDIT_FIELDS: { key: keyof Patient; label: string; type: 'text' | 'date' | 'select' | 'select_or_other' | 'db_select_or_other'; options?: string[]; dbTable?: string; dbColumn?: string }[] = [
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
  { key: 'insurance_provider', label: 'Insurance provider', type: 'db_select_or_other', dbTable: 'insurance_masters', dbColumn: 'scheme_name' },
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
            ) : f.type === 'db_select_or_other' ? (
              <DbSelectOrOtherInput value={form[f.key]} dbTable={f.dbTable!} dbColumn={f.dbColumn!} onChange={(v) => set(f.key, v)} />
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
            <button className="btn btn-ghost" onClick={() => printPatientRegistrationSlip(patient)}>Print registration slip</button>
            <Link className="btn btn-ghost" to={`/patients/${patient.id}/pacs`}>Imaging archive</Link>
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