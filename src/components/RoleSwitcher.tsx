import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import type { StaffRole } from '../lib/types';

const ROLES: StaffRole[] = [
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff',
];

export function RoleSwitcher() {
  const { profile, refreshProfile } = useAuth();
  const [switching, setSwitching] = useState(false);

  if (!profile) return null;

  const handleChange = async (role: StaffRole) => {
    setSwitching(true);
    await supabase.from('profiles').update({ role }).eq('id', profile.id);
    await refreshProfile();
    setSwitching(false);
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent-700)', marginBottom: 4 }}>
        Demo — viewing as
      </div>
      <select
        className="input"
        value={profile.role}
        disabled={switching}
        onChange={(e) => handleChange(e.target.value as StaffRole)}
        style={{ fontSize: 13, padding: '5px 8px', minHeight: 32 }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
  );
}
