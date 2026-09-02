import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function AdminBranchesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('is_main', { ascending: false }).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: staff } = useQuery({
    queryKey: ['staff-with-branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*, branches(name)').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const addBranch = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('branches').insert({
      name: form.name, code: form.code, address: form.address || null, phone: form.phone || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm({ name: '', code: '', address: '', phone: '' });
    qc.invalidateQueries({ queryKey: ['branches'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('branches').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['branches'] });
  };

  const assignBranch = async (staffId: string, branchId: string) => {
    await supabase.from('profiles').update({ branch_id: branchId || null }).eq('id', staffId);
    qc.invalidateQueries({ queryKey: ['staff-with-branches'] });
  };

  return (
    <div>
      <h2>Branches</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -4 }}>
        Foundation for a multi-location setup — staff can be assigned to a branch. Inventory, billing and scheduling are not yet branch-scoped; every operational screen still shows the whole hospital.
      </p>

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', maxWidth: 480 }}>
        <h4 style={{ marginTop: 0 }}>Add branch</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="input" style={{ flex: '1 1 160px' }} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Branch name" />
          <input className="input" style={{ flex: '0 1 100px' }} value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="Code" />
          <input className="input" style={{ flex: '1 1 200px' }} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Address" />
          <input className="input" style={{ flex: '1 1 140px' }} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone" />
          <button className="btn btn-primary" onClick={addBranch} disabled={saving}>Add</button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      </div>

      <h4>Branches</h4>
      <table className="table" style={{ marginBottom: 'var(--space-6)' }}>
        <thead><tr><th>Name</th><th>Code</th><th>Address</th><th>Phone</th><th>Status</th></tr></thead>
        <tbody>
          {branches?.map((b: any) => (
            <tr key={b.id}>
              <td>{b.name} {b.is_main && <span className="tag tag-outline" style={{ marginLeft: 6, fontSize: 10 }}>main</span>}</td>
              <td className="text-muted">{b.code}</td>
              <td className="text-muted">{b.address ?? '—'}</td>
              <td className="text-muted">{b.phone ?? '—'}</td>
              <td><button className={`btn ${b.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(b.id, b.active)} disabled={b.is_main}>{b.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Staff → branch assignment</h4>
      <table className="table">
        <thead><tr><th>Staff</th><th>Role</th><th>Branch</th></tr></thead>
        <tbody>
          {staff?.map((s: any) => (
            <tr key={s.id}>
              <td>{s.full_name}</td>
              <td>{s.role.replace(/_/g, ' ')}</td>
              <td>
                <select className="input" value={s.branch_id ?? ''} onChange={(e) => assignBranch(s.id, e.target.value)} style={{ width: 200 }}>
                  <option value="">— none —</option>
                  {branches?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
