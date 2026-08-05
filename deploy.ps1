Write-Host 'Writing files...'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\printPatientRegistrationSlip.ts" -Encoding UTF8 -NoNewline -Value @'
import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints the patient's UHID registration slip — the card a walk-in patient
 * carries out of registration and back in on every future visit. */
export async function printPatientRegistrationSlip(patient: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=500,height=650');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Registration Slip — ${esc(patient.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 400px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 18px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 12px; }
  .card { border: 2px solid #2f6f62; border-radius: 10px; padding: 16px; margin-top: 16px; }
  .uhid { font-size: 26px; font-weight: 700; color: #2f6f62; letter-spacing: 1px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; margin-top: 10px; }
  .grid div span.k { color: #666; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>

  <div class="card">
    <div class="uhid">${esc(patient.uhid)}</div>
    <div class="grid">
      <div><span class="k">Name:</span> ${esc(patient.full_name)}</div>
      <div><span class="k">DOB:</span> ${patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'} · <span class="k">Gender:</span> ${esc(patient.gender)}</div>
      <div><span class="k">Phone:</span> ${esc(patient.phone)}</div>
      <div><span class="k">Registered:</span> ${new Date(patient.created_at ?? Date.now()).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="muted" style="margin-top:14px;">Please bring this slip (or quote your UHID) on every future visit.</div>

  <button onclick="window.print()" style="margin-top:20px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}

'@
Write-Host 'wrote src\lib\printPatientRegistrationSlip.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\printEmergencyTriageSlip.ts" -Encoding UTF8 -NoNewline -Value @'
import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'CRITICAL — immediate attention',
  urgent: 'URGENT — within the hour',
  semi_urgent: 'Semi-urgent — same day',
};

/** Prints a priority triage card for an emergency visit — the physical
 * handoff between the triage desk and the clinic, and a record for the
 * patient/attendant to carry. */
export async function printEmergencyTriageSlip(patient: any, visit: any, note: { chief_complaint: string; onset_description: string | null; priority: string }) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=600,height=750');
  if (!win) return;

  const isCritical = note.priority === 'critical';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Emergency Triage — ${esc(patient.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 600px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .priority { display: inline-block; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 15px; margin-top: 12px; ${isCritical ? 'background:#f6dede;color:#8a2c2c;' : 'background:#faf0d8;color:#8a662c;'} }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  .box { border: 1px dashed #999; border-radius: 8px; padding: 12px; margin-top: 16px; font-size: 13px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Emergency Triage</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="priority">${esc(PRIORITY_LABEL[note.priority] ?? note.priority)}</div>

  <div class="grid">
    <div><span class="k">Patient:</span> ${esc(patient.full_name)} (${esc(patient.uhid)})</div>
    <div><span class="k">Token:</span> ${esc(visit.token_number)}</div>
    <div><span class="k">DOB / Gender:</span> ${esc(patient.date_of_birth)} / ${esc(patient.gender)}</div>
    <div><span class="k">Triaged:</span> ${new Date().toLocaleString()}</div>
  </div>

  <div class="box">
    <strong>Chief complaint:</strong><br />${esc(note.chief_complaint)}
    ${note.onset_description ? `<br /><br /><strong>Onset / details:</strong><br />${esc(note.onset_description)}` : ''}
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}

'@
Write-Host 'wrote src\lib\printEmergencyTriageSlip.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\printPurchaseOrder.ts" -Encoding UTF8 -NoNewline -Value @'
import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a formal purchase order document — what procurement actually sends
 * to (or hands) a vendor, rather than just tracking the PO internally. */
export async function printPurchaseOrder(po: any) {
  const { data: vendor } = await supabase.from('vendors').select('*').eq('id', po.vendor_id).maybeSingle();
  const { data: items } = await supabase.from('purchase_order_items').select('*').eq('po_id', po.id);
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=700,height=850');
  if (!win) return;

  const rowsHtml = (items ?? [])
    .map((it: any) => {
      const amount = it.unit_price ? Number(it.unit_price) * Number(it.quantity) : null;
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.item_description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${esc(it.quantity)} ${esc(it.unit)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${it.unit_price ? `₹${Number(it.unit_price).toFixed(2)}` : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${amount != null ? `₹${amount.toFixed(2)}` : '—'}</td>
      </tr>`;
    })
    .join('');

  const total = (items ?? []).reduce((sum: number, it: any) => sum + (it.unit_price ? Number(it.unit_price) * Number(it.quantity) : 0), 0);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Purchase Order — ${esc(po.po_number)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 680px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; }
  .total { margin-top: 12px; font-size: 18px; font-weight: 700; text-align: right; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #999; padding-top: 4px; width: 200px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <h2 style="margin-top:16px;font-size:16px;">Purchase Order ${esc(po.po_number)}</h2>

  <div class="grid">
    <div><span class="k">Vendor:</span> ${esc(vendor?.name)}</div>
    <div><span class="k">GSTIN:</span> ${esc(vendor?.gstin)}</div>
    <div><span class="k">Vendor contact:</span> ${esc(vendor?.contact_person)} ${vendor?.phone ? `(${esc(vendor.phone)})` : ''}</div>
    <div><span class="k">Vendor email:</span> ${esc(vendor?.email)}</div>
    <div><span class="k">Order date:</span> ${po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}</div>
    <div><span class="k">Expected delivery:</span> ${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '—'}</div>
  </div>

  <table>
    <thead><tr><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit price</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="4" style="padding:8px;color:#999;">No items</td></tr>'}</tbody>
  </table>
  <div class="total">Total: ₹${total.toFixed(2)}</div>

  ${po.notes ? `<div class="muted" style="margin-top:10px;">Notes: ${esc(po.notes)}</div>` : ''}

  <div class="sign">
    <div>Authorized signatory</div>
    <div>Vendor acknowledgement</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}

'@
Write-Host 'wrote src\lib\printPurchaseOrder.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\PatientsPage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { GUARDIAN_RELATIONS, INSURANCE_SCHEMES, BLOOD_GROUPS } from '../modules/commonOptions';
import { printPatientRegistrationSlip } from '../lib/printPatientRegistrationSlip';
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
    const { data: newPatient, error: insertError } = await supabase.from('patients').insert(payload).select().single();
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['patients'] });
    if (newPatient) printPatientRegistrationSlip(newPatient);
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
Write-Host 'wrote src\pages\PatientsPage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\PatientDetailPage.tsx" -Encoding UTF8 -NoNewline -Value @'
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
'@
Write-Host 'wrote src\pages\PatientDetailPage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\EmergencyTriagePage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { printEmergencyTriageSlip } from '../lib/printEmergencyTriageSlip';

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
    printEmergencyTriageSlip(selectedPatient, visit, { chief_complaint: chiefComplaint, onset_description: onsetDescription || null, priority });
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

'@
Write-Host 'wrote src\pages\EmergencyTriagePage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\ProcurementStoresPage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { printPurchaseOrder } from '../lib/printPurchaseOrder';

const VENDOR_CATEGORIES = ['equipment', 'pharmacy', 'optical', 'general_supplies', 'services', 'other'];
const STORES_CATEGORIES = ['linen', 'stationery', 'surgical_consumable', 'ppe', 'cleaning_supplies', 'other'];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: {}, issued: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
  partially_received: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  received: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  cancelled: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  pending: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  approved: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  rejected: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  converted_to_po: { background: '#e3ebef', color: '#2f5e7a', borderColor: '#b9d0dc' },
};

// ---------------- Vendors ----------------

function AddVendorForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', category: 'general_supplies', contact_person: '', phone: '', email: '', address: '', gstin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('vendors').insert({
      name: form.name, category: form.category, contact_person: form.contact_person || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null,
      gstin: form.gstin || null, created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['vendors'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add vendor</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Name *</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Contact person</label><input className="input" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>GSTIN</label><input className="input" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add vendor'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function VendorsTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Suppliers for equipment AMC/CMC, drugs, eyewear, consumables and services.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add vendor</button>}
      </div>
      {showForm && <AddVendorForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Contact</th><th>Phone / Email</th><th>GSTIN</th></tr></thead>
          <tbody>
            {vendors?.map((v: any) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.category.replace(/_/g, ' ')}</td>
                <td>{v.contact_person ?? '—'}</td>
                <td className="text-muted">{v.phone ?? '—'} {v.email ? `· ${v.email}` : ''}</td>
                <td>{v.gstin ?? '—'}</td>
              </tr>
            ))}
            {vendors?.length === 0 && <tr><td colSpan={5} className="text-muted">No vendors registered yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Purchase Orders ----------------

interface POLine { item_description: string; quantity: string; unit: string; unit_price: string }

function CreatePOForm({ vendors, onDone }: { vendors: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ po_number: '', vendor_id: '', expected_delivery_date: '', notes: '' });
  const [lines, setLines] = useState<POLine[]>([{ item_description: '', quantity: '1', unit: '', unit_price: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const setLine = (i: number, k: keyof POLine, v: string) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.item_description.trim() && Number(l.quantity) > 0);
    if (!form.po_number.trim() || !form.vendor_id || validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
      po_number: form.po_number, vendor_id: form.vendor_id, expected_delivery_date: form.expected_delivery_date || null,
      status: 'issued', notes: form.notes || null, created_by: profile?.id,
    }).select().single();
    if (poError || !po) { setSaving(false); setError(poError?.message ?? 'Could not create purchase order.'); return; }
    const { error: itemsError } = await supabase.from('purchase_order_items').insert(
      validLines.map((l) => ({
        po_id: po.id, item_description: l.item_description, quantity: Number(l.quantity),
        unit: l.unit || null, unit_price: l.unit_price ? Number(l.unit_price) : null,
      })),
    );
    setSaving(false);
    if (itemsError) { setError(itemsError.message); return; }
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Create purchase order</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}><label>PO number *</label><input className="input" value={form.po_number} onChange={(e) => set('po_number', e.target.value)} placeholder="PO-2026-0001" required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Vendor *</label>
          <select className="input" value={form.vendor_id} onChange={(e) => set('vendor_id', e.target.value)} required>
            <option value="">Select…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Expected delivery</label><input className="input" type="date" value={form.expected_delivery_date} onChange={(e) => set('expected_delivery_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>

      <h5 style={{ marginTop: 14, marginBottom: 6 }}>Line items</h5>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 220px' }}><label>Item</label><input className="input" value={l.item_description} onChange={(e) => setLine(i, 'item_description', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 90px' }}><label>Qty</label><input className="input" type="number" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 90px' }}><label>Unit</label><input className="input" value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} placeholder="box / pc" /></div>
          <div className="field" style={{ flex: '1 1 110px' }}><label>Unit price (₹)</label><input className="input" type="number" value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} /></div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => setLines((prev) => [...prev, { item_description: '', quantity: '1', unit: '', unit_price: '' }])}>+ Add line</button>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create & issue PO'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ReceivePOForm({ po, items, stores, onDone }: { po: any; items: any[]; stores: any[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [received, setReceived] = useState<Record<string, string>>(
    Object.fromEntries(items.map((it) => [it.id, String(it.quantity - it.received_quantity)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    for (const it of items) {
      const qty = Number(received[it.id] || 0);
      if (qty <= 0) continue;
      const newReceived = Math.min(it.quantity, it.received_quantity + qty);
      const { error: itemError } = await supabase.from('purchase_order_items').update({ received_quantity: newReceived }).eq('id', it.id);
      if (itemError) { setSaving(false); setError(itemError.message); return; }
      if (it.stores_item_id) {
        const storeItem = stores.find((s) => s.id === it.stores_item_id);
        if (storeItem) {
          await supabase.from('general_stores_inventory').update({ stock_qty: Number(storeItem.stock_qty) + qty }).eq('id', it.stores_item_id);
        }
      }
    }
    const { data: refreshedItems } = await supabase.from('purchase_order_items').select('quantity, received_quantity').eq('po_id', po.id);
    const allReceived = (refreshedItems ?? []).every((it: any) => it.received_quantity >= it.quantity);
    const someReceived = (refreshedItems ?? []).some((it: any) => it.received_quantity > 0);
    await supabase.from('purchase_orders').update({ status: allReceived ? 'received' : someReceived ? 'partially_received' : po.status }).eq('id', po.id);
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    onDone();
  };

  return (
    <div style={{ padding: 'var(--space-3)', background: 'var(--color-accent-100)' }}>
      <h5 style={{ marginTop: 0 }}>Receive shipment</h5>
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ flex: '1 1 240px', fontSize: 13 }}>{it.item_description} <span className="text-muted">({it.received_quantity}/{it.quantity} {it.unit ?? ''} received)</span></div>
          <input className="input" style={{ width: 100 }} type="number" min={0} max={it.quantity - it.received_quantity}
            value={received[it.id] ?? '0'} onChange={(e) => setReceived((prev) => ({ ...prev, [it.id]: e.target.value }))} />
        </div>
      ))}
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm receipt'}</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function PORow({ po }: { po: any }) {
  const [expanded, setExpanded] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const { data: items } = useQuery({
    queryKey: ['po-items', po.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_order_items').select('*').eq('po_id', po.id);
      if (error) throw error;
      return data;
    },
  });
  const { data: stores } = useQuery({
    queryKey: ['general-stores'],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('general_stores_inventory').select('*');
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {po.po_number}</button></td>
        <td>{po.vendors?.name}</td>
        <td>{po.order_date}</td>
        <td>{po.expected_delivery_date ?? '—'}</td>
        <td><span className="tag tag-outline" style={STATUS_STYLE[po.status]}>{po.status.replace(/_/g, ' ')}</span></td>
        <td><button className="btn btn-ghost" onClick={() => printPurchaseOrder(po)}>Print PO</button></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <table className="table" style={{ marginBottom: 8 }}>
                <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Received</th></tr></thead>
                <tbody>
                  {items?.map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.item_description}</td>
                      <td>{it.quantity} {it.unit ?? ''}</td>
                      <td>{it.unit_price ? `₹${Number(it.unit_price).toLocaleString()}` : '—'}</td>
                      <td>{it.received_quantity}/{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {po.notes && <p className="text-muted" style={{ fontSize: 13 }}>{po.notes}</p>}
              {po.status !== 'received' && po.status !== 'cancelled' && (showReceive
                ? <ReceivePOForm po={po} items={items ?? []} stores={stores ?? []} onDone={() => setShowReceive(false)} />
                : <button className="btn btn-secondary" onClick={() => setShowReceive(true)}>Receive shipment</button>)}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PurchaseOrdersTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: pos, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_orders').select('*, vendors(name)').order('order_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Orders issued to vendors — receive shipments here to update stock automatically.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Create PO</button>}
      </div>
      {showForm && <CreatePOForm vendors={vendors ?? []} onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>PO #</th><th>Vendor</th><th>Order date</th><th>Expected</th><th>Status</th><th /></tr></thead>
          <tbody>
            {pos?.map((po: any) => <PORow key={po.id} po={po} />)}
            {pos?.length === 0 && <tr><td colSpan={6} className="text-muted">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Requisitions ----------------

function AddRequisitionForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ department: '', item_description: '', quantity: '1', unit: '', estimated_cost: '', urgency: 'routine', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_description.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('purchase_requisitions').insert({
      requested_by: profile?.id, department: form.department || null, item_description: form.item_description,
      quantity: Number(form.quantity) || 1, unit: form.unit || null,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null, urgency: form.urgency, notes: form.notes || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['requisitions'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log a requisition</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>For a request that came in from a department (call, email, in person).</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Item *</label><input className="input" value={form.item_description} onChange={(e) => set('item_description', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 90px' }}><label>Qty</label><input className="input" type="number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 90px' }}><label>Unit</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Est. cost (₹)</label><input className="input" type="number" value={form.estimated_cost} onChange={(e) => set('estimated_cost', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label>Urgency</label>
          <select className="input" value={form.urgency} onChange={(e) => set('urgency', e.target.value)}>
            <option value="routine">routine</option><option value="urgent">urgent</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log requisition'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function RequisitionsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: reqs, isLoading } = useQuery({
    queryKey: ['requisitions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_requisitions').select('*, profiles(full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const decide = async (id: string, status: string) => {
    await supabase.from('purchase_requisitions').update({ status, approved_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['requisitions'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Requests for stock — approve, then create a matching PO from the Purchase Orders tab.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log requisition</button>}
      </div>
      {showForm && <AddRequisitionForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Item</th><th>Dept.</th><th>Qty</th><th>Urgency</th><th>Requested by</th><th>Status</th><th /></tr></thead>
          <tbody>
            {reqs?.map((r: any) => (
              <tr key={r.id}>
                <td>{r.item_description}</td>
                <td>{r.department ?? '—'}</td>
                <td>{r.quantity} {r.unit ?? ''}</td>
                <td><span className="tag tag-outline" style={r.urgency === 'urgent' ? { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' } : undefined}>{r.urgency}</span></td>
                <td>{r.profiles?.full_name ?? '—'}</td>
                <td><span className="tag tag-outline" style={STATUS_STYLE[r.status]}>{r.status.replace(/_/g, ' ')}</span></td>
                <td>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost" onClick={() => decide(r.id, 'approved')}>Approve</button>
                      <button className="btn btn-ghost" onClick={() => decide(r.id, 'rejected')}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {reqs?.length === 0 && <tr><td colSpan={7} className="text-muted">No requisitions logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- General Stores ----------------

function AddStoreItemForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ item_name: '', category: 'surgical_consumable', unit: '', stock_qty: '0', reorder_level: '10', unit_price: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('general_stores_inventory').insert({
      item_name: form.item_name, category: form.category, unit: form.unit || null,
      stock_qty: Number(form.stock_qty) || 0, reorder_level: Number(form.reorder_level) || 0,
      unit_price: form.unit_price ? Number(form.unit_price) : null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Add store item</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Item name *</label><input className="input" value={form.item_name} onChange={(e) => set('item_name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {STORES_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 90px' }}><label>Unit</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="box / pc" /></div>
        <div className="field" style={{ flex: '1 1 100px' }}><label>Opening stock</label><input className="input" type="number" value={form.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Reorder level</label><input className="input" type="number" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label>Unit price (₹)</label><input className="input" type="number" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add item'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function IssueStockForm({ item, onDone }: { item: any; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [department, setDepartment] = useState('');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amount = Number(qty);
    if (!amount || amount <= 0 || amount > item.stock_qty || !department.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('stock_issue_notes').insert({
      item_id: item.id, department, quantity_issued: amount, issued_by: profile?.id,
    });
    if (insertError) { setSaving(false); setError(insertError.message); return; }
    const { error: updateError } = await supabase.from('general_stores_inventory').update({ stock_qty: item.stock_qty - amount }).eq('id', item.id);
    setSaving(false);
    if (updateError) { setError(`Issue logged, but stock count didn't update: ${updateError.message}`); return; }
    qc.invalidateQueries({ queryKey: ['general-stores'] });
    qc.invalidateQueries({ queryKey: ['stock-issues'] });
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="input" style={{ width: 140 }} placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />
      <input className="input" style={{ width: 80 }} type="number" min={1} max={item.stock_qty} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

function StoreItemRow({ item }: { item: any }) {
  const [issuing, setIssuing] = useState(false);
  const lowStock = item.stock_qty <= item.reorder_level;

  return (
    <tr>
      <td>{item.item_name}</td>
      <td>{item.category.replace(/_/g, ' ')}</td>
      <td><span className={lowStock ? 'tag tag-outline' : ''} style={lowStock ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>{item.stock_qty} {item.unit ?? ''}</span></td>
      <td>{item.reorder_level}</td>
      <td>{issuing ? <IssueStockForm item={item} onDone={() => setIssuing(false)} /> : <button className="btn btn-secondary" onClick={() => setIssuing(true)} disabled={item.stock_qty <= 0}>Issue stock</button>}</td>
    </tr>
  );
}

function GeneralStoresTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: items, isLoading } = useQuery({
    queryKey: ['general-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('general_stores_inventory').select('*').order('item_name');
      if (error) throw error;
      return data;
    },
  });
  const { data: recentIssues } = useQuery({
    queryKey: ['stock-issues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_issue_notes').select('*, general_stores_inventory(item_name)').order('created_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Linen, stationery, surgical consumables, PPE and cleaning supplies — everything pharmacy/optical inventory doesn't cover.</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add item</button>}
      </div>
      {showForm && <AddStoreItemForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Reorder at</th><th /></tr></thead>
          <tbody>
            {items?.map((it: any) => <StoreItemRow key={it.id} item={it} />)}
            {items?.length === 0 && <tr><td colSpan={5} className="text-muted">No items in general stores yet.</td></tr>}
          </tbody>
        </table>
      )}
      <h4 style={{ marginTop: 'var(--space-6)' }}>Recent stock issued</h4>
      {recentIssues?.length ? (
        <ul style={{ paddingLeft: 18, fontSize: 13 }}>
          {recentIssues.map((r: any) => (
            <li key={r.id}>-{r.quantity_issued} {r.general_stores_inventory?.item_name} to {r.department} — {new Date(r.created_at).toLocaleString()}</li>
          ))}
        </ul>
      ) : <p className="text-muted">No stock issued yet.</p>}
    </div>
  );
}

// ---------------- Page ----------------

export function ProcurementStoresPage() {
  const [tab, setTab] = useState<'vendors' | 'orders' | 'requisitions' | 'stores'>('orders');
  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'orders', label: 'Purchase Orders' },
    { key: 'requisitions', label: 'Requisitions' },
    { key: 'stores', label: 'General Stores' },
    { key: 'vendors', label: 'Vendors' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Procurement & Stores</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Vendors, purchase orders and the general stores that keep the hospital supplied.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vendors' && <VendorsTab />}
      {tab === 'orders' && <PurchaseOrdersTab />}
      {tab === 'requisitions' && <RequisitionsTab />}
      {tab === 'stores' && <GeneralStoresTab />}
    </div>
  );
}

'@
Write-Host 'wrote src\pages\ProcurementStoresPage.tsx'
Write-Host 'All 7 files written.'
git add -A
git status