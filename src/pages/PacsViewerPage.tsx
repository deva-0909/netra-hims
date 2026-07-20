import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

interface ScanItem {
  id: string;
  sourceLabel: string;
  date: string;
  fileUrl: string;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

// Aggregates every uploaded scan/report for a patient into one archive â€”
// this is the "PACS Viewer" from the design spec: a single place to browse
// and compare a patient's imaging history, rather than hunting through each
// visit's individual stage tabs one at a time.
async function fetchPatientScans(patientId: string): Promise<ScanItem[]> {
  const { data: visits } = await supabase.from('visits').select('id').eq('patient_id', patientId);
  const visitIds = (visits ?? []).map((v) => v.id);
  if (visitIds.length === 0) return [];

  const [imaging, vf, oct, topo, investigations] = await Promise.all([
    supabase.from('imaging_records').select('id, file_url, created_at, imaging_type').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('visual_field_tests').select('id, file_url, created_at').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('oct_rnfl_records').select('id, file_url, created_at').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('corneal_topography').select('id, file_url, created_at').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('investigation_orders').select('id, result_file_url, ordered_at, test_name').in('visit_id', visitIds).not('result_file_url', 'is', null),
  ]);

  const items: ScanItem[] = [
    ...(imaging.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: `Imaging â€” ${r.imaging_type?.replace(/_/g, ' ')}`, date: r.created_at, fileUrl: r.file_url })),
    ...(vf.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: 'Visual Field Test', date: r.created_at, fileUrl: r.file_url })),
    ...(oct.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: 'OCT RNFL', date: r.created_at, fileUrl: r.file_url })),
    ...(topo.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: 'Corneal Topography', date: r.created_at, fileUrl: r.file_url })),
    ...(investigations.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: `Investigation â€” ${r.test_name}`, date: r.ordered_at, fileUrl: r.result_file_url })),
  ];

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function ScanFrame({ scan }: { scan: ScanItem | null }) {
  if (!scan) return <div className="text-muted" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>No scan selected.</div>;
  const isImage = IMAGE_EXT.test(scan.fileUrl);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ background: '#111', borderRadius: 'var(--radius-md)', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {isImage ? (
          <img src={scan.fileUrl} alt={scan.sourceLabel} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
        ) : (
          <a href={scan.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#fff' }}>Open file (non-image document) â†’</a>
        )}
      </div>
      <div style={{ fontSize: 13 }}>
        <strong>{scan.sourceLabel}</strong>
        <span className="text-muted"> â€” {new Date(scan.date).toLocaleString()}</span>
      </div>
    </div>
  );
}

export function PacsViewerPage() {
  const { id: patientId } = useParams();
  const [activeIndex, setActiveIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('full_name, uhid').eq('id', patientId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: scans, isLoading } = useQuery({
    queryKey: ['patient-scans', patientId],
    queryFn: () => fetchPatientScans(patientId!),
    enabled: !!patientId,
  });

  const active = scans?.[activeIndex] ?? null;
  const compare = compareIndex !== null ? scans?.[compareIndex] ?? null : null;

  return (
    <div>
      <Link to={`/patients/${patientId}`} className="text-muted" style={{ fontSize: 12 }}>&larr; {patient?.uhid}</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: '2px 0 12px' }}>Imaging Archive â€” {patient?.full_name}</h2>
        {scans && scans.length > 1 && (
          <button
            className="btn"
            style={compareMode ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent-700)' } : undefined}
            onClick={() => { setCompareMode((c) => !c); if (!compareMode && compareIndex === null) setCompareIndex(Math.min(activeIndex + 1, scans.length - 1)); }}
          >
            {compareMode ? 'Exit compare' : 'Compare with prior'}
          </button>
        )}
      </div>

      {isLoading ? <p className="text-muted">Loadingâ€¦</p> : scans && scans.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: compareMode ? '1fr 1fr' : '1fr', gap: 'var(--space-4)' }}>
            <ScanFrame scan={active} />
            {compareMode && <ScanFrame scan={compare} />}
          </div>

          <h4 style={{ marginTop: 'var(--space-5)' }}>All scans ({scans.length})</h4>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {scans.map((s, i) => (
              <div key={s.id} style={{ flex: 'none', width: 140 }}>
                <button
                  onClick={() => (compareMode ? setCompareIndex(i) : setActiveIndex(i))}
                  className="card"
                  style={{
                    width: '100%', padding: 6, cursor: 'pointer', textAlign: 'left', border: '2px solid',
                    borderColor: i === activeIndex ? 'var(--color-accent)' : (compareMode && i === compareIndex ? 'var(--color-accent-700)' : 'var(--color-divider)'),
                  }}
                >
                  {IMAGE_EXT.test(s.fileUrl) ? (
                    <img src={s.fileUrl} alt={s.sourceLabel} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <div style={{ width: '100%', height: 80, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, borderRadius: 4 }}>Document</div>
                  )}
                  <div style={{ fontSize: 11, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sourceLabel}</div>
                  <div className="text-muted" style={{ fontSize: 10 }}>{new Date(s.date).toLocaleDateString()}</div>
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted">No scans or reports uploaded for this patient yet â€” images uploaded on Imaging, Visual Field, OCT RNFL, Corneal Topography, or Investigation tabs will appear here automatically.</p>
      )}
    </div>
  );
}