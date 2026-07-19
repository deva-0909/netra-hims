import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { MODULES } from '../modules/moduleConfig';

export function JourneyQueuePage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const config = module ? MODULES[module] : undefined;

  const { data: visits, isLoading } = useQuery({
    queryKey: ['journey-queue', module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, patients(full_name, uhid, phone)')
        .eq('clinic_module', module)
        .not('stage', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!config) return <p>Unknown module.</p>;

  return (
    <div>
      <h2>{config.label} â€” Active Queue</h2>
      {isLoading ? <p className="text-muted">Loadingâ€¦</p> : (
        <table className="table">
          <thead><tr><th>Token</th><th>Patient</th><th>UHID</th><th>Stage</th><th>Started</th><th /></tr></thead>
          <tbody>
            {visits?.map((v: any) => (
              <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
                <td>{v.token_number ?? 'â€”'}</td>
                <td>{v.patients?.full_name}</td>
                <td>{v.patients?.uhid}</td>
                <td><span className="tag tag-neutral">{v.stage.replace(/_/g, ' ')}</span></td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
                <td><button className="btn btn-ghost">Open</button></td>
              </tr>
            ))}
            {visits?.length === 0 && <tr><td colSpan={6} className="text-muted">No active visits in this clinic right now.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}