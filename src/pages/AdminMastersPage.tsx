import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';
import { DrugPicker } from '../components/DrugPicker';

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

function DrugInteractionsTab() {
  const qc = useQueryClient();
  const [drugA, setDrugA] = useState<{ drugId: string | null; name: string }>({ drugId: null, name: '' });
  const [drugB, setDrugB] = useState<{ drugId: string | null; name: string }>({ drugId: null, name: '' });
  const [severity, setSeverity] = useState('moderate');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: interactions } = useQuery({
    queryKey: ['drug-interactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drug_interactions').select('*, drug_a:drug_a_id(name), drug_b:drug_b_id(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!drugA.drugId || !drugB.drugId) { setError('Pick both drugs from the catalog — free-text entries can\'t be matched at prescribing time.'); return; }
    if (drugA.drugId === drugB.drugId) { setError('Pick two different drugs.'); return; }
    setError(null);
    const { error: insertError } = await supabase.from('drug_interactions').insert({
      drug_a_id: drugA.drugId, drug_b_id: drugB.drugId, severity, description: description.trim() || null,
    });
    if (insertError) { setError(insertError.message); return; }
    setDrugA({ drugId: null, name: '' }); setDrugB({ drugId: null, name: '' }); setSeverity('moderate'); setDescription('');
    qc.invalidateQueries({ queryKey: ['drug-interactions'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('drug_interactions').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['drug-interactions'] });
  };

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13 }}>
        A curated list of clinically significant pairs — not a full national drug-interaction database. Shown as a warning (never a block) when both drugs appear in the same prescription.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <DrugPicker value={drugA} onChange={setDrugA} />
        <DrugPicker value={drugB} onChange={setDrugB} />
        <select className="input" style={{ width: 140 }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="moderate">Moderate</option><option value="severe">Severe</option>
        </select>
        <input className="input" style={{ flex: '1 1 220px' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
        <button className="btn btn-primary" onClick={add}>Add pair</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <table className="table">
        <thead><tr><th>Drug A</th><th>Drug B</th><th>Severity</th><th>Description</th><th>Status</th></tr></thead>
        <tbody>
          {interactions?.map((i: any) => (
            <tr key={i.id}>
              <td>{i.drug_a?.name ?? '—'}</td>
              <td>{i.drug_b?.name ?? '—'}</td>
              <td><span className={`tag ${i.severity === 'severe' ? 'tag-outline' : 'tag-outline'}`} style={i.severity === 'severe' ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' }}>{i.severity}</span></td>
              <td className="text-muted">{i.description ?? '—'}</td>
              <td><button className={`btn ${i.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(i.id, i.active)}>{i.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
          {interactions?.length === 0 && <tr><td colSpan={5} className="text-muted">No interaction pairs defined yet.</td></tr>}
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
  const [tab, setTab] = useState<'insurance' | 'investigation' | 'charges' | 'interactions' | 'fees'>('insurance');

  return (
    <div>
      <h2>Insurance, PMJAY, Investigation, Charge, Drug Interaction & Fee Masters</h2>
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
          <input type="radio" checked={tab === 'interactions'} onChange={() => setTab('interactions')} /> Drug interactions
        </label>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'fees'} onChange={() => setTab('fees')} /> Consultation fees
        </label>
      </div>
      {tab === 'insurance' && <InsuranceMastersTab />}
      {tab === 'investigation' && <InvestigationMastersTab />}
      {tab === 'charges' && <ChargeMasterTab />}
      {tab === 'interactions' && <DrugInteractionsTab />}
      {tab === 'fees' && <ConsultationFeesTab />}
    </div>
  );
}