import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const TABLES = [
  'bills', 'insurance_claims', 'profiles', 'patients', 'mlc_cases', 'surgical_consents', 'record_requests', 'admissions',
  'amc_contracts', 'biomedical_waste_log', 'calibration_certificates', 'deposits', 'employee_exits', 'employees',
  'equipment_assets', 'incident_reports', 'leave_requests', 'maintenance_work_orders', 'ot_safety_checklists',
  'patient_grievances', 'po_payments', 'purchase_order_items', 'purchase_orders', 'regulatory_licenses',
  'lab_orders', 'lab_order_items', 'device_registry', 'device_readings',
  'journal_entries', 'expenses',
];

function summarizeChange(entry: any): string {
  if (entry.action === 'INSERT') return 'Created';
  if (entry.action === 'DELETE') return 'Deleted';
  // For updates, show which fields actually changed
  const oldV = entry.old_value ?? {};
  const newV = entry.new_value ?? {};
  const changed = Object.keys(newV).filter((k) => k !== 'updated_at' && JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]));
  if (changed.length === 0) return 'Updated';
  return `Changed: ${changed.map((k) => `${k} set to ${newV[k]}`).join(', ')}`;
}

export function AdminAuditLogPage() {
  const [tableFilter, setTableFilter] = useState('all');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['audit-log', tableFilter],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*, profiles!audit_log_changed_by_fkey(full_name)').order('changed_at', { ascending: false }).limit(100);
      if (tableFilter !== 'all') q = q.eq('table_name', tableFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <h2>Audit Log</h2>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Tracks changes across every table where "who changed this" matters — billing, patients (incl. merges), MLC cases, consents, HR, procurement, equipment, and compliance records.
      </p>

      <div className="field" style={{ maxWidth: 260, marginBottom: 'var(--space-4)' }}>
        <label>Table</label>
        <select className="input" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
          <option value="all">All tables</option>
          {TABLES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Table</th><th>Action</th><th>By</th><th>Details</th></tr></thead>
          <tbody>
            {entries?.map((e: any) => (
              <tr key={e.id}>
                <td>{new Date(e.changed_at).toLocaleString()}</td>
                <td>{e.table_name}</td>
                <td><span className="tag tag-neutral">{e.action}</span></td>
                <td>{e.profiles?.full_name ?? 'system'}</td>
                <td style={{ fontSize: 12 }}>{summarizeChange(e)}</td>
              </tr>
            ))}
            {entries?.length === 0 && <tr><td colSpan={5} className="text-muted">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}