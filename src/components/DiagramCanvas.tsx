import { useEffect, useRef, useState } from 'react';

export type DiagramType = 'fundus' | 'anterior_segment' | 'optic_disc' | 'ocular_motility';

const CANVAS_SIZE = 420;
const COLORS = [
  { name: 'Red', value: '#c0392b' },
  { name: 'Blue', value: '#2980b9' },
  { name: 'Black', value: '#1a1a1a' },
  { name: 'Green', value: '#27ae60' },
];

/** Draws the static reference template for a diagram type — these are
 * simplified but recognizable versions of the standard charting diagrams
 * used in ophthalmology (a clock-hour fundus circle, a disc/cup pair, a
 * limbus outline, and the 9 cardinal gaze positions) so the doctor is
 * marking findings onto something structured rather than a blank page. */
function drawTemplate(ctx: CanvasRenderingContext2D, type: DiagramType) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.strokeStyle = '#b8c2cc';
  ctx.fillStyle = '#8a97a3';
  ctx.lineWidth = 1.2;
  ctx.font = '12px Calibri, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;

  if (type === 'fundus') {
    const r = 170;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // clock-hour ticks + numbers
    for (let h = 1; h <= 12; h++) {
      const angle = (h / 12) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(angle) * (r - 8), y1 = cy + Math.sin(angle) * (r - 8);
      const x2 = cx + Math.cos(angle) * r, y2 = cy + Math.sin(angle) * r;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const lx = cx + Math.cos(angle) * (r + 14), ly = cy + Math.sin(angle) * (r + 14);
      ctx.fillText(String(h), lx, ly);
    }
    // optic disc (nasal) + macula (central) reference points
    ctx.beginPath(); ctx.arc(cx - 55, cy, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillText('Disc', cx - 55, cy + 26);
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillText('Macula', cx, cy + 20);
  }

  if (type === 'optic_disc') {
    ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 55, 0, Math.PI * 2); ctx.stroke();
    ctx.fillText('Disc margin', cx, cy - 145);
    ctx.fillText('Cup', cx, cy - 65);
    // quadrant lines for rim assessment
    ctx.beginPath(); ctx.moveTo(cx - 130, cy); ctx.lineTo(cx + 130, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 130); ctx.lineTo(cx, cy + 130); ctx.stroke();
  }

  if (type === 'anterior_segment') {
    // limbus circle
    ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.stroke();
    // eyelid curves
    ctx.beginPath(); ctx.moveTo(cx - 190, cy); ctx.quadraticCurveTo(cx, cy - 190, cx + 190, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 190, cy); ctx.quadraticCurveTo(cx, cy + 190, cx + 190, cy); ctx.stroke();
    // pupil reference
    ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.fillText('Limbus', cx, cy - 132);
    ctx.fillText('Pupil', cx, cy + 4);
  }

  if (type === 'ocular_motility') {
    const positions = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [0, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1],
    ];
    const spacing = 110;
    positions.forEach(([dx, dy]) => {
      const x = cx + dx * spacing, y = cy + dy * spacing;
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.fillText('9 cardinal gaze positions — mark limitation at each', cx, cy - spacing - 45);
  }
}

/** Draws an uploaded photo (fundus camera, slit lamp, OCT printout) as the
 * base to annotate on top of, letterboxed to fit the square canvas — this is
 * the same drawing surface as the template, just with a real image behind
 * the doctor's markings instead of a generic reference diagram. */
function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (CANVAS_SIZE - w) / 2, (CANVAS_SIZE - h) / 2, w, h);
}

interface Props {
  diagramType: DiagramType;
  onSave: (dataUrl: string) => void;
  saving?: boolean;
}

export function DiagramCanvas({ diagramType, onSave, saving }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const [color, setColor] = useState(COLORS[0].value);
  const [lineWidth, setLineWidth] = useState(2.5);
  const [mode, setMode] = useState<'template' | 'photo'>('template');

  const redrawBase = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    if (mode === 'photo' && photoRef.current) drawPhoto(ctx, photoRef.current);
    else drawTemplate(ctx, diagramType);
  };

  useEffect(() => {
    photoRef.current = null;
    setMode('template');
  }, [diagramType]);

  useEffect(() => {
    redrawBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramType, mode]);

  const handlePhotoChosen = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        photoRef.current = img;
        setMode('photo');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : e;
    return { x: (point.clientX - rect.left) * (CANVAS_SIZE / rect.width), y: (point.clientY - rect.top) * (CANVAS_SIZE / rect.height) };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => { drawing.current = false; };

  const clearAnnotations = () => redrawBase();

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoChosen(file);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
          Upload photo…
        </button>
        {mode === 'photo' && (
          <button type="button" className="btn btn-ghost" onClick={() => setMode('template')}>
            Use blank template instead
          </button>
        )}
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setColor(c.value)}
            title={c.name}
            style={{
              width: 26, height: 26, borderRadius: '50%', background: c.value, cursor: 'pointer',
              border: color === c.value ? '3px solid var(--color-accent)' : '1px solid var(--color-divider)',
            }}
          />
        ))}
        <select className="input" style={{ width: 110 }} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))}>
          <option value={1.5}>Fine</option>
          <option value={2.5}>Medium</option>
          <option value={4}>Thick</option>
        </select>
        <button type="button" className="btn btn-ghost" onClick={clearAnnotations}>Clear markings</button>
      </div>
      {mode === 'photo' && (
        <p className="text-muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 8 }}>
          Annotating on the uploaded photo — mark findings directly on the real image below.
        </p>
      )}

      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', touchAction: 'none', maxWidth: '100%', cursor: 'crosshair' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      <div style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save diagram to visit'}
        </button>
      </div>
    </div>
  );
}
