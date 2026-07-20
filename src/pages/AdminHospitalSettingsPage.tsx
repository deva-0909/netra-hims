import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

export function AdminHospitalSettingsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ hospital_name: '', tagline: '', address: '', phone: '', email: '', working_hours: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['hospital-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        hospital_name: settings.hospital_name ?? '',
        tagline: settings.tagline ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        working_hours: settings.working_hours ?? '',
      });
    }
  }, [settings]);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSavedOk(false);
    const { error: updateError } = await supabase.from('hospital_settings').update({ ...form, updated_by: profile?.id }).eq('id', settings.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSavedOk(true);
    qc.invalidateQueries({ queryKey: ['hospital-settings'] });
  };

  if (!settings) return <p className="text-muted">Loadingâ€¦</p>;

  return (
    <div>
      <h2>Hospital Settings</h2>
      <form onSubmit={submit} className="card" style={{ padding: 'var(--space-4)', maxWidth: 640 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="field" style={{ flex: '1 1 260px' }}><label>Hospital name</label><input className="input" value={form.hospital_name} onChange={(e) => set('hospital_name', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 260px' }}><label>Tagline</label><input className="input" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 100%' }}><label>Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 200px' }}><label>Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 200px' }}><label>Email</label><input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 260px' }}><label>Working hours</label><input className="input" value={form.working_hours} onChange={(e) => set('working_hours', e.target.value)} placeholder="e.g. Monâ€“Sat, 9 AM â€“ 7 PM" /></div>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
        {savedOk && <div style={{ color: 'var(--color-accent-700)', fontSize: 13, marginTop: 'var(--space-2)' }}>Saved.</div>}
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 'var(--space-3)' }}>{saving ? 'Savingâ€¦' : 'Save settings'}</button>
      </form>
    </div>
  );
}