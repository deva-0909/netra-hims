import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const CHANNELS = ['sms', 'whatsapp', 'email'];

export function AdminCommunicationTemplatesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'sms', subject: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['communication-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('communication_templates').select('*').order('channel').order('name');
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('communication_templates').insert({
      name: form.name, channel: form.channel, subject: form.subject || null, body: form.body, updated_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm({ name: '', channel: 'sms', subject: '', body: '' });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['communication-templates'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('communication_templates').update({ active: !active, updated_by: profile?.id }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['communication-templates'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>SMS, WhatsApp & Email Templates</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New template</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Manages template text only. Actually sending messages requires connecting a real SMS/WhatsApp/email provider (e.g. Twilio, Gupshup), which is a separate integration.
      </p>

      {showForm && (
        <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', maxWidth: 560 }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: '1 1 200px' }}><label>Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Channel</label>
              <select className="input" value={form.channel} onChange={(e) => set('channel', e.target.value)}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {form.channel === 'email' && <div className="field" style={{ flex: '1 1 100%' }}><label>Subject</label><input className="input" value={form.subject} onChange={(e) => set('subject', e.target.value)} /></div>}
            <div className="field" style={{ flex: '1 1 100%' }}>
              <label>Body (use {'{patient_name}'}, {'{appointment_date}'}, {'{token_number}'}, {'{bill_number}'}, {'{total_amount}'} as placeholders)</label>
              <textarea className="input" value={form.body} onChange={(e) => set('body', e.target.value)} rows={4} />
            </div>
          </div>
          {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 8 }}>{error}</div>}
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {templates?.map((t: any) => (
        <div key={t.id} className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{t.name} <span className="tag tag-neutral" style={{ marginLeft: 6 }}>{t.channel}</span></strong>
            <button className={`btn ${t.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(t.id, t.active)}>{t.active ? 'Active' : 'Inactive'}</button>
          </div>
          {t.subject && <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>Subject: {t.subject}</div>}
          <p style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{t.body}</p>
        </div>
      ))}
    </div>
  );
}