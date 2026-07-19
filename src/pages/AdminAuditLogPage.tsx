import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const TABLES = ['bills', 'insurance_claims', 'profiles'];

function summarizeChange(entry: any): string {
  if (entry.action === 'INSERT') return 'Created';
  if (entry.action === 'DELETE') return 'Deleted';
  // For updates, show which fields actually changed
  const oldV = entry.old_value ?? {};
  const newV = entry.new_value ?? {};
  const changed = Object.keys(newV).filter((k) => k !== 'updated_at' && JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]));
  if (changed.length === 0) return 'Updated';
  return `Changed: ${changed.map((k) => `${k} → ${newV[k]}`).join(', ')}`;
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
        Tracks changes to bills, insurance claims, and staff profiles — the tables where "who changed this" matters most.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)' }}>
        <button className={`btn ${tableFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTableFilter('all')}>All</button>
        {TABLES.map((t) => (
          <button key={t} className={`btn ${tableFilter === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTableFilter(t)}>
            {t.replace(/_/g, ' ')}
          </button>
        ))}
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
