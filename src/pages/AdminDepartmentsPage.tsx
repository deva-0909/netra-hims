import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function AdminDepartmentsPage() {
  const qc = useQueryClient();
  const [newDept, setNewDept] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: staff } = useQuery({
    queryKey: ['staff-with-departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*, departments(name)').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const addDepartment = async () => {
    if (!newDept.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('departments').insert({ name: newDept });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewDept('');
    qc.invalidateQueries({ queryKey: ['departments'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('departments').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['departments'] });
  };

  const assignDepartment = async (staffId: string, departmentId: string) => {
    await supabase.from('profiles').update({ department_id: departmentId || null }).eq('id', staffId);
    qc.invalidateQueries({ queryKey: ['staff-with-departments'] });
  };

  return (
    <div>
      <h2>Doctors & Departments</h2>

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', maxWidth: 480 }}>
        <h4 style={{ marginTop: 0 }}>Add department</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Department name" />
          <button className="btn btn-primary" onClick={addDepartment} disabled={saving}>Add</button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      </div>

      <h4>Departments</h4>
      <table className="table" style={{ marginBottom: 'var(--space-6)' }}>
        <thead><tr><th>Name</th><th>Description</th><th>Status</th></tr></thead>
        <tbody>
          {departments?.map((d: any) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td className="text-muted">{d.description ?? '—'}</td>
              <td><button className={`btn ${d.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(d.id, d.active)}>{d.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Staff → department assignment</h4>
      <table className="table">
        <thead><tr><th>Staff</th><th>Role</th><th>Department</th></tr></thead>
        <tbody>
          {staff?.map((s: any) => (
            <tr key={s.id}>
              <td>{s.full_name}</td>
              <td>{s.role.replace(/_/g, ' ')}</td>
              <td>
                <select className="input" value={s.department_id ?? ''} onChange={(e) => assignDepartment(s.id, e.target.value)} style={{ width: 200 }}>
                  <option value="">— none —</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}