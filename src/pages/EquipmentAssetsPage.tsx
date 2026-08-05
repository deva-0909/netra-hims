import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { FileUploadField } from '../components/FileUploadField';
import { printMaintenanceJobCard } from '../lib/printMaintenanceJobCard';

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
                            <button className="btn btn-ghost" onClick={() => printMaintenanceJobCard(item, wo)}>Print job card</button>
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
