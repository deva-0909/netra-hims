import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { FileUploadField } from '../FileUploadField';
import { buildSurgicalConsentText } from '../../lib/surgicalConsentText';

export function SurgicalConsentPanel({ otRecordId, procedureName, eye, surgeonName, canManage }: { otRecordId: string; procedureName: string; eye: string; surgeonName: string | null; canManage: boolean }) {
  const qc = useQueryClient();
  const [showText, setShowText] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: consent } = useQuery({
    queryKey: ['surgical-consent', otRecordId],
    queryFn: async () => {
      const { data, error } = await supabase.from('surgical_consents').select('*').eq('ot_record_id', otRecordId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const generate = async () => {
    setGenerating(true);
    setError(null);
    const { error: insertError } = await supabase.from('surgical_consents').insert({
      ot_record_id: otRecordId,
      consent_text: buildSurgicalConsentText(procedureName, eye, surgeonName),
    });
    setGenerating(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['surgical-consent', otRecordId] });
  };

  const toggleSigned = async () => {
    if (!consent) return;
    await supabase.from('surgical_consents').update({ consent_signed: !consent.consent_signed }).eq('id', consent.id);
    qc.invalidateQueries({ queryKey: ['surgical-consent', otRecordId] });
  };

  const saveFile = async (url: string | null) => {
    if (!consent) return;
    await supabase.from('surgical_consents').update({ consent_file_url: url }).eq('id', consent.id);
    qc.invalidateQueries({ queryKey: ['surgical-consent', otRecordId] });
  };

  if (!consent) {
    return (
      <div style={{ marginTop: 6 }}>
        <span className="tag tag-outline" style={{ background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' }}>surgical consent not generated</span>
        {canManage && <button className="btn btn-ghost" style={{ marginLeft: 6, padding: '1px 6px', fontSize: 11 }} onClick={generate} disabled={generating}>{generating ? 'Generating…' : 'Generate consent'}</button>}
        {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className={`tag ${consent.consent_signed ? 'tag-accent' : 'tag-outline'}`}>surgical consent {consent.consent_signed ? 'signed' : 'pending'}</span>
        <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setShowText((s) => !s)}>{showText ? 'Hide text' : 'View text'}</button>
        {consent.consent_file_url && <a href={consent.consent_file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>View document</a>}
        {canManage && <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={toggleSigned}>{consent.consent_signed ? 'Mark pending' : 'Mark signed'}</button>}
      </div>
      {showText && <div className="text-muted" style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 6, maxWidth: 520 }}>{consent.consent_text}</div>}
      {canManage && (
        <div style={{ marginTop: 6, maxWidth: 260 }}>
          <FileUploadField value={consent.consent_file_url} onChange={saveFile} folder="surgical_consents" />
        </div>
      )}
    </div>
  );
}
