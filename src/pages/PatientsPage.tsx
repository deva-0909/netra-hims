import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
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
    const { error: insertError } = await supabase.from('patients').insert(payload);
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['patients'] });
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
          <input className="input" value={form.guardian_relation} onChange={(e) => set('guardian_relation', e.target.value)} />
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
          <input className="input" value={form.insurance_provider} onChange={(e) => set('insurance_provider', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Insurance policy no.</label>
          <input className="input" value={form.insurance_policy_no} onChange={(e) => set('insurance_policy_no', e.target.value)} />
        </div>

        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Blood group</label>
          <input className="input" value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}>
          <label>Known allergies</label>
          <input className="input" value={form.known_allergies} onChange={(e) => set('known_allergies', e.target.value)} />
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
                <td><Link className="btn btn-ghost" to={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()}>Open →</Link></td>
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
