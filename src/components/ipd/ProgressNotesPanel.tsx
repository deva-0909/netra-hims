import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

/** A doctor's daily ward-round note — the actual clinical decision-making
 * during a multi-day stay. ward_vitals only ever captured nursing vitals;
 * this was the biggest missing "paper replacement" piece in the ward. */
export function ProgressNotesPanel({ admissionId, isDoctor }: { admissionId: string; isDoctor: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [plan, setPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: notes } = useQuery({
    queryKey: ['ipd-progress-notes', admissionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ipd_progress_notes').select('*, profiles(full_name)').eq('admission_id', admissionId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!clinicalNotes.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ipd_progress_notes').insert({
      admission_id: admissionId, clinical_notes: clinicalNotes, plan: plan || null, doctor_id: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setClinicalNotes('');
    setPlan('');
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ipd-progress-notes', admissionId] });
  };

  return (
    <div style={{ marginTop: 8 }}>
      {isDoctor && !showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>+ Progress note</button>}
      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, padding: 8, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
          <textarea className="input" rows={2} placeholder="Clinical findings / assessment" value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          <textarea className="input" rows={2} placeholder="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
        </div>
      )}
      {notes && notes.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          {notes.map((n: any) => (
            <div key={n.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <div className="text-muted" style={{ fontSize: 11 }}>{new Date(n.created_at).toLocaleString()} — Dr. {n.profiles?.full_name ?? '—'}</div>
              <div>{n.clinical_notes}</div>
              {n.plan && <div className="text-muted">Plan: {n.plan}</div>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No progress notes yet.</p>
      )}
    </div>
  );
}
