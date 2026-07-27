import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { FileUploadField } from '../components/FileUploadField';

function NewDonorForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ donor_name: '', age: '', gender: '', cause_of_death: '', date_of_death: '', next_of_kin_name: '', next_of_kin_contact: '' });
  const [consentObtained, setConsentObtained] = useState(false);
  const [consentDocUrl, setConsentDocUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.donor_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('eye_bank_donors').insert({
      donor_name: form.donor_name,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      cause_of_death: form.cause_of_death || null,
      date_of_death: form.date_of_death || null,
      next_of_kin_name: form.next_of_kin_name || null,
      next_of_kin_contact: form.next_of_kin_contact || null,
      consent_obtained: consentObtained,
      consent_document_url: consentDocUrl,
      registered_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-donors'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Register donor</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Donor name *</label><input className="input" value={form.donor_name} onChange={(e) => set('donor_name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 100px' }}><label>Age</label><input className="input" type="number" value={form.age} onChange={(e) => set('age', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Gender</label>
          <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Cause of death</label><input className="input" value={form.cause_of_death} onChange={(e) => set('cause_of_death', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Date of death</label><input className="input" type="datetime-local" value={form.date_of_death} onChange={(e) => set('date_of_death', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Next of kin name</label><input className="input" value={form.next_of_kin_name} onChange={(e) => set('next_of_kin_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Next of kin contact</label><input className="input" value={form.next_of_kin_contact} onChange={(e) => set('next_of_kin_contact', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
        <label className="radio">
          <input type="checkbox" checked={consentObtained} onChange={(e) => setConsentObtained(e.target.checked)} />
          <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} /> Consent obtained from next of kin
        </label>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Signed consent document</label>
          <FileUploadField value={consentDocUrl} onChange={setConsentDocUrl} folder="eye_bank" />
        </div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving\u2026' : 'Register donor'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function EyeBankDonorsPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: donors, isLoading } = useQuery({
    queryKey: ['eye-bank-donors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_donors').select('*, eye_bank_tissues(id)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Eye Bank — Donors</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Register donor</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>Donor identity and consent records. Tissue harvesting, serology, and allocation are tracked separately under Eye Bank — Tissues.</p>

      {showForm && <NewDonorForm onDone={() => setShowForm(false)} />}

      {isLoading ? <p className="text-muted">Loading\u2026</p> : (
        <table className="table">
          <thead><tr><th>Donor</th><th>Age / Gender</th><th>Cause of Death</th><th>Consent</th><th>Tissues Logged</th></tr></thead>
          <tbody>
            {donors?.map((d: any) => (
              <tr key={d.id}>
                <td>{d.donor_name}</td>
                <td>{d.age ?? '\u2014'} / {d.gender ?? '\u2014'}</td>
                <td className="text-muted">{d.cause_of_death ?? '\u2014'}</td>
                <td><span className={`tag ${d.consent_obtained ? 'tag-accent' : 'tag-outline'}`}>{d.consent_obtained ? 'Obtained' : 'Pending'}</span></td>
                <td>{d.eye_bank_tissues?.length ?? 0}</td>
              </tr>
            ))}
            {donors?.length === 0 && <tr><td colSpan={5} className="text-muted">No donors registered yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
