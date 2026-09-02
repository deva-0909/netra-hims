import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';

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

const CHARGE_CATEGORIES = ['consultation', 'investigation', 'pharmacy', 'optical', 'surgery', 'admission', 'other'];

function ChargeMasterTab() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('consultation');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

  const { data: charges } = useQuery({
    queryKey: ['charge-master'],
    queryFn: async () => {
      const { data, error } = await supabase.from('charge_master').select('*').order('category').order('name');
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    setError(null);
    const { error: insertError } = await supabase.from('charge_master').insert({
      code: code.trim() || null, name: name.trim(), category, standard_price: Number(price) || 0,
    });
    if (insertError) { setError(insertError.message); return; }
    setCode(''); setName(''); setPrice('');
    qc.invalidateQueries({ queryKey: ['charge-master'] });
  };

  const savePrice = async (id: string) => {
    const value = Number(priceEdits[id]);
    if (Number.isNaN(value) || value < 0) return;
    await supabase.from('charge_master').update({ standard_price: value, updated_at: new Date().toISOString() }).eq('id', id);
    setPriceEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
    qc.invalidateQueries({ queryKey: ['charge-master'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('charge_master').update({ active: !active, updated_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['charge-master'] });
  };

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Standard prices for services and packages — the billing screen picks from this list and pre-fills the price, instead of a price being typed from scratch on every bill.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '0 1 120px' }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (optional)" />
        <input className="input" style={{ flex: '1 1 220px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Service / package name" />
        <select className="input" style={{ width: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CHARGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input" style={{ flex: '0 1 140px' }} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Standard price" />
        <button className="btn btn-primary" onClick={add}>Add charge</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <table className="table">
        <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Standard price (&#8377;)</th><th /><th>Status</th></tr></thead>
        <tbody>
          {charges?.map((c: any) => (
            <tr key={c.id}>
              <td className="text-muted">{c.code ?? '—'}</td>
              <td>{c.name}</td>
              <td className="text-muted">{c.category}</td>
              <td><input className="input" style={{ width: 110 }} type="number" min={0} value={priceEdits[c.id] ?? String(c.standard_price)} onChange={(e) => setPriceEdits((prev) => ({ ...prev, [c.id]: e.target.value }))} /></td>
              <td><button className="btn btn-secondary" onClick={() => savePrice(c.id)}>Save</button></td>
              <td><button className={`btn ${c.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(c.id, c.active)}>{c.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
          {charges?.length === 0 && <tr><td colSpan={6} className="text-muted">No charges defined yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ConsultationFeesTab() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingModule, setSavingModule] = useState<string | null>(null);

  const { data: fees } = useQuery({
    queryKey: ['consultation-fees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultation_fees').select('*').order('clinic_module');
      if (error) throw error;
      return data as { clinic_module: string; fee: number; updated_at: string }[];
    },
  });

  const save = async (clinicModule: string, currentFee: number) => {
    const value = Number(edits[clinicModule] ?? currentFee);
    if (Number.isNaN(value) || value < 0) return;
    setSavingModule(clinicModule);
    await supabase.from('consultation_fees').update({ fee: value, updated_at: new Date().toISOString(), updated_by: profile?.id }).eq('clinic_module', clinicModule);
    setSavingModule(null);
    setEdits((prev) => { const next = { ...prev }; delete next[clinicModule]; return next; });
    qc.invalidateQueries({ queryKey: ['consultation-fees'] });
  };

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Collected up front at "Start a new visit" / appointment check-in, before the token is issued — standard OPD practice.
      </p>
      <table className="table">
        <thead><tr><th>Clinic module</th><th>Fee (&#8377;)</th><th /></tr></thead>
        <tbody>
          {fees?.map((f) => (
            <tr key={f.clinic_module}>
              <td>{MODULES[f.clinic_module]?.label ?? f.clinic_module}</td>
              <td><input className="input" style={{ width: 120 }} type="number" min={0} value={edits[f.clinic_module] ?? String(f.fee)} onChange={(e) => setEdits((prev) => ({ ...prev, [f.clinic_module]: e.target.value }))} /></td>
              <td><button className="btn btn-secondary" onClick={() => save(f.clinic_module, f.fee)} disabled={savingModule === f.clinic_module}>{savingModule === f.clinic_module ? 'Saving…' : 'Save'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminMastersPage() {
  const [tab, setTab] = useState<'insurance' | 'investigation' | 'charges' | 'fees'>('insurance');

  return (
    <div>
      <h2>Insurance, PMJAY, Investigation, Charge & Fee Masters</h2>
      <p className="text-muted" style={{ fontSize: 13 }}>
        These lists feed the dropdowns and payment gates used across the app hospital-wide.
      </p>
      <div className="seg" style={{ maxWidth: 520, marginBottom: 'var(--space-4)' }}>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'insurance'} onChange={() => setTab('insurance')} /> Insurance / PMJAY schemes
        </label>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'investigation'} onChange={() => setTab('investigation')} /> Investigation tests
        </label>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'charges'} onChange={() => setTab('charges')} /> Charge master
        </label>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'fees'} onChange={() => setTab('fees')} /> Consultation fees
        </label>
      </div>
      {tab === 'insurance' && <InsuranceMastersTab />}
      {tab === 'investigation' && <InvestigationMastersTab />}
      {tab === 'charges' && <ChargeMasterTab />}
      {tab === 'fees' && <ConsultationFeesTab />}
    </div>
  );
}