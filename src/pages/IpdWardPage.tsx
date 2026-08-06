import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { printDailyMonitoringReport } from '../lib/printDailyMonitoringReport';
import { FileUploadField } from '../components/FileUploadField';

const ROUTES = ['oral', 'iv', 'im', 'topical', 'subcutaneous', 'other'];
const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'STAT', 'SOS', 'Q4H', 'Q6H', 'Q8H'];
const ADMIN_STATUS_LABEL: Record<string, string> = { given: 'Given', withheld: 'Withheld', refused: 'Refused' };

// Mirrors the RLS write policies on admissions/beds/ward_vitals exactly —
// every other role that can see this page (reception, mrd, billing,
// insurance_desk, optometrist) gets read-only visibility into the census.
const CAN_MANAGE = new Set(['doctor', 'nurse', 'ot_staff', 'admin']);

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a -= 1;
  return a;
}

function daysAdmitted(admittedAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(admittedAt).getTime()) / 86400000));
}

const dateKey = (d: Date) => d.toLocaleDateString('en-CA');

/** One entry per calendar day of the stay, admission day through today —
 * every day gets a slot (even with zero readings) so a day nobody charted
 * shows up as empty rather than silently missing. Most recent day first. */
function buildDayList(admittedAt: string, vitals: any[]) {
  const start = new Date(admittedAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const days: { dateKey: string; dayNumber: number; vitals: any[] }[] = [];
  let dayNumber = 1;
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const key = dateKey(d);
    days.push({ dateKey: key, dayNumber, vitals: vitals.filter((v) => dateKey(new Date(v.recorded_at)) === key) });
    dayNumber += 1;
  }
  return days.reverse();
}

