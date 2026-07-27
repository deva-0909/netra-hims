import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const PRESERVATION_METHODS = ['mccarey_kaufman', 'optisol_gs', 'cryopreservation', 'other'];
const SEROLOGY_STATUSES = ['pending', 'non_reactive', 'reactive'];
const STATUSES = ['available', 'allocated', 'used', 'discarded', 'expired'];

function genTissueNumber() {
  return `EB-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function NewTissueForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [donorId, setDonorId] = useState('');
  const [form, setForm] = useState({ eye: 'od', retrieval_datetime: '', preservation_method: 'optisol_gs', tissue_quality_grade: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: donors } = useQuery({
    queryKey: ['eye-bank-donors-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_donors').select('id, donor_name').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorId) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('eye_bank_tissues').insert({
      donor_id: donorId,
      tissue_number: genTissueNumber(),
      eye: form.eye,
      retrieval_datetime: form.retrieval_datetime || null,
      retrieved_by: profile?.id,
      preservation_method: form.preservation_method,
      tissue_quality_grade: form.tissue_quality_grade || null,
      expiry_date: form.expiry_date || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log harvested tissue</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Donor *</label>
          <select className="input" value={donorId} onChange={(e) => setDonorId(e.target.value)} required>
            <option value="">— select donor —</option>
            {donors?.map((d: any) => <option key={d.id} value={d.id}>{d.donor_name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label>Eye</label>
          <select className="input" value={form.eye} onChange={(e) => set('eye', e.target.value)}>
            <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Retrieval date/time</label><input className="input" type="datetime-local" value={form.retrieval_datetime} onChange={(e) => set('retrieval_datetime', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Preservation method</label>
          <select className="input" value={form.preservation_method} onChange={(e) => set('preservation_method', e.target.value)}>
            {PRESERVATION_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Tissue quality grade</label><input className="input" value={form.tissue_quality_grade} onChange={(e) => set('tissue_quality_grade', e.target.value)} placeholder="e.g. ECD 2400/mm²" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Expiry date</label><input className="input" type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log tissue'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function TissueRow({ tissue }: { tissue: any }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const expiryDays = tissue.expiry_date ? daysUntil(tissue.expiry_date) : null;
  const expiringSoon = expiryDays !== null && expiryDays <= 3;

  const updateField = async (field: string, value: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('eye_bank_tissues').update({ [field]: value }).eq('id', tissue.id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
  };

  return (
    <tr>
      <td>{tissue.tissue_number}</td>
      <td>{tissue.eye_bank_donors?.donor_name}</td>
      <td>{tissue.eye.toUpperCase()}</td>
      <td>
        <select className="input" value={tissue.serology_hiv} onChange={(e) => updateField('serology_hiv', e.target.value)} style={{ width: 120 }}>
          {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HIV: {s.replace(/_/g, ' ')}</option>)}
        </select>
      </td>
      <td>
        <select className="input" value={tissue.serology_hbsag} onChange={(e) => updateField('serology_hbsag', e.target.value)} style={{ width: 130 }}>
          {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HBsAg: {s.replace(/_/g, ' ')}</option>)}
        </select>
      </td>
      <td>
        <select className="input" value={tissue.serology_hcv} onChange={(e) => updateField('serology_hcv', e.target.value)} style={{ width: 120 }}>
          {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HCV: {s.replace(/_/g, ' ')}</option>)}
        </select>
      </td>
      <td>
        {tissue.expiry_date ? (
          <span className={expiringSoon ? 'tag tag-outline' : ''} style={expiringSoon ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : undefined}>
            {new Date(tissue.expiry_date).toLocaleDateString()} {expiringSoon ? `(${expiryDays}d)` : ''}
          </span>
        ) : '—'}
      </td>
      <td>
        <select className="input" value={tissue.status} onChange={(e) => updateField('status', e.target.value)} style={{ width: 130 }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      {error && <td style={{ color: '#b64545', fontSize: 11 }}>{error}</td>}
    </tr>
  );
}

export function EyeBankTissuesPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: tissues, isLoading } = useQuery({
    queryKey: ['eye-bank-tissues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_tissues').select('*, eye_bank_donors(donor_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const expiringSoonCount = (tissues ?? []).filter((t: any) => t.expiry_date && t.status === 'available' && daysUntil(t.expiry_date) <= 3).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Eye Bank — Tissues</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log tissue</button>}
      </div>
      {expiringSoonCount > 0 && (
        <div className="card" style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-4)', background: '#f6dede' }}>
          <span style={{ color: '#8a2c2c', fontSize: 13 }}>{expiringSoonCount} tissue(s) expiring within 3 days and still marked available.</span>
        </div>
      )}

      {showForm && <NewTissueForm onDone={() => setShowForm(false)} />}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Tissue #</th><th>Donor</th><th>Eye</th><th>HIV</th><th>HBsAg</th><th>HCV</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            {tissues?.map((t: any) => <TissueRow key={t.id} tissue={t} />)}
            {tissues?.length === 0 && <tr><td colSpan={8} className="text-muted">No tissue records yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
