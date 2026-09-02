import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

interface Point { date: string; od: number | null; os: number | null; }

const OD_COLOR = '#2e6b8a';
const OS_COLOR = '#b6622c';

/** Hand-rolled SVG line chart — no charting library. Points are spaced by
 * visit index, not by actual date distance, which is standard for clinical
 * trend charts (a two-year gap between visits shouldn't stretch the chart),
 * but does mean the x-axis isn't strictly to scale. */
function TrendChart({ title, unit, points, reverseYAxis }: { title: string; unit: string; points: Point[]; reverseYAxis?: boolean }) {
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 32, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = points.flatMap((p) => [p.od, p.os]).filter((v): v is number => v != null);
  if (values.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-3)' }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No data recorded yet.</p>
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const yFor = (v: number) => {
    const t = (v - min) / span;
    return reverseYAxis ? padding.top + t * plotH : padding.top + (1 - t) * plotH;
  };
  const xFor = (i: number) => (points.length <= 1 ? padding.left + plotW / 2 : padding.left + (i / (points.length - 1)) * plotW);

  const linePath = (key: 'od' | 'os') => {
    const coords = points.map((p, i) => (p[key] != null ? [xFor(i), yFor(p[key] as number)] : null)).filter((c): c is [number, number] => c != null);
    if (coords.length === 0) return '';
    return coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  };

  return (
    <div className="card" style={{ padding: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <div style={{ fontSize: 11 }}>
          <span style={{ color: OD_COLOR }}>■ OD</span>{' '}
          <span style={{ color: OS_COLOR }}>■ OS</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', marginTop: 6 }}>
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--color-divider)" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--color-divider)" />
        <text x={4} y={padding.top + 4} fontSize={10} fill="currentColor" opacity={0.6}>{max.toFixed(1)}{unit}</text>
        <text x={4} y={height - padding.bottom} fontSize={10} fill="currentColor" opacity={0.6}>{min.toFixed(1)}{unit}</text>
        <path d={linePath('od')} fill="none" stroke={OD_COLOR} strokeWidth={2} />
        <path d={linePath('os')} fill="none" stroke={OS_COLOR} strokeWidth={2} />
        {points.map((p, i) => (
          <g key={p.date + i}>
            {p.od != null && <circle cx={xFor(i)} cy={yFor(p.od)} r={3} fill={OD_COLOR} />}
            {p.os != null && <circle cx={xFor(i)} cy={yFor(p.os)} r={3} fill={OS_COLOR} />}
            <text x={xFor(i)} y={height - padding.bottom + 14} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.6}>
              {new Date(p.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

async function fetchRnflTrend(patientId: string): Promise<Point[]> {
  const { data: visits } = await supabase.from('visits').select('id').eq('patient_id', patientId);
  const visitIds = (visits ?? []).map((v) => v.id);
  if (visitIds.length === 0) return [];
  const { data, error } = await supabase.from('oct_rnfl_records').select('eye, rnfl_avg_thickness, created_at').in('visit_id', visitIds).not('rnfl_avg_thickness', 'is', null).order('created_at', { ascending: true });
  if (error) throw error;
  const byDate = new Map<string, Point>();
  for (const r of data as any[]) {
    const dateKey = r.created_at.slice(0, 10);
    const point = byDate.get(dateKey) ?? { date: r.created_at, od: null, os: null };
    if (r.eye === 'od') point.od = Number(r.rnfl_avg_thickness);
    else if (r.eye === 'os') point.os = Number(r.rnfl_avg_thickness);
    byDate.set(dateKey, point);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchVfTrend(patientId: string): Promise<Point[]> {
  const { data: visits } = await supabase.from('visits').select('id').eq('patient_id', patientId);
  const visitIds = (visits ?? []).map((v) => v.id);
  if (visitIds.length === 0) return [];
  const { data, error } = await supabase.from('visual_field_tests').select('eye, md_value, created_at').in('visit_id', visitIds).not('md_value', 'is', null).order('created_at', { ascending: true });
  if (error) throw error;
  const byDate = new Map<string, Point>();
  for (const r of data as any[]) {
    const dateKey = r.created_at.slice(0, 10);
    const point = byDate.get(dateKey) ?? { date: r.created_at, od: null, os: null };
    if (r.eye === 'od') point.od = Number(r.md_value);
    else if (r.eye === 'os') point.os = Number(r.md_value);
    byDate.set(dateKey, point);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function GlaucomaProgressionPage() {
  const { id: patientId } = useParams();

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('full_name, uhid').eq('id', patientId).single();
      if (error) throw error;
      return data;
    },
  });

  const rnflTrend = useQuery({ queryKey: ['glaucoma-rnfl-trend', patientId], queryFn: () => fetchRnflTrend(patientId!), enabled: !!patientId });
  const vfTrend = useQuery({ queryKey: ['glaucoma-vf-trend', patientId], queryFn: () => fetchVfTrend(patientId!), enabled: !!patientId });

  return (
    <div>
      <Link to={`/patients/${patientId}`} className="text-muted" style={{ fontSize: 12 }}>&larr; {patient?.uhid}</Link>
      <h2 style={{ margin: '2px 0 12px' }}>Glaucoma Progression — {patient?.full_name}</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>
        RNFL thickness and Visual Field MD across every visit — a lower RNFL or a more negative MD over time is what progression looks like on paper. One point per calendar date; the x-axis is spaced by visit order, not literal time.
      </p>

      {rnflTrend.isLoading || vfTrend.isLoading ? <p className="text-muted">Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <TrendChart title="OCT RNFL Average Thickness" unit="µm" points={rnflTrend.data ?? []} />
          <TrendChart title="Visual Field — MD (Mean Deviation)" unit=" dB" points={vfTrend.data ?? []} />
        </div>
      )}
    </div>
  );
}