function AddVitalsForm({ admissionId, onDone }: { admissionId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ blood_pressure: '', pulse: '', temperature: '', spo2: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ward_vitals').insert({
      admission_id: admissionId,
      blood_pressure: form.blood_pressure || null,
      pulse: form.pulse || null,
      temperature: form.temperature || null,
      spo2: form.spo2 || null,
      notes: form.notes || null,
      recorded_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['ipd-admissions'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: 8, background: 'var(--color-accent-100)', marginTop: 6, borderRadius: 'var(--radius-md)' }}>
      <input className="input" style={{ width: 110 }} placeholder="BP e.g. 120/80" value={form.blood_pressure} onChange={(e) => set('blood_pressure', e.target.value)} />
      <input className="input" style={{ width: 90 }} placeholder="Pulse" value={form.pulse} onChange={(e) => set('pulse', e.target.value)} />
      <input className="input" style={{ width: 90 }} placeholder="Temp (°F)" value={form.temperature} onChange={(e) => set('temperature', e.target.value)} />
      <input className="input" style={{ width: 90 }} placeholder="SpO2 %" value={form.spo2} onChange={(e) => set('spo2', e.target.value)} />
      <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save vitals'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function AdmitForm({ beds, doctors, presetBedId, onDone }: { beds: any[]; doctors: any[]; presetBedId: string | null; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [bedId, setBedId] = useState(presetBedId ?? '');
  const [doctorId, setDoctorId] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['ipd-admit-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedQuery);
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!selectedPatient || !bedId) return;
    setSaving(true);
    setError(null);

    const { data: visit, error: visitError } = await supabase.from('visits').insert({
      patient_id: selectedPatient.id,
      clinic_module: 'general',
      stage: 'admission',
      attending_doctor_id: doctorId || null,
      is_emergency: isEmergency,
    }).select('id').single();
    if (visitError) { setSaving(false); setError(visitError.message); return; }

    const { error: admissionError } = await supabase.from('admissions').insert({
      visit_id: visit.id,
      bed_id: bedId,
      admitted_by: profile?.id,
    });
    if (admissionError) { setSaving(false); setError(admissionError.message); return; }

    const { error: bedError } = await supabase.from('beds').update({ status: 'occupied' }).eq('id', bedId);
    setSaving(false);
    if (bedError) { setError(bedError.message); return; }

    qc.invalidateQueries({ queryKey: ['ipd-admissions'] });
    qc.invalidateQueries({ queryKey: ['ipd-beds'] });
    onDone();
  };

  return (
    <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Admit patient</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 220px', position: 'relative' }}>
          <label>Patient</label>
          <input
            className="input"
            value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }}
            placeholder="Search by name or UHID"
          />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: 280, maxHeight: 180, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => (
                <div key={p.id} style={{ padding: 6, cursor: 'pointer', fontSize: 13 }} onClick={() => { setSelectedPatient(p); setPatientQuery(''); }}>
                  {p.full_name} — {p.uhid}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="field" style={{ flex: '0 1 170px' }}>
          <label>Bed</label>
          <select className="input" value={bedId} onChange={(e) => setBedId(e.target.value)}>
            <option value="">Select bed</option>
            {beds.map((b) => <option key={b.id} value={b.id}>{b.bed_number} {b.ward ? `(${b.ward})` : ''}</option>)}
          </select>
          {beds.length === 0 && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>No beds currently available</div>}
        </div>
        <div className="field" style={{ flex: '0 1 190px' }}>
          <label>Attending doctor</label>
          <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Unassigned</option>
            {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 8 }}>
          <input type="checkbox" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} /> Emergency admission
        </label>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !selectedPatient || !bedId}>{saving ? 'Admitting…' : 'Admit'}</button>
        <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function ConsentBlock({ admission, canManage, onChanged }: { admission: any; canManage: boolean; onChanged: () => void }) {
  const [showUpload, setShowUpload] = useState(false);

  const toggleSigned = async () => {
    await supabase.from('admissions').update({ consent_signed: !admission.consent_signed }).eq('id', admission.id);
    onChanged();
  };

  const saveFile = async (url: string | null) => {
    await supabase.from('admissions').update({ consent_file_url: url }).eq('id', admission.id);
    onChanged();
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className={`tag ${admission.consent_signed ? 'tag-accent' : 'tag-outline'}`}>consent {admission.consent_signed ? 'signed' : 'pending'}</span>
        {admission.consent_file_url && <a href={admission.consent_file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>View document</a>}
        {canManage && <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={toggleSigned}>{admission.consent_signed ? 'Mark pending' : 'Mark signed'}</button>}
        {canManage && <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setShowUpload((s) => !s)}>{showUpload ? 'Hide upload' : 'Upload document'}</button>}
      </div>
      {showUpload && (
        <div style={{ marginTop: 6, maxWidth: 300 }}>
          <FileUploadField value={admission.consent_file_url} onChange={saveFile} folder="admissions" />
        </div>
      )}
    </div>
  );
}

