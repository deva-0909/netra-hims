import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Patient, Visit, ClinicModule } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { DbSelectOrOtherInput } from '../components/DbSelectOrOtherInput';
import { GUARDIAN_RELATIONS, BLOOD_GROUPS, REFERRAL_SOURCES } from '../modules/commonOptions';
import { printPatientRegistrationSlip } from '../lib/printPatientRegistrationSlip';
import { useAuth } from '../lib/AuthContext';
import { collectConsultationFee, linkConsultationBillToVisit } from '../lib/collectConsultationFee';
import { SendCommunicationPanel } from '../components/SendCommunicationPanel';
import { MergePatientPanel } from '../components/MergePatientPanel';
import { PatientChartSummary } from '../components/PatientChartSummary';
import { FileUploadField } from '../components/FileUploadField';

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'other'];

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
  { key: 'emergency_contact_name', label: 'Emergency contact name', type: 'text' },
  { key: 'emergency_contact_phone', label: 'Emergency contact phone', type: 'text' },
  { key: 'referral_source', label: 'Referral source', type: 'select_or_other', options: REFERRAL_SOURCES },
];

function EditPatientForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, (patient[f.key] as string) ?? '']))
  );
  const [photoUrl, setPhotoUrl] = useState(patient.photo_url);
  const [commOptOut, setCommOptOut] = useState(patient.communication_opt_out);
  const [referringDoctorId, setReferringDoctorId] = useState(patient.referring_doctor_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: referringDoctors } = useQuery({
    queryKey: ['referring-doctors-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('referring_doctors').select('id, full_name, clinic_or_hospital_name').eq('active', true).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, string | boolean | null> = { ...form, photo_url: photoUrl, communication_opt_out: commOptOut, referring_doctor_id: referringDoctorId || null };
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
      <div className="field" style={{ marginBottom: 'var(--space-3)', maxWidth: 300 }}>
        <label>Photo</label>
        <FileUploadField value={photoUrl} onChange={setPhotoUrl} folder="patient_photos" />
      </div>
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
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Referring doctor</label>
          <select className="input" value={referringDoctorId} onChange={(e) => setReferringDoctorId(e.target.value)}>
            <option value="">—</option>
            {referringDoctors?.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}{d.clinic_or_hospital_name ? ` (${d.clinic_or_hospital_name})` : ''}</option>)}
          </select>
        </div>
      </div>
      <label className="radio" style={{ marginTop: 'var(--space-3)' }}>
        <input type="checkbox" checked={commOptOut} onChange={(e) => setCommOptOut(e.target.checked)} />
        <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} /> Patient has opted out of SMS/WhatsApp/email communication
      </label>
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
  const { profile } = useAuth();
  const [newVisitModule, setNewVisitModule] = useState<ClinicModule>('general');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [feeOverride, setFeeOverride] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [merging, setMerging] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Patient;
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
  const defaultFee = fees?.find((f) => f.clinic_module === newVisitModule)?.fee ?? 0;
  const fee = feeOverride !== null ? Number(feeOverride) : defaultFee;

  const { data: doctors } = useQuery({
    queryKey: ['doctors-for-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'doctor').eq('active', true).order('full_name');
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
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

    let consultationBillId: string | null = null;
    if (fee > 0) {
      const { error: payError, billId } = await collectConsultationFee(id!, newVisitModule, fee, paymentMethod, profile?.id);
      if (payError || !billId) {
        setCreating(false);
        setError(payError ?? 'Could not collect the consultation fee.');
        return;
      }
      consultationBillId = billId;
    }

    const token = await generateToken(newVisitModule);
    const { data, error: insertError } = await supabase
      .from('visits')
      .insert({ patient_id: id, clinic_module: newVisitModule, stage: 'waiting', token_number: token, attending_doctor_id: doctorId || null })
      .select()
      .single();
    if (insertError) {
      setCreating(false);
      setError(insertError.message);
      return;
    }
    if (data && consultationBillId) {
      await linkConsultationBillToVisit(consultationBillId, data.id);
    }
    setCreating(false);
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

  const { data: mergedIntoPatient } = useQuery({
    queryKey: ['patient', patient?.merged_into],
    enabled: !!patient?.merged_into,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('id, full_name, uhid').eq('id', patient!.merged_into!).single();
      if (error) throw error;
      return data;
    },
  });

  if (!patient) return <p className="text-muted">Loading patient…</p>;

  const isMerged = !!patient.merged_into;

  return (
    <div>
      {isMerged && (
        <div className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-4)', background: '#f6dede', borderColor: '#e0a3a3' }}>
          This record has been merged into{' '}
          {mergedIntoPatient ? (
            <Link to={`/patients/${mergedIntoPatient.id}`}><strong>{mergedIntoPatient.full_name} ({mergedIntoPatient.uhid})</strong></Link>
          ) : 'another patient'}. Use that record going forward — this one is kept for history only.
        </div>
      )}

      {!isMerged && visits && visits.length > 0 && (
        <PatientChartSummary visitId={visits[0].id} moduleConfig={MODULES[visits[0].clinic_module]} />
      )}

      <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            {patient.photo_url && <img src={patient.photo_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-divider)' }} />}
            <div>
              <h2 style={{ margin: 0 }}>{patient.full_name}</h2>
              <div className="text-muted" style={{ fontSize: 13 }}>
                {patient.uhid} · {patient.gender ?? '—'} · {patient.phone ?? 'no phone'} · DOB {patient.date_of_birth ?? '—'}
              </div>
              {patient.known_allergies && (
                <div style={{ marginTop: 6 }}><span className="tag" style={{ background: '#f6dede', color: '#8a2c2c' }}>Allergies: {patient.known_allergies}</span></div>
              )}
              {(patient.emergency_contact_name || patient.communication_opt_out) && (
                <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {patient.emergency_contact_name && <span>Emergency: {patient.emergency_contact_name} {patient.emergency_contact_phone ?? ''}</span>}
                  {patient.communication_opt_out && <span style={{ marginLeft: 8, color: '#8a662c' }}>Opted out of communications</span>}
                </div>
              )}
            </div>
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
            {!editing && !isMerged && <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit details</button>}
            <button className="btn btn-ghost" onClick={() => printPatientRegistrationSlip(patient)}>Print registration slip</button>
            {!sendingMessage && !isMerged && <button className="btn btn-ghost" onClick={() => setSendingMessage(true)}>Send message</button>}
            {profile?.role === 'admin' && !isMerged && !merging && <button className="btn btn-ghost" onClick={() => setMerging(true)}>Merge duplicate patient</button>}
            <Link className="btn btn-ghost" to={`/patients/${patient.id}/pacs`}>Imaging archive</Link>
            <Link className="btn btn-ghost" to={`/patients/${patient.id}/glaucoma-progression`}>Glaucoma progression</Link>
          </div>
        </div>
      </div>

      {editing && <EditPatientForm patient={patient} onDone={() => setEditing(false)} />}
      {sendingMessage && (
        <SendCommunicationPanel
          patient={patient}
          context={{ token_number: visits?.[0]?.token_number ?? null }}
          onClose={() => setSendingMessage(false)}
        />
      )}
      {merging && <MergePatientPanel patient={patient} onDone={() => setMerging(false)} />}

      {!isMerged && (
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0 }}>Start a new visit</h4>
        <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>Consultation charges are collected before the token is issued.</p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Clinic module</label>
            <select className="input" value={newVisitModule} onChange={(e) => { setNewVisitModule(e.target.value as ClinicModule); setFeeOverride(null); }}>
              {Object.values(MODULES).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>Consultation fee (&#8377;)</label>
            <input className="input" type="number" min={0} value={feeOverride ?? String(defaultFee)} onChange={(e) => setFeeOverride(e.target.value)} />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label>Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 180 }}>
            <label>Attending doctor</label>
            <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">— Unassigned —</option>
              {doctors?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={startVisit} disabled={creating}>
            {creating ? 'Processing…' : fee > 0 ? `Collect ₹${fee.toFixed(2)} & generate token` : 'Generate token & start visit'}
          </button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>
      )}

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