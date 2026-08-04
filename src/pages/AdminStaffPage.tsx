import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import type { StaffRole } from '../lib/types';

const ROLES: StaffRole[] = [
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff', 'mrd', 'eye_bank',
  'hr_manager', 'biomedical_engineer', 'store_keeper', 'quality_manager',
];

export function AdminStaffPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateRole = async (id: string, role: StaffRole) => {
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['staff'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ active: !active }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['staff'] });
  };

  return (
    <div>
      <h2>Staff Administration</h2>
      <p className="text-muted" style={{ fontSize: 13 }}>
        New staff create their own account from the login screen ("Register staff"); use this page to assign the correct role and activate/deactivate access.
      </p>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Active</th><th>Joined</th></tr></thead>
          <tbody>
            {staff?.map((s: any) => {
              const isSelf = s.id === profile?.id;
              return (
                <tr key={s.id}>
                  <td>{s.full_name}{isSelf && <span className="tag tag-outline" style={{ marginLeft: 6 }}>you</span>}</td>
                  <td>
                    <select className="input" value={s.role} onChange={(e) => updateRole(s.id, e.target.value as StaffRole)} style={{ width: 160 }}>
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    <button
                      className={`btn ${s.active ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => toggleActive(s.id, s.active)}
                      disabled={isSelf && s.active}
                      title={isSelf && s.active ? "You can't deactivate your own account — it would lock you out." : undefined}
                    >
                      {s.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