function NewMedicationOrderForm({ admissionId, onDone }: { admissionId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ drug_name: '', dosage: '', route: 'oral', frequency: 'OD', instructions: '', end_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.drug_name.trim() || !form.dosage.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ipd_medication_orders').insert({
      admission_id: admissionId,
      drug_name: form.drug_name,
      dosage: form.dosage,
      route: form.route,
      frequency: form.frequency,
      instructions: form.instructions || null,
      end_date: form.end_date || null,
      ordered_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['ipd-medication-orders', admissionId] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', padding: 8, background: 'var(--color-accent-100)', marginTop: 6, borderRadius: 'var(--radius-md)' }}>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Drug</label><input className="input" value={form.drug_name} onChange={(e) => set('drug_name', e.target.value)} placeholder="e.g. Ciprofloxacin 0.3% eye drops" /></div>
      <div className="field" style={{ flex: '0 1 110px' }}><label>Dosage</label><input className="input" value={form.dosage} onChange={(e) => set('dosage', e.target.value)} placeholder="e.g. 1 drop" /></div>
      <div className="field" style={{ flex: '0 1 130px' }}>
        <label>Route</label>
        <select className="input" value={form.route} onChange={(e) => set('route', e.target.value)}>
          {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '0 1 100px' }}>
        <label>Frequency</label>
        <select className="input" value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>
          {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Instructions</label><input className="input" value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="e.g. operated eye only" /></div>
      <div className="field" style={{ flex: '0 1 140px' }}><label>End date (optional)</label><input className="input" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></div>
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Ordering…' : 'Order'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function MedicationOrderRow({ order, canAdminister, isDoctor, onChanged }: { order: any; canAdminister: boolean; isDoctor: boolean; onChanged: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showAdminister, setShowAdminister] = useState(false);
  const [adminStatus, setAdminStatus] = useState('given');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: administrations } = useQuery({
    queryKey: ['ipd-med-administrations', order.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('ipd_medication_administrations').select('*').eq('order_id', order.id).order('administered_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const logAdministration = async () => {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ipd_medication_administrations').insert({
      order_id: order.id, status: adminStatus, notes: adminNotes || null, administered_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setAdminNotes('');
    setShowAdminister(false);
    qc.invalidateQueries({ queryKey: ['ipd-med-administrations', order.id] });
  };

  const discontinue = async () => {
    setError(null);
    const { error: updateError } = await supabase.from('ipd_medication_orders').update({
      status: 'discontinued', discontinued_by: profile?.id, discontinued_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (updateError) { setError(updateError.message); return; }
    onChanged();
  };

  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div>
          <strong>{order.drug_name}</strong> — {order.dosage} · {order.route} · {order.frequency}
          <span className={`tag ${order.status === 'active' ? 'tag-accent' : 'tag-outline'}`} style={{ marginLeft: 6 }}>{order.status}</span>
          {order.instructions && <div className="text-muted">{order.instructions}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {canAdminister && order.status === 'active' && !showAdminister && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowAdminister(true)}>Log dose</button>}
          {isDoctor && order.status === 'active' && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={discontinue}>Discontinue</button>}
        </div>
      </div>
      {showAdminister && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <select className="input" style={{ width: 120 }} value={adminStatus} onChange={(e) => setAdminStatus(e.target.value)}>
            {Object.keys(ADMIN_STATUS_LABEL).map((s) => <option key={s} value={s}>{ADMIN_STATUS_LABEL[s]}</option>)}
          </select>
          <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
          <button className="btn btn-primary" onClick={logAdministration} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
          <button className="btn btn-ghost" onClick={() => setShowAdminister(false)}>Cancel</button>
        </div>
      )}
      {administrations && administrations.length > 0 && (
        <div className="text-muted" style={{ marginTop: 4, fontSize: 12 }}>
          {administrations.map((a: any) => (
            <div key={a.id}>{ADMIN_STATUS_LABEL[a.status]} — {new Date(a.administered_at).toLocaleString()}{a.notes ? ` — ${a.notes}` : ''}</div>
          ))}
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function MedicationsPanel({ admission, isDoctor, canManage }: { admission: any; isDoctor: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const [showNewOrder, setShowNewOrder] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ['ipd-medication-orders', admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('ipd_medication_orders').select('*').eq('admission_id', admission.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refreshOrders = () => qc.invalidateQueries({ queryKey: ['ipd-medication-orders', admission.id] });

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--color-bg)' }}>
        <strong style={{ fontSize: 13 }}>Medication orders (eMAR)</strong>
        {isDoctor && !showNewOrder && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowNewOrder(true)}>+ Order</button>}
      </div>
      {showNewOrder && <NewMedicationOrderForm admissionId={admission.id} onDone={() => { setShowNewOrder(false); refreshOrders(); }} />}
      {orders?.length ? (
        orders.map((o: any) => <MedicationOrderRow key={o.id} order={o} canAdminister={canManage} isDoctor={isDoctor} onChanged={refreshOrders} />)
      ) : (
        <p className="text-muted" style={{ fontSize: 12, padding: '6px 10px 10px' }}>No medication orders yet.</p>
      )}
    </div>
  );
}

function TransferPanel({ admission, availableBeds, canManage, onChanged }: { admission: any; availableBeds: any[]; canManage: boolean; onChanged: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [toBedId, setToBedId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ['ipd-bed-transfers', admission.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bed_transfers')
        .select('*, from_bed:beds!bed_transfers_from_bed_id_fkey(bed_number,ward), to_bed:beds!bed_transfers_to_bed_id_fkey(bed_number,ward)')
        .eq('admission_id', admission.id)
        .order('transferred_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!toBedId) return;
    setSaving(true);
    setError(null);
    const fromBedId = admission.bed_id;

    const { error: transferError } = await supabase.from('bed_transfers').insert({
      admission_id: admission.id, from_bed_id: fromBedId, to_bed_id: toBedId, reason: reason || null, transferred_by: profile?.id,
    });
    if (transferError) { setSaving(false); setError(transferError.message); return; }

    const { error: admissionError } = await supabase.from('admissions').update({ bed_id: toBedId }).eq('id', admission.id);
    if (admissionError) { setSaving(false); setError(admissionError.message); return; }

    if (fromBedId) await supabase.from('beds').update({ status: 'available' }).eq('id', fromBedId);
    await supabase.from('beds').update({ status: 'occupied' }).eq('id', toBedId);

    setSaving(false);
    setReason('');
    setToBedId('');
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ipd-bed-transfers', admission.id] });
    onChanged();
  };

  return (
    <div style={{ marginTop: 8 }}>
      {canManage && !showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>Transfer bed</button>}
      {showForm && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <select className="input" style={{ width: 170 }} value={toBedId} onChange={(e) => setToBedId(e.target.value)}>
            <option value="">Select new bed</option>
            {availableBeds.map((b: any) => <option key={b.id} value={b.id}>{b.bed_number} {b.ward ? `(${b.ward})` : ''}</option>)}
          </select>
          <input className="input" style={{ flex: '1 1 160px' }} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-primary" onClick={submit} disabled={saving || !toBedId}>{saving ? 'Transferring…' : 'Confirm transfer'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {history && history.length > 0 && (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
          {history.map((t: any) => (
            <div key={t.id}>{new Date(t.transferred_at).toLocaleString()}: {t.from_bed?.bed_number ?? '—'} &rarr; {t.to_bed?.bed_number}{t.reason ? ` — ${t.reason}` : ''}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvestigationsPanel({ visitId, isDoctor }: { visitId: string; isDoctor: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [testName, setTestName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: orders } = useQuery({
    queryKey: ['ipd-investigation-orders', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('investigation_orders').select('*').eq('visit_id', visitId).order('ordered_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!testName.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('investigation_orders').insert({
      visit_id: visitId, test_name: testName, status: 'ordered', ordered_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setTestName('');
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ipd-investigation-orders', visitId] });
  };

  return (
    <div style={{ marginTop: 8 }}>
      {isDoctor && !showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>+ Order investigation</button>}
      {showForm && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <input className="input" style={{ flex: '1 1 200px' }} placeholder="Test name (e.g. CBC, RBS, HbA1c)" value={testName} onChange={(e) => setTestName(e.target.value)} />
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Ordering…' : 'Order'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {orders && orders.length > 0 && (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
          {orders.map((o: any) => (
            <div key={o.id}>{o.test_name} — <span className="tag tag-outline" style={{ fontSize: 10 }}>{o.status}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function DischargeChecklist({ admission, patient, onCancel, onDischarged }: { admission: any; patient: any; onCancel: () => void; onDischarged: () => void }) {
  const qc = useQueryClient();
  const [medsHandedOver, setMedsHandedOver] = useState(false);
  const [summaryReviewed, setSummaryReviewed] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: bill } = useQuery({
    queryKey: ['ipd-discharge-bill', admission.visit_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('bills').select('payment_status, total_amount, amount_paid').eq('visit_id', admission.visit_id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dueAmount = bill ? Number(bill.total_amount) - Number(bill.amount_paid) : 0;

  const confirm = async () => {
    setDischarging(true);
    setError(null);
    const { error: updateError } = await supabase.from('admissions').update({
      discharge_meds_handed_over: medsHandedOver,
      discharge_summary_reviewed: summaryReviewed,
      discharged_at: new Date().toISOString(),
    }).eq('id', admission.id);
    if (updateError) { setDischarging(false); setError(updateError.message); return; }
    if (admission.bed_id) await supabase.from('beds').update({ status: 'available' }).eq('id', admission.bed_id);
    setDischarging(false);
    qc.invalidateQueries({ queryKey: ['ipd-beds'] });
    onDischarged();
  };

  return (
    <div style={{ marginTop: 8, padding: 10, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
      <strong style={{ fontSize: 13 }}>Discharge checklist — {patient?.full_name}</strong>
      {bill ? (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
          Bill {bill.payment_status} — &#8377;{Number(bill.amount_paid).toFixed(2)} of &#8377;{Number(bill.total_amount).toFixed(2)} paid
          {dueAmount > 0 && <span style={{ color: '#b64545' }}> · &#8377;{dueAmount.toFixed(2)} due</span>}
        </div>
      ) : (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No bill generated yet for this visit</div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 8 }}>
        <input type="checkbox" checked={medsHandedOver} onChange={(e) => setMedsHandedOver(e.target.checked)} /> Medications / valuables handed over to patient
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 4 }}>
        <input type="checkbox" checked={summaryReviewed} onChange={(e) => setSummaryReviewed(e.target.checked)} /> Discharge summary reviewed with patient / attendant
      </label>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={confirm} disabled={discharging || !medsHandedOver || !summaryReviewed}>
          {discharging ? 'Discharging…' : 'Confirm discharge'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function CensusRow({ admission, doctors, staffNames, availableBeds, canManage, onChanged }: { admission: any; doctors: any[]; staffNames: Record<string, string>; availableBeds: any[]; canManage: boolean; onChanged: () => void }) {
  const { profile } = useAuth();
  const [showVitals, setShowVitals] = useState(false);
  const [showDailyReports, setShowDailyReports] = useState(false);
  const [showMedications, setShowMedications] = useState(false);
  const [showInvestigations, setShowInvestigations] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [confirmDischarge, setConfirmDischarge] = useState(false);

  const isDoctor = profile?.role === 'doctor' || profile?.role === 'admin';
  const patient = admission.visits?.patients;
  const doctor = doctors.find((d) => d.id === admission.visits?.attending_doctor_id);
  const vitals = admission.ward_vitals ?? [];
  const latestVitals = [...vitals].sort(
    (a: any, b: any) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  )[0];
  const patientAge = age(patient?.date_of_birth ?? null);
  const dayList = buildDayList(admission.admitted_at, vitals);
  const todayMissing = dayList[0] && dayList[0].vitals.length === 0;

  const printDay = (day: { dateKey: string; dayNumber: number; vitals: any[] }) => {
    printDailyMonitoringReport({
      admission,
      patient,
      doctorName: doctor?.full_name ?? null,
      dateKey: day.dateKey,
      dayNumber: day.dayNumber,
      vitalsForDay: day.vitals,
      staffNames,
    });
  };

  return (
    <div className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong>{patient?.full_name ?? 'Unknown patient'}</strong>{' '}
          <span className="text-muted" style={{ fontSize: 12 }}>
            {patient?.uhid} {patientAge !== null && `· ${patientAge}y`} {patient?.gender && `· ${patient.gender}`}
          </span>
          {admission.visits?.is_emergency && <span className="tag tag-accent-2" style={{ marginLeft: 6 }}>Emergency</span>}
          <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
            Bed {admission.beds?.bed_number ?? '—'} {admission.beds?.ward ? `(${admission.beds.ward})` : ''}
            {' '}· Admitted {new Date(admission.admitted_at).toLocaleDateString()} ({daysAdmitted(admission.admitted_at)}d)
            {doctor && ` · Dr. ${doctor.full_name}`}
          </div>
          {latestVitals ? (
            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
              Last vitals: BP {latestVitals.blood_pressure ?? '—'} · Pulse {latestVitals.pulse ?? '—'} · SpO2 {latestVitals.spo2 ?? '—'} · Temp {latestVitals.temperature ?? '—'}
              {' '}({new Date(latestVitals.recorded_at).toLocaleString()}{staffNames[latestVitals.recorded_by] ? ` · ${staffNames[latestVitals.recorded_by]}` : ''})
            </div>
          ) : (
            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>No vitals recorded yet</div>
          )}
          {todayMissing && (
            <div style={{ fontSize: 12, marginTop: 2, color: '#b68a45' }}>No monitoring recorded yet today (Day {dayList[0].dayNumber})</div>
          )}
          <ConsentBlock admission={admission} canManage={canManage} onChanged={onChanged} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to={`/visits/${admission.visit_id}`}>Open visit →</Link>
          <button className="btn btn-ghost" onClick={() => setShowDailyReports((s) => !s)}>{showDailyReports ? 'Hide' : 'Daily reports'}</button>
          <button className="btn btn-ghost" onClick={() => setShowMedications((s) => !s)}>{showMedications ? 'Hide' : 'Medications'}</button>
          <button className="btn btn-ghost" onClick={() => setShowInvestigations((s) => !s)}>{showInvestigations ? 'Hide' : 'Investigations'}</button>
          <button className="btn btn-ghost" onClick={() => setShowTransfer((s) => !s)}>{showTransfer ? 'Hide' : 'Transfers'}</button>
          {canManage && !showVitals && <button className="btn btn-secondary" onClick={() => setShowVitals(true)}>+ Vitals</button>}
          {canManage && !confirmDischarge && <button className="btn btn-secondary" onClick={() => setConfirmDischarge(true)}>Discharge</button>}
        </div>
      </div>

      {showVitals && <AddVitalsForm admissionId={admission.id} onDone={() => setShowVitals(false)} />}

      {showDailyReports && (
        <div style={{ marginTop: 8, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {dayList.map((day) => (
            <div key={day.dateKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid var(--color-divider)' }}>
              <span>
                Day {day.dayNumber} — {new Date(day.dateKey).toLocaleDateString()}
                {' '}· {day.vitals.length} reading{day.vitals.length === 1 ? '' : 's'}
                {day.vitals.length === 0 && <span style={{ color: '#b68a45' }}> (none recorded)</span>}
              </span>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => printDay(day)}>Print</button>
            </div>
          ))}
        </div>
      )}

      {showMedications && <MedicationsPanel admission={admission} isDoctor={isDoctor} canManage={canManage} />}
      {showInvestigations && <InvestigationsPanel visitId={admission.visit_id} isDoctor={isDoctor} />}
      {showTransfer && <TransferPanel admission={admission} availableBeds={availableBeds} canManage={canManage} onChanged={onChanged} />}

      {confirmDischarge && (
        <DischargeChecklist
          admission={admission}
          patient={patient}
          onCancel={() => setConfirmDischarge(false)}
          onDischarged={() => { setConfirmDischarge(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function BedBoard({ beds, admissions, canManage, onAdmitToBed }: { beds: any[]; admissions: any[]; canManage: boolean; onAdmitToBed: (bedId: string) => void }) {
  const wards = Array.from(new Set(beds.map((b) => b.ward ?? 'Unassigned')));
  const admissionByBed = new Map(admissions.map((a) => [a.bed_id, a]));

  return (
    <div>
      {wards.map((ward) => (
        <div key={ward} style={{ marginBottom: 'var(--space-5)' }}>
          <h4 style={{ marginBottom: 'var(--space-2)' }}>{ward}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            {beds.filter((b) => (b.ward ?? 'Unassigned') === ward).map((b) => {
              const occupant = admissionByBed.get(b.id);
              return (
                <div key={b.id} className="card" style={{ padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{b.bed_number}</strong>
                    <span className={`tag ${b.status === 'occupied' ? 'tag-accent' : 'tag-outline'}`}>{b.status}</span>
                  </div>
                  {occupant ? (
                    <Link to={`/visits/${occupant.visit_id}`} className="text-muted" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      {occupant.visits?.patients?.full_name} ({occupant.visits?.patients?.uhid})
                    </Link>
                  ) : (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {b.status === 'available' ? 'Vacant' : b.status}
                    </div>
                  )}
                  {canManage && b.status === 'available' && (
                    <button className="btn btn-ghost" style={{ marginTop: 6, padding: '2px 6px', fontSize: 12 }} onClick={() => onAdmitToBed(b.id)}>Admit here</button>
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

export function IpdWardPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const canManage = profile ? CAN_MANAGE.has(profile.role) : false;
  const [tab, setTab] = useState<'census' | 'beds'>('census');
  const [showAdmit, setShowAdmit] = useState(false);
  const [presetBedId, setPresetBedId] = useState<string | null>(null);

  const { data: admissions } = useQuery({
    queryKey: ['ipd-admissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admissions')
        .select('*, beds(id, bed_number, ward), visits(id, patient_id, clinic_module, attending_doctor_id, is_emergency, patients(full_name, uhid, gender, date_of_birth)), ward_vitals(*)')
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: beds } = useQuery({
    queryKey: ['ipd-beds'],
    queryFn: async () => {
      const { data, error } = await supabase.from('beds').select('*').order('ward').order('bed_number');
      if (error) throw error;
      return data;
    },
  });

  // Same query key AdmissionStage uses for its anaesthetist/surgeon picker —
  // sharing the cache avoids a duplicate fetch when both are open.
  const { data: doctors } = useQuery({
    queryKey: ['doctors-for-ot'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'doctor').eq('active', true).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Every role ward_vitals_insert allows — resolves "recorded by" on the
  // census and the printed daily report to an actual name, not a blank.
  const { data: staffProfiles } = useQuery({
    queryKey: ['ipd-ward-staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').in('role', ['nurse', 'ot_staff', 'doctor']);
      if (error) throw error;
      return data;
    },
  });
  const staffNames: Record<string, string> = Object.fromEntries((staffProfiles ?? []).map((p: any) => [p.id, p.full_name]));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ipd-admissions'] });
    qc.invalidateQueries({ queryKey: ['ipd-beds'] });
  };

  const availableBeds = (beds ?? []).filter((b) => b.status === 'available');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>IPD / Ward Management</h2>
          <p className="text-muted" style={{ margin: '2px 0 0' }}>
            {admissions?.length ?? 0} currently admitted · {availableBeds.length} of {beds?.length ?? 0} beds available
          </p>
        </div>
        {canManage && !showAdmit && (
          <button className="btn btn-primary" onClick={() => { setPresetBedId(null); setShowAdmit(true); }}>+ Admit patient</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, margin: 'var(--space-4) 0' }}>
        <button className={`btn ${tab === 'census' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('census')}>Ward Census</button>
        <button className={`btn ${tab === 'beds' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('beds')}>Bed Board</button>
      </div>

      {showAdmit && (
        <AdmitForm
          key={presetBedId ?? 'blank'}
          beds={availableBeds}
          doctors={doctors ?? []}
          presetBedId={presetBedId}
          onDone={() => { setShowAdmit(false); refresh(); }}
        />
      )}

      {tab === 'census' && (
        admissions?.length ? (
          admissions.map((a: any) => <CensusRow key={a.id} admission={a} doctors={doctors ?? []} staffNames={staffNames} availableBeds={availableBeds} canManage={canManage} onChanged={refresh} />)
        ) : (
          <p className="text-muted">No patients currently admitted.</p>
        )
      )}

      {tab === 'beds' && (
        <BedBoard
          beds={beds ?? []}
          admissions={admissions ?? []}
          canManage={canManage}
          onAdmitToBed={(bedId) => { setPresetBedId(bedId); setShowAdmit(true); }}
        />
      )}
    </div>
  );
}
