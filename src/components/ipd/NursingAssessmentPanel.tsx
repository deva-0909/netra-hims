import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const FALL_RISK_STYLE: Record<string, React.CSSProperties> = {
  low: {}, moderate: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  high: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
};

/** Fall risk, pain score and fluid intake/output — ward_vitals only ever
 * captured BP/pulse/temp/SpO2, and the free-text nursing note (see
 * ProgressNotesPanel) has no structured field for any of these. */
export function NursingAssessmentPanel({ admissionId, canManage }: { admissionId: string; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fall_risk: 'low', pain_score: '', intake_ml: '', output_ml: '', mobility_status: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { data: assessments } = useQuery({
    queryKey: ['nursing-assessments', admissionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('nursing_assessments').select('*, profiles(full_name)').eq('admission_id', admissionId).order('recorded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('nursing_assessments').insert({
      admission_id: admissionId, fall_risk: form.fall_risk,
      pain_score: form.pain_score ? Number(form.pain_score) : null,
      intake_ml: form.intake_ml ? Number(form.intake_ml) : null,
      output_ml: form.output_ml ? Number(form.output_ml) : null,
      mobility_status: form.mobility_status || null, notes: form.notes || null, recorded_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm({ fall_risk: 'low', pain_score: '', intake_ml: '', output_ml: '', mobility_status: '', notes: '' });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['nursing-assessments', admissionId] });
  };

  const totalIntake = (assessments ?? []).reduce((s: number, a: any) => s + (Number(a.intake_ml) || 0), 0);
  const totalOutput = (assessments ?? []).reduce((s: number, a: any) => s + (Number(a.output_ml) || 0), 0);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Nursing Assessment</strong>
        {canManage && !showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>+ Assessment</button>}
      </div>
      {showForm && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, padding: 8, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 1 130px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Fall risk</label>
            <select className="input" value={form.fall_risk} onChange={(e) => set('fall_risk', e.target.value)}>
              <option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option>
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 100px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Pain (0-10)</label><input className="input" type="number" min={0} max={10} value={form.pain_score} onChange={(e) => set('pain_score', e.target.value)} /></div>
          <div className="field" style={{ flex: '0 1 100px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Intake (mL)</label><input className="input" type="number" value={form.intake_ml} onChange={(e) => set('intake_ml', e.target.value)} /></div>
          <div className="field" style={{ flex: '0 1 100px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Output (mL)</label><input className="input" type="number" value={form.output_ml} onChange={(e) => set('output_ml', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Mobility</label><input className="input" value={form.mobility_status} onChange={(e) => set('mobility_status', e.target.value)} placeholder="e.g. ambulatory, bed rest" /></div>
          <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Notes</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
        </div>
      )}
      {assessments && assessments.length > 0 && (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>Fluid balance so far: {totalIntake}mL in / {totalOutput}mL out ({totalIntake - totalOutput >= 0 ? '+' : ''}{totalIntake - totalOutput}mL)</p>
      )}
      {assessments && assessments.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          {assessments.map((a: any) => (
            <div key={a.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <div className="text-muted" style={{ fontSize: 11 }}>{new Date(a.recorded_at).toLocaleString()} — {a.profiles?.full_name ?? '—'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {a.fall_risk && <span className="tag tag-outline" style={FALL_RISK_STYLE[a.fall_risk]}>Fall risk: {a.fall_risk}</span>}
                {a.pain_score != null && <span>Pain: {a.pain_score}/10</span>}
                {(a.intake_ml != null || a.output_ml != null) && <span>I/O: {a.intake_ml ?? 0}mL / {a.output_ml ?? 0}mL</span>}
                {a.mobility_status && <span className="text-muted">{a.mobility_status}</span>}
              </div>
              {a.notes && <div className="text-muted">{a.notes}</div>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No nursing assessments recorded yet.</p>
      )}
    </div>
  );
}
