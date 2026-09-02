import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { renderCommunicationTemplate, type CommunicationContext } from '../lib/renderCommunicationTemplate';
import type { Patient } from '../lib/types';

interface Props {
  patient: Patient;
  context?: CommunicationContext;
  onClose: () => void;
}

// There's no SMS/WhatsApp/email gateway wired into this app (that's a real
// third-party integration — Twilio, Gupshup, etc. — not something to fake).
// So "sending" here means: render the template, hand the staff member a
// ready-to-use copy/WhatsApp-link/mailto action, and log that it went out —
// same as how many small clinics actually operate today, just without the
// manual retyping and with an audit trail behind it.
export function SendCommunicationPanel({ patient, context, onClose }: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState('');
  const [channel, setChannel] = useState('sms');
  const [recipient, setRecipient] = useState(patient.phone ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ['communication-templates-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('communication_templates').select('*').eq('active', true).order('channel').order('name');
      if (error) throw error;
      return data as { id: string; name: string; channel: string; subject: string | null; body: string }[];
    },
  });

  const { data: recentLog } = useQuery({
    queryKey: ['communication-log', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('communication_log').select('*').eq('patient_id', patient.id).order('sent_at', { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });

  const ctx: CommunicationContext = { patient_name: patient.full_name, ...context };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates?.find((x) => x.id === id);
    if (!t) return;
    setChannel(t.channel);
    setSubject(t.subject ? renderCommunicationTemplate(t.subject, ctx) : '');
    setBody(renderCommunicationTemplate(t.body, ctx));
    setRecipient(t.channel === 'email' ? (patient.email ?? '') : (patient.phone ?? ''));
    setLogged(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(body);
  };

  const waLink = () => {
    const digits = recipient.replace(/[^\d]/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
  };
  const smsLink = () => `sms:${recipient}?body=${encodeURIComponent(body)}`;
  const mailLink = () => `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const markSent = async () => {
    if (!body.trim() || !recipient.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('communication_log').insert({
      patient_id: patient.id,
      template_id: templateId || null,
      channel,
      recipient,
      subject: subject || null,
      body,
      sent_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setLogged(true);
    qc.invalidateQueries({ queryKey: ['communication-log', patient.id] });
  };

  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Send message to patient</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>
        No SMS/WhatsApp/email gateway is connected — this composes the message and gives you a one-tap way to send it from your own phone/email, and logs that it was sent.
      </p>
      {patient.communication_opt_out && (
        <div style={{ background: '#fdf3d8', border: '1px solid #e0c060', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', fontSize: 12, marginBottom: 'var(--space-3)' }}>
          This patient has opted out of communications — check with them before sending.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Template</label>
          <select className="input" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Write custom message —</option>
            {templates?.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Channel</label>
          <select className="input" value={channel} onChange={(e) => { setChannel(e.target.value); setRecipient(e.target.value === 'email' ? (patient.email ?? '') : (patient.phone ?? '')); setLogged(false); }}>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>{channel === 'email' ? 'Email address' : 'Phone number'}</label>
          <input className="input" value={recipient} onChange={(e) => { setRecipient(e.target.value); setLogged(false); }} />
        </div>
        {channel === 'email' && (
          <div className="field" style={{ flex: '1 1 100%' }}>
            <label>Subject</label>
            <input className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setLogged(false); }} />
          </div>
        )}
        <div className="field" style={{ flex: '1 1 100%' }}>
          <label>Message</label>
          <textarea className="input" rows={4} value={body} onChange={(e) => { setBody(e.target.value); setLogged(false); }} />
        </div>
      </div>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      {logged && <div style={{ color: '#2c7a4b', fontSize: 13, marginTop: 'var(--space-2)' }}>Logged as sent.</div>}

      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" type="button" onClick={copyToClipboard} disabled={!body.trim()}>Copy message</button>
        {channel === 'whatsapp' && <a className="btn btn-secondary" href={waLink()} target="_blank" rel="noreferrer" aria-disabled={!recipient.trim() || !body.trim()}>Open WhatsApp</a>}
        {channel === 'sms' && <a className="btn btn-secondary" href={smsLink()}>Open SMS app</a>}
        {channel === 'email' && <a className="btn btn-secondary" href={mailLink()}>Open email</a>}
        <button className="btn btn-primary" type="button" onClick={markSent} disabled={saving || !body.trim() || !recipient.trim()}>{saving ? 'Logging…' : 'Mark as sent'}</button>
        <button className="btn btn-ghost" type="button" onClick={onClose}>Close</button>
      </div>

      {recentLog && recentLog.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <strong style={{ fontSize: 13 }}>Recent messages to this patient</strong>
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>When</th><th>Channel</th><th>To</th><th>Message</th></tr></thead>
            <tbody>
              {recentLog.map((l: any) => (
                <tr key={l.id}>
                  <td>{new Date(l.sent_at).toLocaleString()}</td>
                  <td className="text-muted">{l.channel}</td>
                  <td>{l.recipient}</td>
                  <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{l.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
