import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const ASA_GRADES = ['I', 'II', 'III', 'IV', 'V'];
const FITNESS_STATUSES = ['pending', 'fit', 'fit_with_precautions', 'not_fit'] as const;
const FITNESS_LABEL: Record<string, string> = { pending: 'Pending', fit: 'Fit', fit_with_precautions: 'Fit with precautions', not_fit: 'Not fit' };
const FITNESS_STYLE: Record<string, React.CSSProperties> = {
  pending: {}, fit: { background: '#e2f2e5', color: '#2c6b3d', borderColor: '#a3d4ae' },
  fit_with_precautions: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  not_fit: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
};
const ANAESTHESIA_TYPES = ['topical', 'local', 'peribulbar', 'retrobulbar', 'sedation', 'general'];

/** ASA grade, fitness-for-surgery, comorbidities, NPO status and planned
 * anaesthesia type/notes — nothing on ot_records captured any of this
 * before. One row per OT case (ot_record_id is unique). Deliberately not a
 * hard gate on Start — the WHO Safety Checklist Sign-In already confirms
 * consent/identity/site before anaesthesia; this is structured capture,
 * not an additional blocking workflow. */
export function PreOpAssessmentPanel({ otRecordId, canManage }: { otRecordId: string; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    asa_grade: '', fitness_status: 'pending', comorbidities: '', npo_confirmed: false,
    anaesthesia_type: '', anaesthesia_notes: '',
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const { data: assessment } = useQuery({
    queryKey: ['pre-op-assessment', otRecordId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pre_op_assessments').select('*, profiles(full_name)').eq('ot_record_id', otRecordId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const startEdit = () => {
    setForm({
      asa_grade: assessment?.asa_grade ?? '', fitness_status: assessment?.fitness_status ?? 'pending',
      comorbidities: assessment?.comorbidities ?? '', npo_confirmed: assessment?.npo_confirmed ?? false,
      anaesthesia_type: assessment?.anaesthesia_type ?? '', anaesthesia_notes: assessment?.anaesthesia_notes ?? '',
    });
    setEditing(true);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const wasCleared = assessment?.fitness_status === 'fit' || assessment?.fitness_status === 'fit_with_precautions';
    const nowCleared = form.fitness_status === 'fit' || form.fitness_status === 'fit_with_precautions';
    const payload: Record<string, any> = {
      ot_record_id: otRecordId, asa_grade: form.asa_grade || null, fitness_status: form.fitness_status,
      comorbidities: form.comorbidities || null, npo_confirmed: form.npo_confirmed,
      anaesthesia_type: form.anaesthesia_type || null, anaesthesia_notes: form.anaesthesia_notes || null,
    };
    if (nowCleared && !wasCleared) { payload.cleared_by = profile?.id; payload.cleared_at = new Date().toISOString(); }
    else if (!nowCleared) { payload.cleared_by = null; payload.cleared_at = null; }
    const { error: upsertError } = await supabase.from('pre_op_assessments').upsert(payload, { onConflict: 'ot_record_id' });
    setSaving(false);
    if (upsertError) { setError(upsertError.message); return; }
    setEditing(false);
    qc.invalidateQueries({ queryKey: ['pre-op-assessment', otRecordId] });
  };

  return (
    <div style={{ marginTop: 8, padding: 8, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Pre-op Assessment & Anaesthesia Fitness</strong>
        {canManage && !editing && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={startEdit}>{assessment ? 'Edit' : '+ Assess'}</button>}
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 1 90px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>ASA grade</label>
            <select className="input" value={form.asa_grade} onChange={(e) => set('asa_grade', e.target.value)}>
              <option value="">—</option>
              {ASA_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 180px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Fitness status</label>
            <select className="input" value={form.fitness_status} onChange={(e) => set('fitness_status', e.target.value)}>
              {FITNESS_STATUSES.map((s) => <option key={s} value={s}>{FITNESS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 160px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Anaesthesia type</label>
            <select className="input" value={form.anaesthesia_type} onChange={(e) => set('anaesthesia_type', e.target.value)}>
              <option value="">—</option>
              {ANAESTHESIA_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={form.npo_confirmed} onChange={(e) => set('npo_confirmed', e.target.checked)} />
            NPO confirmed
          </label>
          <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Comorbidities</label>
            <input className="input" value={form.comorbidities} onChange={(e) => set('comorbidities', e.target.value)} placeholder="e.g. diabetes, hypertension" />
          </div>
          <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Anaesthesia notes</label>
            <input className="input" value={form.anaesthesia_notes} onChange={(e) => set('anaesthesia_notes', e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
        </div>
      ) : assessment ? (
        <div style={{ marginTop: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {assessment.asa_grade && <span>ASA {assessment.asa_grade}</span>}
            <span className="tag tag-outline" style={FITNESS_STYLE[assessment.fitness_status]}>{FITNESS_LABEL[assessment.fitness_status]}</span>
            {assessment.anaesthesia_type && <span className="text-muted">{assessment.anaesthesia_type.replace(/_/g, ' ')}</span>}
            {assessment.npo_confirmed && <span className="tag tag-outline" style={{ fontSize: 10 }}>NPO confirmed</span>}
          </div>
          {assessment.comorbidities && <div className="text-muted" style={{ marginTop: 2 }}>Comorbidities: {assessment.comorbidities}</div>}
          {assessment.anaesthesia_notes && <div className="text-muted" style={{ marginTop: 2 }}>{assessment.anaesthesia_notes}</div>}
          {assessment.cleared_at && (
            <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
              Cleared by {assessment.profiles?.full_name ?? '—'} on {new Date(assessment.cleared_at).toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No pre-op assessment recorded yet.</p>
      )}
    </div>
  );
}
