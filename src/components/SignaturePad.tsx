import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  value: string | null | undefined; // stores the public URL of the captured signature PNG
  onChange: (url: string | null) => void;
  folder: string;
  label?: string;
}

/** A captured signature — drawn with mouse/touch/stylus, not a checkbox — for
 * consents where "did this person actually sign" matters. Complements
 * FileUploadField's scanned-document upload rather than replacing it. */
export function SignaturePad({ value, onChange, folder, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes.current) return;
    setSaving(true);
    setError(null);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { setSaving(false); setError('Could not capture the signature.'); return; }
    const path = `${folder}/${crypto.randomUUID()}-signature.png`;
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, blob, { upsert: false, contentType: 'image/png' });
    setSaving(false);
    if (uploadError) { setError(uploadError.message); return; }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    onChange(data.publicUrl);
  };

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <img src={value} alt="Signature" style={{ height: 48, background: '#fff', border: '1px solid var(--color-divider)', borderRadius: 4 }} />
        <button type="button" className="btn btn-ghost" onClick={() => onChange(null)}>Re-capture signature</button>
      </div>
    );
  }

  return (
    <div>
      {label && <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</label>}
      <canvas
        ref={canvasRef}
        width={280}
        height={100}
        style={{ border: '1px dashed var(--color-divider)', borderRadius: 4, background: '#fff', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" onClick={clear}>Clear</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save signature'}</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
