import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { DiagramCanvas, type DiagramType } from '../../components/DiagramCanvas';

const DIAGRAM_TYPES: { value: DiagramType; label: string }[] = [
  { value: 'fundus', label: 'Fundus (clock-hour)' },
  { value: 'optic_disc', label: 'Optic Disc & Cup' },
  { value: 'anterior_segment', label: 'Anterior Segment' },
  { value: 'ocular_motility', label: 'Ocular Motility (9 gaze positions)' },
];

async function dataUrlToStorageUrl(dataUrl: string, folder: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${folder}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from('attachments').upload(path, blob, { contentType: 'image/png' });
  if (error) throw error;
  const { data } = supabase.storage.from('attachments').getPublicUrl(path);
  return data.publicUrl;
}

export function DiagramStage({ visitId, patientId }: { visitId: string; patientId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [diagramType, setDiagramType] = useState<DiagramType>('fundus');
  const [eye, setEye] = useState('od');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every diagram of this type/eye for the patient, across all their visits —
  // this is what powers the "compare with prior" view.
  const { data: patientDiagrams } = useQuery({
    queryKey: ['clinical-diagrams-patient', patientId, diagramType, eye],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinical_diagrams')
        .select('*, visits(created_at, clinic_module)')
        .eq('patient_id', patientId)
        .eq('diagram_type', diagramType)
        .eq('eye', eye)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: visitDiagrams } = useQuery({
    queryKey: ['clinical-diagrams-visit', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clinical_diagrams').select('*').eq('visit_id', visitId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const priorDiagram = patientDiagrams?.find((d: any) => d.visit_id !== visitId);
  const currentForThisType = patientDiagrams?.find((d: any) => d.visit_id === visitId);

  const handleSave = async (dataUrl: string) => {
    setSaving(true);
    setError(null);
    try {
      const url = await dataUrlToStorageUrl(dataUrl, 'clinical_diagrams');
      const { error: insertError } = await supabase.from('clinical_diagrams').insert({
        visit_id: visitId,
        patient_id: patientId,
        diagram_type: diagramType,
        eye,
        image_url: url,
        notes: notes || null,
        created_by: profile?.id,
      });
      if (insertError) throw insertError;
      setNotes('');
      qc.invalidateQueries({ queryKey: ['clinical-diagrams-patient', patientId, diagramType, eye] });
      qc.invalidateQueries({ queryKey: ['clinical-diagrams-visit', visitId] });
    } catch (e: any) {
      setError(e.message ?? 'Could not save diagram.');
    }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>Mark a new diagram</h4>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label>Diagram type</label>
            <select className="input" value={diagramType} onChange={(e) => setDiagramType(e.target.value as DiagramType)}>
              {DIAGRAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 140px' }}>
            <label>Eye</label>
            <select className="input" value={eye} onChange={(e) => setEye(e.target.value)}>
              <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
            </select>
          </div>
        </div>

        {priorDiagram && (
          <div className="card" style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-3)', background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', fontSize: 13 }}>
            A prior {DIAGRAM_TYPES.find((t) => t.value === diagramType)?.label} ({eye.toUpperCase()}) diagram exists from {new Date(priorDiagram.visits?.created_at ?? priorDiagram.created_at).toLocaleDateString()} — saving a new one here lets you compare progression below.
          </div>
        )}

        <DiagramCanvas diagramType={diagramType} onSave={handleSave} saving={saving} />

        <div className="field" style={{ marginTop: 'var(--space-3)', maxWidth: 500 }}>
          <label>Notes (optional)</label>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brief description of what was marked" />
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>

      {(currentForThisType || priorDiagram) && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>Compare with prior visit</h4>
          {currentForThisType && priorDiagram ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Prior — {new Date(priorDiagram.visits?.created_at ?? priorDiagram.created_at).toLocaleDateString()}</div>
                <img src={priorDiagram.image_url} alt="Prior diagram" style={{ width: '100%', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)' }} />
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Current — today</div>
                <img src={currentForThisType.image_url} alt="Current diagram" style={{ width: '100%', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)' }} />
              </div>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: 13 }}>
              {currentForThisType ? 'Saved for this visit — no prior diagram of this type/eye to compare against yet.' : 'A prior diagram exists, but nothing has been saved for this visit yet — save one above to compare.'}
            </p>
          )}
        </div>
      )}

      <div>
        <h4>All diagrams on this visit</h4>
        {visitDiagrams?.length ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {visitDiagrams.map((d: any) => (
              <div key={d.id} className="card" style={{ padding: 'var(--space-2)', width: 160 }}>
                <img src={d.image_url} alt={d.diagram_type} style={{ width: '100%', borderRadius: 4 }} />
                <div style={{ fontSize: 11, marginTop: 4 }}>{DIAGRAM_TYPES.find((t) => t.value === d.diagram_type)?.label} — {d.eye.toUpperCase()}</div>
                {d.notes && <div className="text-muted" style={{ fontSize: 10 }}>{d.notes}</div>}
              </div>
            ))}
          </div>
        ) : <p className="text-muted">No diagrams saved for this visit yet.</p>}
      </div>
    </div>
  );
}
