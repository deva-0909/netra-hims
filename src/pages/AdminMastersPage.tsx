import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

function InsuranceMastersTab() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('private');
  const [error, setError] = useState<string | null>(null);

  const { data: schemes } = useQuery({
    queryKey: ['insurance-masters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_masters').select('*').order('scheme_name');
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    setError(null);
    const { error: insertError } = await supabase.from('insurance_masters').insert({ scheme_name: name, scheme_type: type });
    if (insertError) { setError(insertError.message); return; }
    setName('');
    qc.invalidateQueries({ queryKey: ['insurance-masters'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('insurance_masters').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['insurance-masters'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '1 1 220px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Scheme name (e.g. Ayushman Bharat / PMJAY)" />
        <select className="input" style={{ width: 160 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="private">Private</option><option value="government">Government</option><option value="corporate">Corporate</option>
        </select>
        <button className="btn btn-primary" onClick={add}>Add scheme</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <table className="table">
        <thead><tr><th>Scheme</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>
          {schemes?.map((s: any) => (
            <tr key={s.id}>
              <td>{s.scheme_name}</td>
              <td className="text-muted">{s.scheme_type}</td>
              <td><button className={`btn ${s.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(s.id, s.active)}>{s.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvestigationMastersTab() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('lab');
  const [error, setError] = useState<string | null>(null);

  const { data: tests } = useQuery({
    queryKey: ['investigation-masters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('investigation_masters').select('*').order('test_name');
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    setError(null);
    const { error: insertError } = await supabase.from('investigation_masters').insert({ test_name: name, category });
    if (insertError) { setError(insertError.message); return; }
    setName('');
    qc.invalidateQueries({ queryKey: ['investigation-masters'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('investigation_masters').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['investigation-masters'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '1 1 220px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Test name" />
        <select className="input" style={{ width: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="lab">Lab</option><option value="imaging">Imaging</option><option value="cardiac">Cardiac</option><option value="other">Other</option>
        </select>
        <button className="btn btn-primary" onClick={add}>Add test</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <table className="table">
        <thead><tr><th>Test</th><th>Category</th><th>Status</th></tr></thead>
        <tbody>
          {tests?.map((t: any) => (
            <tr key={t.id}>
              <td>{t.test_name}</td>
              <td className="text-muted">{t.category}</td>
              <td><button className={`btn ${t.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(t.id, t.active)}>{t.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminMastersPage() {
  const [tab, setTab] = useState<'insurance' | 'investigation'>('insurance');

  return (
    <div>
      <h2>Insurance, PMJAY & Investigation Masters</h2>
      <p className="text-muted" style={{ fontSize: 13 }}>
        These lists feed the dropdowns used across Insurance Approval and Investigation Order screens hospital-wide.
      </p>
      <div className="seg" style={{ maxWidth: 360, marginBottom: 'var(--space-4)' }}>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'insurance'} onChange={() => setTab('insurance')} /> Insurance / PMJAY schemes
        </label>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'investigation'} onChange={() => setTab('investigation')} /> Investigation tests
        </label>
      </div>
      {tab === 'insurance' ? <InsuranceMastersTab /> : <InvestigationMastersTab />}
    </div>
  );
}