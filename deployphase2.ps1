# Netra HIMS — Phase 2 deploy script (preventive maintenance & calibration engine)
# Run this from the ROOT of your local netra-hims clone (where package.json lives),
# on a checkout of claude/determined-ride-o63al9 that already has Phase 1 applied.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'package.json')) { Write-Error 'Run this from the repo root (where package.json lives).'; exit 1 }
Write-Host 'Writing Phase 2 files...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\DashboardPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { ROLE_NAV } from '../modules/roleNav';

async function countRows(table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

async function countLowStockDrugs() {
  const { data } = await supabase.from('drugs').select('stock_qty, reorder_level');
  return (data ?? []).filter((d) => d.stock_qty <= d.reorder_level).length;
}

async function countLowStockEyewear() {
  const { data } = await supabase.from('eyewear_items').select('stock_qty, reorder_level');
  return (data ?? []).filter((d) => d.stock_qty <= d.reorder_level).length;
}

async function countMaintenanceDue() {
  const { data } = await supabase.from('maintenance_schedules').select('next_due_date').eq('active', true);
  const today = new Date().toISOString().slice(0, 10);
  return (data ?? []).filter((d) => d.next_due_date <= today).length;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const nav = (profile && ROLE_NAV[profile.role]) ?? { patients: false, appointments: false, waitingBoard: false, journeys: [], support: [] };

  const { data } = useQuery({
    queryKey: ['dashboard-counts', profile?.role],
    enabled: !!profile,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [patients, activeVisits, todayAppointments, totalWaiting, pendingPharmacy, lowStock, pendingOptical, lowStockEyewear, unpaidBills, pendingInsurance, openRecordRequests, openMlcCases, availableTissues, activeCamps, maintenanceDue] = await Promise.all([
        nav.patients ? countRows('patients') : Promise.resolve(null),
        nav.journeys.length > 0 ? countRows('visits', (q) => q.eq('clinic_module', nav.journeys[0]).not('stage', 'in', '("completed","cancelled")')) : Promise.resolve(null),
        nav.appointments ? countRows('appointments', (q) => q.gte('scheduled_at', today.toISOString())) : Promise.resolve(null),
        nav.waitingBoard ? countRows('visits', (q) => q.not('stage', 'in', '("completed","cancelled")')) : Promise.resolve(null),
        nav.support.includes('pharmacy') ? countRows('pharmacy_dispenses', (q) => q.neq('status', 'dispensed')) : Promise.resolve(null),
        nav.support.includes('pharmacy_inventory') ? countLowStockDrugs() : Promise.resolve(null),
        nav.support.includes('optical') ? countRows('optical_orders', (q) => q.not('status', 'in', '("dispensed","cancelled")')) : Promise.resolve(null),
        nav.support.includes('optical_inventory') ? countLowStockEyewear() : Promise.resolve(null),
        nav.support.includes('billing') ? countRows('bills', (q) => q.neq('payment_status', 'paid')) : Promise.resolve(null),
        nav.support.includes('insurance') ? countRows('insurance_claims', (q) => q.not('status', 'in', '("settled","rejected")')) : Promise.resolve(null),
        nav.support.includes('mrd_requests') ? countRows('record_requests', (q) => q.not('status', 'in', '("issued","rejected")')) : Promise.resolve(null),
        nav.support.includes('mrd_mlc') ? countRows('mlc_cases', (q) => q.neq('status', 'closed')) : Promise.resolve(null),
        nav.support.includes('eye_bank_tissues') ? countRows('eye_bank_tissues', (q) => q.eq('status', 'available')) : Promise.resolve(null),
        nav.support.includes('outreach_camps') ? countRows('outreach_camps', (q) => q.eq('status', 'planned')) : Promise.resolve(null),
        nav.support.includes('equipment_assets') ? countMaintenanceDue() : Promise.resolve(null),
      ]);
      return { patients, activeVisits, todayAppointments, totalWaiting, pendingPharmacy, lowStock, pendingOptical, lowStockEyewear, unpaidBills, pendingInsurance, openRecordRequests, openMlcCases, availableTissues, activeCamps, maintenanceDue };
    },
  });

  const cards = [
    nav.patients && { label: 'Registered patients', value: data?.patients, to: '/patients' },
    nav.waitingBoard && { label: 'Patients waiting (all clinics)', value: data?.totalWaiting, to: '/waiting-room' },
    nav.journeys.length > 0 && { label: `Active visits — ${nav.journeys[0]}`, value: data?.activeVisits, to: `/journeys/${nav.journeys[0]}` },
    nav.appointments && { label: 'Appointments from today', value: data?.todayAppointments, to: '/appointments' },
    nav.support.includes('pharmacy') && { label: 'Prescriptions pending dispense', value: data?.pendingPharmacy, to: '/pharmacy' },
    nav.support.includes('pharmacy_inventory') && { label: 'Drugs low on stock', value: data?.lowStock, to: '/pharmacy/inventory' },
    nav.support.includes('optical') && { label: 'Optical orders pending', value: data?.pendingOptical, to: '/optical' },
    nav.support.includes('optical_inventory') && { label: 'Eyewear low on stock', value: data?.lowStockEyewear, to: '/optical/inventory' },
    nav.support.includes('billing') && { label: 'Bills unpaid', value: data?.unpaidBills, to: '/billing' },
    nav.support.includes('insurance') && { label: 'Insurance claims pending', value: data?.pendingInsurance, to: '/insurance' },
    nav.support.includes('mrd_requests') && { label: 'Open record requests', value: data?.openRecordRequests, to: '/mrd/requests' },
    nav.support.includes('mrd_mlc') && { label: 'Open MLC cases', value: data?.openMlcCases, to: '/mrd/mlc' },
    nav.support.includes('eye_bank_tissues') && { label: 'Tissues available', value: data?.availableTissues, to: '/eye-bank/tissues' },
    nav.support.includes('outreach_camps') && { label: 'Camps planned', value: data?.activeCamps, to: '/outreach-camps' },
    nav.support.includes('equipment_assets') && { label: 'Maintenance/calibration due or overdue', value: data?.maintenanceDue, to: '/admin/equipment' },
  ].filter(Boolean) as { label: string; value: number | null | undefined; to: string }[];

  const quickActions = [
    nav.patients && { to: '/patients?new=1', label: '+ Register patient', primary: true },
    nav.appointments && { to: '/appointments', label: 'Schedule appointment' },
    nav.waitingBoard && { to: '/waiting-room', label: 'Waiting room' },
    nav.journeys.length > 0 && { to: `/journeys/${nav.journeys[0]}`, label: `${nav.journeys[0]} queue` },
    nav.support.includes('pharmacy') && { to: '/pharmacy', label: 'Pharmacy queue' },
    nav.support.includes('pharmacy_inventory') && { to: '/pharmacy/inventory', label: 'Pharmacy inventory' },
    nav.support.includes('optical') && { to: '/optical', label: 'Optical queue' },
    nav.support.includes('optical_inventory') && { to: '/optical/inventory', label: 'Optical inventory' },
    nav.support.includes('billing') && { to: '/billing', label: 'Billing' },
    nav.support.includes('insurance') && { to: '/insurance', label: 'Insurance desk' },
    nav.support.includes('mrd_requests') && { to: '/mrd/requests', label: 'Record requests' },
    nav.support.includes('mrd_mlc') && { to: '/mrd/mlc', label: 'MLC register' },
    nav.support.includes('mrd_completion') && { to: '/mrd/completion', label: 'Completion dashboard' },
    nav.support.includes('eye_bank_donors') && { to: '/eye-bank/donors', label: 'Eye bank donors' },
    nav.support.includes('eye_bank_tissues') && { to: '/eye-bank/tissues', label: 'Eye bank tissues' },
    nav.support.includes('emergency_triage') && { to: '/emergency-triage', label: 'Emergency triage' },
    nav.support.includes('outreach_camps') && { to: '/outreach-camps', label: 'Outreach camps' },
    nav.support.includes('equipment_assets') && { to: '/admin/equipment', label: 'Equipment register' },
    nav.support.includes('hr_employees') && { to: '/admin/employees', label: 'Employees (HR)' },
    nav.support.includes('workforce') && { to: '/workforce', label: 'Workforce' },
  ].filter(Boolean) as { to: string; label: string; primary?: boolean }[];

  return (
    <div>
      <h2>Welcome, {profile?.full_name?.split(' ')[0] ?? 'there'}</h2>
      <p className="text-muted">
        Here's what's happening at the hospital today
        {profile && <> — viewing as <strong>{profile.role.replace(/_/g, ' ')}</strong></>}.
      </p>

      {cards.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
          {cards.map((c) => (
            <Link key={c.label} to={c.to} style={{ color: 'inherit' }}>
              <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                <div className="card-kicker">Overview</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 600 }}>
                  {c.value ?? '—'}
                </div>
                <div className="card-body">{c.label}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted" style={{ marginTop: 'var(--space-6)' }}>Nothing assigned to this role yet.</p>
      )}

      {quickActions.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h3>Quick actions</h3>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {quickActions.map((a) => (
              <Link key={a.to} className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`} to={a.to}>{a.label}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\DashboardPage.tsx'

New-Item -ItemType Directory -Force -Path 'src\pages' | Out-Null
Set-Content -Path 'src\pages\EquipmentAssetsPage.tsx' -Encoding UTF8 -NoNewline -Value @'
import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { FileUploadField } from '../components/FileUploadField';

const CATEGORIES = ['diagnostic', 'surgical', 'laser', 'sterilization', 'emergency', 'it', 'utility', 'other'];
const CRITICALITY = ['life_safety', 'clinical_critical', 'routine'];
const STATUSES = ['active', 'under_maintenance', 'decommissioned', 'disposed'];
const SCHEDULE_TYPES = ['preventive_maintenance', 'calibration', 'safety_check'];
const WORK_TYPES = ['preventive_maintenance', 'calibration', 'safety_check', 'breakdown_repair'];
const WORK_PRIORITIES = ['routine', 'urgent', 'emergency'];

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysUntil = (dateStr: string) => Math.round((new Date(dateStr).getTime() - new Date(todayISO()).getTime()) / 86400000);

function dueStyle(days: number): React.CSSProperties {
  if (days < 0) return { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' };
  if (days <= 7) return { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' };
  return { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' };
}
function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `due in ${days}d`;
}

const CRITICALITY_STYLE: Record<string, React.CSSProperties> = {
  life_safety: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
  clinical_critical: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  routine: {},
};

function AddEquipmentForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    asset_tag: '', name: '', category: 'diagnostic', department: '', location: '',
    manufacturer: '', model_number: '', serial_number: '', purchase_date: '', purchase_cost: '',
    warranty_end_date: '', vendor_name: '', vendor_contact: '', criticality: 'routine', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_tag.trim() || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('equipment_assets').insert({
      asset_tag: form.asset_tag,
      name: form.name,
      category: form.category,
      department: form.department || null,
      location: form.location || null,
      manufacturer: form.manufacturer || null,
      model_number: form.model_number || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
      warranty_end_date: form.warranty_end_date || null,
      vendor_name: form.vendor_name || null,
      vendor_contact: form.vendor_contact || null,
      criticality: form.criticality,
      notes: form.notes || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['equipment-assets'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Register equipment</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Asset tag *</label><input className="input" value={form.asset_tag} onChange={(e) => set('asset_tag', e.target.value)} placeholder="NH-EQ-0001" required /></div>
        <div className="field" style={{ flex: '1 1 240px' }}><label>Name *</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Phacoemulsification Machine" required /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Criticality</label>
          <select className="input" value={form.criticality} onChange={(e) => set('criticality', e.target.value)}>
            {CRITICALITY.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Department</label><input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Location / Room</label><input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Manufacturer</label><input className="input" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Model number</label><input className="input" value={form.model_number} onChange={(e) => set('model_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Serial number</label><input className="input" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Purchase date</label><input className="input" type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Purchase cost (₹)</label><input className="input" type="number" value={form.purchase_cost} onChange={(e) => set('purchase_cost', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Warranty end date</label><input className="input" type="date" value={form.warranty_end_date} onChange={(e) => set('warranty_end_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Vendor name</label><input className="input" value={form.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Vendor contact</label><input className="input" value={form.vendor_contact} onChange={(e) => set('vendor_contact', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Register equipment'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function AmcForm({ equipmentId, onDone }: { equipmentId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ vendor_name: '', vendor_contact: '', contract_number: '', contract_type: 'amc', start_date: '', end_date: '', annual_cost: '', coverage_details: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_name.trim() || !form.start_date || !form.end_date) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('amc_contracts').insert({
      equipment_id: equipmentId,
      vendor_name: form.vendor_name,
      vendor_contact: form.vendor_contact || null,
      contract_number: form.contract_number || null,
      contract_type: form.contract_type,
      start_date: form.start_date,
      end_date: form.end_date,
      annual_cost: form.annual_cost ? Number(form.annual_cost) : null,
      coverage_details: form.coverage_details || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['equipment-assets'] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', border: '1px dashed var(--color-divider)' }}>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Vendor *</label><input className="input" value={form.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 140px' }}><label>Contact</label><input className="input" value={form.vendor_contact} onChange={(e) => set('vendor_contact', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Contract #</label><input className="input" value={form.contract_number} onChange={(e) => set('contract_number', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 120px' }}>
        <label>Type</label>
        <select className="input" value={form.contract_type} onChange={(e) => set('contract_type', e.target.value)}>
          <option value="amc">AMC (labour only)</option>
          <option value="cmc">CMC (parts included)</option>
          <option value="warranty_extension">Warranty extension</option>
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 130px' }}><label>Start date *</label><input className="input" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 130px' }}><label>End date *</label><input className="input" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Annual cost (₹)</label><input className="input" type="number" value={form.annual_cost} onChange={(e) => set('annual_cost', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 100%' }}><label>Coverage details</label><input className="input" value={form.coverage_details} onChange={(e) => set('coverage_details', e.target.value)} /></div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add contract'}</button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ScheduleForm({ equipmentId, onDone }: { equipmentId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ schedule_type: 'preventive_maintenance', frequency_days: '365', next_due_date: '', assigned_vendor: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.next_due_date || !form.frequency_days) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('maintenance_schedules').insert({
      equipment_id: equipmentId,
      schedule_type: form.schedule_type,
      frequency_days: Number(form.frequency_days),
      next_due_date: form.next_due_date,
      assigned_vendor: form.assigned_vendor || null,
      notes: form.notes || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['equipment-detail', equipmentId] });
    qc.invalidateQueries({ queryKey: ['maintenance-due'] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', border: '1px dashed var(--color-divider)' }}>
      <div className="field" style={{ flex: '1 1 180px' }}>
        <label>Schedule type</label>
        <select className="input" value={form.schedule_type} onChange={(e) => set('schedule_type', e.target.value)}>
          {SCHEDULE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Every (days)</label><input className="input" type="number" min={1} value={form.frequency_days} onChange={(e) => set('frequency_days', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 140px' }}><label>Next due *</label><input className="input" type="date" value={form.next_due_date} onChange={(e) => set('next_due_date', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 160px' }}><label>Vendor / technician</label><input className="input" value={form.assigned_vendor} onChange={(e) => set('assigned_vendor', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add schedule'}</button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ReportWorkOrderForm({ equipmentId, onDone }: { equipmentId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ work_type: 'breakdown_repair', priority: 'routine', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('maintenance_work_orders').insert({
      equipment_id: equipmentId,
      work_type: form.work_type,
      priority: form.priority,
      description: form.description,
      reported_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['equipment-detail', equipmentId] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', border: '1px dashed var(--color-divider)' }}>
      <div className="field" style={{ flex: '1 1 180px' }}>
        <label>Type</label>
        <select className="input" value={form.work_type} onChange={(e) => set('work_type', e.target.value)}>
          {WORK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 140px' }}>
        <label>Priority</label>
        <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
          {WORK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '1 1 100%' }}><label>What's wrong? *</label><input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. IOP readings inconsistent, calibration light blinking" required /></div>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Reporting…' : 'Report issue'}</button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function CompleteWorkOrderForm({ wo, onDone }: { wo: any; onDone: () => void }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isCalibration = wo.work_type === 'calibration';
  const [form, setForm] = useState({
    completed_date: todayISO(), downtime_hours: '', cost: '', findings: '',
    certificate_number: '', certifying_body: '', valid_until: '',
  });
  const [certUrl, setCertUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: woError } = await supabase.from('maintenance_work_orders').update({
      status: 'completed',
      completed_date: form.completed_date,
      downtime_hours: form.downtime_hours ? Number(form.downtime_hours) : null,
      cost: form.cost ? Number(form.cost) : null,
      findings: form.findings || null,
    }).eq('id', wo.id);
    if (woError) { setSaving(false); setError(woError.message); return; }

    // Completing a scheduled item rolls the schedule's due date forward —
    // this is application logic (mirrors dispensePrescription.ts /
    // billingPayment.ts) rather than a DB trigger, matching how the rest
    // of this codebase sequences multi-table writes.
    if (wo.schedule_id) {
      const { data: schedule } = await supabase.from('maintenance_schedules').select('frequency_days').eq('id', wo.schedule_id).maybeSingle();
      if (schedule) {
        const next = new Date(form.completed_date);
        next.setDate(next.getDate() + schedule.frequency_days);
        await supabase.from('maintenance_schedules').update({
          last_completed_date: form.completed_date,
          next_due_date: next.toISOString().slice(0, 10),
        }).eq('id', wo.schedule_id);
      }
    }

    if (isCalibration && (form.certificate_number || certUrl)) {
      await supabase.from('calibration_certificates').insert({
        equipment_id: wo.equipment_id,
        work_order_id: wo.id,
        certificate_number: form.certificate_number || null,
        certifying_body: form.certifying_body || null,
        calibrated_on: form.completed_date,
        valid_until: form.valid_until || null,
        document_url: certUrl,
        uploaded_by: profile?.id,
      });
    }

    setSaving(false);
    qc.invalidateQueries({ queryKey: ['equipment-detail', wo.equipment_id] });
    qc.invalidateQueries({ queryKey: ['maintenance-due'] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', background: 'var(--color-accent-100)' }}>
      <div className="field" style={{ flex: '1 1 140px' }}><label>Completed on</label><input className="input" type="date" value={form.completed_date} onChange={(e) => set('completed_date', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Downtime (hrs)</label><input className="input" type="number" value={form.downtime_hours} onChange={(e) => set('downtime_hours', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 120px' }}><label>Cost (₹)</label><input className="input" type="number" value={form.cost} onChange={(e) => set('cost', e.target.value)} /></div>
      <div className="field" style={{ flex: '1 1 100%' }}><label>Findings / work done</label><textarea className="input" value={form.findings} onChange={(e) => set('findings', e.target.value)} /></div>
      {isCalibration && (
        <>
          <div className="field" style={{ flex: '1 1 160px' }}><label>Certificate #</label><input className="input" value={form.certificate_number} onChange={(e) => set('certificate_number', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 180px' }}><label>Certifying body</label><input className="input" value={form.certifying_body} onChange={(e) => set('certifying_body', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 140px' }}><label>Valid until</label><input className="input" type="date" value={form.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label>Certificate document</label>
            <FileUploadField value={certUrl} onChange={setCertUrl} folder="equipment" />
          </div>
        </>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Mark complete'}</button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function EquipmentRow({ item, canManage }: { item: any; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showAmcForm, setShowAmcForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const { data: detail } = useQuery({
    queryKey: ['equipment-detail', item.id],
    enabled: expanded,
    queryFn: async () => {
      const [amc, docs, schedules, workOrders, certs] = await Promise.all([
        supabase.from('amc_contracts').select('*').eq('equipment_id', item.id).order('end_date', { ascending: false }),
        supabase.from('equipment_documents').select('*').eq('equipment_id', item.id).order('created_at', { ascending: false }),
        supabase.from('maintenance_schedules').select('*').eq('equipment_id', item.id).eq('active', true).order('next_due_date'),
        supabase.from('maintenance_work_orders').select('*').eq('equipment_id', item.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('calibration_certificates').select('*').eq('equipment_id', item.id).order('calibrated_on', { ascending: false }),
      ]);
      if (amc.error) throw amc.error;
      if (docs.error) throw docs.error;
      if (schedules.error) throw schedules.error;
      if (workOrders.error) throw workOrders.error;
      if (certs.error) throw certs.error;
      return { amc: amc.data, docs: docs.data, schedules: schedules.data, workOrders: workOrders.data, certs: certs.data };
    },
  });

  const startWork = async (id: string) => {
    await supabase.from('maintenance_work_orders').update({ status: 'in_progress' }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['equipment-detail', item.id] });
  };
  const cancelWork = async (id: string) => {
    await supabase.from('maintenance_work_orders').update({ status: 'cancelled' }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['equipment-detail', item.id] });
  };

  const updateStatus = async (status: string) => {
    await supabase.from('equipment_assets').update({ status }).eq('id', item.id);
    qc.invalidateQueries({ queryKey: ['equipment-assets'] });
  };

  const uploadDoc = async (url: string | null) => {
    if (!url) return;
    await supabase.from('equipment_documents').insert({
      equipment_id: item.id, document_type: 'other', document_name: 'Document', document_url: url, uploaded_by: profile?.id,
    });
    qc.invalidateQueries({ queryKey: ['equipment-detail', item.id] });
  };

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {item.asset_tag}</button></td>
        <td>{item.name}<div className="text-muted" style={{ fontSize: 11 }}>{item.manufacturer} {item.model_number}</div></td>
        <td>{item.category.replace(/_/g, ' ')}</td>
        <td>{item.department ?? '—'}</td>
        <td><span className="tag tag-outline" style={CRITICALITY_STYLE[item.criticality]}>{item.criticality.replace(/_/g, ' ')}</span></td>
        <td>
          {canManage ? (
            <select className="input" value={item.status} onChange={(e) => updateStatus(e.target.value)} style={{ width: 150 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          ) : <span className="tag tag-neutral">{item.status.replace(/_/g, ' ')}</span>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <div style={{ fontSize: 12 }} className="text-muted">
                Serial {item.serial_number ?? '—'} · Purchased {item.purchase_date ?? '—'} {item.purchase_cost ? `for ₹${Number(item.purchase_cost).toLocaleString()}` : ''} · Warranty ends {item.warranty_end_date ?? '—'} · Vendor {item.vendor_name ?? '—'} {item.vendor_contact ?? ''}
              </div>
              {item.notes && <p style={{ fontSize: 13 }}>{item.notes}</p>}

              <h5 style={{ marginBottom: 4 }}>Maintenance & calibration schedules</h5>
              {detail?.schedules?.length ? (
                <table className="table" style={{ marginBottom: 8 }}>
                  <thead><tr><th>Type</th><th>Every</th><th>Last done</th><th>Next due</th><th>Vendor</th></tr></thead>
                  <tbody>
                    {detail.schedules.map((s: any) => {
                      const days = daysUntil(s.next_due_date);
                      return (
                        <tr key={s.id}>
                          <td>{s.schedule_type.replace(/_/g, ' ')}</td>
                          <td>{s.frequency_days}d</td>
                          <td>{s.last_completed_date ?? '—'}</td>
                          <td><span className="tag tag-outline" style={dueStyle(days)}>{s.next_due_date} · {dueLabel(days)}</span></td>
                          <td>{s.assigned_vendor ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No PM/calibration schedule set up yet.</p>}
              {canManage && (showScheduleForm
                ? <ScheduleForm equipmentId={item.id} onDone={() => setShowScheduleForm(false)} />
                : <button className="btn btn-secondary" onClick={() => setShowScheduleForm(true)}>+ Add schedule</button>)}

              <h5 style={{ marginTop: 16, marginBottom: 4 }}>Work orders</h5>
              {detail?.workOrders?.length ? (
                <table className="table" style={{ marginBottom: 8 }}>
                  <thead><tr><th>Type</th><th>Priority</th><th>Description</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {detail.workOrders.map((wo: any) => (
                      <Fragment key={wo.id}>
                        <tr>
                          <td>{wo.work_type.replace(/_/g, ' ')}</td>
                          <td><span className="tag tag-outline" style={wo.priority === 'emergency' ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : wo.priority === 'urgent' ? { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' } : undefined}>{wo.priority}</span></td>
                          <td className="text-muted">{wo.description ?? wo.findings ?? '—'}</td>
                          <td><span className="tag tag-neutral">{wo.status.replace(/_/g, ' ')}</span></td>
                          <td>
                            {canManage && wo.status === 'open' && <button className="btn btn-ghost" onClick={() => startWork(wo.id)}>Start</button>}
                            {canManage && (wo.status === 'open' || wo.status === 'in_progress') && (
                              <>
                                <button className="btn btn-ghost" onClick={() => setCompletingId(completingId === wo.id ? null : wo.id)}>Complete</button>
                                <button className="btn btn-ghost" onClick={() => cancelWork(wo.id)}>Cancel</button>
                              </>
                            )}
                          </td>
                        </tr>
                        {completingId === wo.id && (
                          <tr><td colSpan={5}><CompleteWorkOrderForm wo={wo} onDone={() => setCompletingId(null)} /></td></tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No work orders logged.</p>}
              {showReportForm
                ? <ReportWorkOrderForm equipmentId={item.id} onDone={() => setShowReportForm(false)} />
                : <button className="btn btn-secondary" onClick={() => setShowReportForm(true)}>+ Report an issue</button>}

              <h5 style={{ marginTop: 16, marginBottom: 4 }}>Calibration certificates</h5>
              {detail?.certs?.length ? (
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {detail.certs.map((c: any) => (
                    <li key={c.id}>
                      {c.calibrated_on} — {c.certifying_body ?? 'uncertified body'} {c.certificate_number ? `(#${c.certificate_number})` : ''}
                      {c.valid_until ? `, valid until ${c.valid_until}` : ''}
                      {c.document_url && <> — <a href={c.document_url} target="_blank" rel="noreferrer">certificate</a></>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No calibration certificates on file.</p>}

              <h5 style={{ marginTop: 16, marginBottom: 4 }}>AMC / CMC contracts</h5>
              {detail?.amc?.length ? (
                <table className="table" style={{ marginBottom: 8 }}>
                  <thead><tr><th>Vendor</th><th>Type</th><th>Period</th><th>Annual cost</th><th>Status</th></tr></thead>
                  <tbody>
                    {detail.amc.map((a: any) => {
                      const expired = new Date(a.end_date) < new Date();
                      return (
                        <tr key={a.id}>
                          <td>{a.vendor_name}</td>
                          <td>{a.contract_type.toUpperCase()}</td>
                          <td>{a.start_date} → {a.end_date}</td>
                          <td>{a.annual_cost ? `₹${Number(a.annual_cost).toLocaleString()}` : '—'}</td>
                          <td><span className={`tag ${expired ? 'tag-outline' : 'tag-accent'}`} style={expired ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>{expired ? 'expired' : a.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No AMC/CMC contract on file.</p>}
              {canManage && (showAmcForm
                ? <AmcForm equipmentId={item.id} onDone={() => setShowAmcForm(false)} />
                : <button className="btn btn-secondary" onClick={() => setShowAmcForm(true)}>+ Add AMC/CMC contract</button>)}

              <h5 style={{ marginTop: 16, marginBottom: 4 }}>Documents</h5>
              {detail?.docs?.length ? (
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {detail.docs.map((d: any) => <li key={d.id}><a href={d.document_url} target="_blank" rel="noreferrer">{d.document_name}</a> — {d.document_type.replace(/_/g, ' ')}</li>)}
                </ul>
              ) : <p className="text-muted" style={{ fontSize: 13 }}>No documents uploaded.</p>}
              {canManage && (
                <div className="field" style={{ maxWidth: 300 }}>
                  <label>Upload manual / warranty / invoice</label>
                  <FileUploadField value={null} onChange={uploadDoc} folder="equipment" />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DueMaintenancePanel() {
  const { data: due } = useQuery({
    queryKey: ['maintenance-due'],
    queryFn: async () => {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('*, equipment_assets(asset_tag, name, criticality)')
        .eq('active', true)
        .lte('next_due_date', horizon.toISOString().slice(0, 10))
        .order('next_due_date');
      if (error) throw error;
      return data;
    },
  });

  if (!due || due.length === 0) return null;
  const overdue = due.filter((d: any) => daysUntil(d.next_due_date) < 0);

  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>
        Due & overdue — next 30 days
        {overdue.length > 0 && <span className="tag tag-outline" style={{ marginLeft: 8, background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' }}>{overdue.length} overdue</span>}
      </h4>
      <table className="table">
        <thead><tr><th>Equipment</th><th>Type</th><th>Due date</th><th /></tr></thead>
        <tbody>
          {due.map((d: any) => {
            const days = daysUntil(d.next_due_date);
            return (
              <tr key={d.id}>
                <td>{d.equipment_assets?.name} <span className="text-muted" style={{ fontSize: 11 }}>({d.equipment_assets?.asset_tag})</span></td>
                <td>{d.schedule_type.replace(/_/g, ' ')}</td>
                <td><span className="tag tag-outline" style={dueStyle(days)}>{d.next_due_date} · {dueLabel(days)}</span></td>
                <td>{d.equipment_assets?.criticality === 'life_safety' && <span className="tag tag-outline" style={{ background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' }}>life safety</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EquipmentAssetsPage() {
  const { profile } = useAuth();
  const canManage = profile?.role === 'biomedical_engineer' || profile?.role === 'admin';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['equipment-assets', debouncedSearch],
    queryFn: async () => {
      let q = supabase.from('equipment_assets').select('*').order('asset_tag');
      if (debouncedSearch.trim()) q = q.or(`name.ilike.%${sanitizeSearchTerm(debouncedSearch)}%,asset_tag.ilike.%${sanitizeSearchTerm(debouncedSearch)}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Equipment Asset Register</h2>
        {canManage && !showAddForm && <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Register equipment</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Every diagnostic, surgical and laser instrument in the hospital, with its preventive-maintenance and calibration schedule.
      </p>

      <DueMaintenancePanel />

      {showAddForm && <AddEquipmentForm onDone={() => setShowAddForm(false)} />}

      <div className="field" style={{ maxWidth: 300, marginBottom: 'var(--space-4)' }}>
        <label>Search</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Asset tag or name" />
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Asset tag</th><th>Name</th><th>Category</th><th>Department</th><th>Criticality</th><th>Status</th></tr></thead>
          <tbody>
            {items?.map((it: any) => <EquipmentRow key={it.id} item={it} canManage={canManage} />)}
            {items?.length === 0 && <tr><td colSpan={6} className="text-muted">No equipment registered yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host '  wrote src\pages\EquipmentAssetsPage.tsx'

New-Item -ItemType Directory -Force -Path 'supabase\migrations' | Out-Null
Set-Content -Path 'supabase\migrations\0030_maintenance_calibration.sql' -Encoding UTF8 -NoNewline -Value @'
-- ============================================================
-- NETRA HIMS — Preventive maintenance & calibration engine (Domain D)
-- Phase 2 of the paperless-hospital roadmap. Attaches to the equipment
-- asset register built in 0029. This is the highest clinical-risk gap
-- identified in the audit: an un-calibrated tonometer or biometer feeds
-- wrong numbers straight into a treatment plan or IOL power calculation.
--
-- Facility/utility assets (generators, UPS, medical gas, HVAC — Domain E
-- in the roadmap) reuse this same engine rather than a parallel schema:
-- equipment_assets.category already accepts 'utility' as of this migration,
-- so a generator is just another asset row with its own PM schedule.
-- ============================================================

alter table equipment_assets drop constraint equipment_assets_category_check;
alter table equipment_assets add constraint equipment_assets_category_check
  check (category in ('diagnostic', 'surgical', 'laser', 'sterilization', 'emergency', 'it', 'utility', 'other'));

create table maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  schedule_type text not null check (schedule_type in ('preventive_maintenance', 'calibration', 'safety_check')),
  frequency_days int not null check (frequency_days > 0),
  last_completed_date date,
  next_due_date date not null,
  assigned_vendor text,
  notes text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maintenance_schedules_equipment on maintenance_schedules(equipment_id);
create index idx_maintenance_schedules_due on maintenance_schedules(next_due_date) where active;
create trigger trg_maintenance_schedules_updated before update on maintenance_schedules
  for each row execute function set_updated_at();

create table maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  schedule_id uuid references maintenance_schedules(id) on delete set null, -- null for ad-hoc breakdown reports
  work_type text not null check (work_type in ('preventive_maintenance', 'calibration', 'safety_check', 'breakdown_repair')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'routine' check (priority in ('routine', 'urgent', 'emergency')),
  description text, -- what's wrong / why this work order was raised
  reported_by uuid references profiles(id),
  assigned_to text, -- technician / vendor name — free text until Phase 3 adds a vendor register
  scheduled_date date,
  completed_date date,
  downtime_hours numeric(6,1),
  cost numeric(12,2),
  findings text, -- what was actually done, filled in on completion
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maintenance_work_orders_equipment on maintenance_work_orders(equipment_id);
create index idx_maintenance_work_orders_status on maintenance_work_orders(status);
create trigger trg_maintenance_work_orders_updated before update on maintenance_work_orders
  for each row execute function set_updated_at();

create table calibration_certificates (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  work_order_id uuid references maintenance_work_orders(id) on delete set null,
  certificate_number text,
  certifying_body text,
  calibrated_on date not null,
  valid_until date,
  document_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_calibration_certificates_equipment on calibration_certificates(equipment_id);

-- ---------- RLS ----------
-- Reads stay staff-wide, same as the rest of the equipment register.
-- Schedules (planning) and certificates (official records) are
-- biomedical_engineer-only to write. Work orders are the exception: any
-- active staff member can *report* an issue (insert), since a nurse or
-- optometrist is usually the first to notice a broken instrument — but
-- only biomedical_engineer can update/progress/complete one.
alter table maintenance_schedules enable row level security;
create policy "maintenance_schedules_select" on maintenance_schedules for select to authenticated using (is_staff());
create policy "maintenance_schedules_insert" on maintenance_schedules for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "maintenance_schedules_update" on maintenance_schedules for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "maintenance_schedules_delete" on maintenance_schedules for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

alter table maintenance_work_orders enable row level security;
create policy "maintenance_work_orders_select" on maintenance_work_orders for select to authenticated using (is_staff());
create policy "maintenance_work_orders_insert" on maintenance_work_orders for insert to authenticated with check (is_staff());
create policy "maintenance_work_orders_update" on maintenance_work_orders for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "maintenance_work_orders_delete" on maintenance_work_orders for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

alter table calibration_certificates enable row level security;
create policy "calibration_certificates_select" on calibration_certificates for select to authenticated using (is_staff());
create policy "calibration_certificates_insert" on calibration_certificates for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "calibration_certificates_update" on calibration_certificates for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "calibration_certificates_delete" on calibration_certificates for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

create trigger audit_maintenance_work_orders after insert or update or delete on maintenance_work_orders
  for each row execute function log_audit_event();
create trigger audit_calibration_certificates after insert or update or delete on calibration_certificates
  for each row execute function log_audit_event();

'@
Write-Host '  wrote supabase\migrations\0030_maintenance_calibration.sql'

Write-Host 'All Phase 2 files written.' -ForegroundColor Green
git add -A
git status
Write-Host "Now run: git commit -m 'Add Phase 2: preventive maintenance & calibration engine' ; git push origin claude/determined-ride-o63al9" -ForegroundColor Yellow