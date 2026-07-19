import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { StageConfig } from '../modules/fieldTypes';

interface Props {
  stage: StageConfig;
  filterColumn: string;
  filterValue: string;
  refreshKey?: number;
}

export function RecordHistory({ stage, filterColumn, filterValue, refreshKey }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['history', stage.table, filterColumn, filterValue, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(stage.table)
        .select('*')
        .eq(filterColumn, filterValue)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-muted">Loading history…</p>;
  if (!data || data.length === 0) return <p className="text-muted">No records yet for this stage.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {data.map((row: any) => (
        <div key={row.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div className="card-meta">{new Date(row.created_at).toLocaleString()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 16px', fontSize: 13 }}>
            {stage.fields.map((f) => {
              const v = row[f.name];
              if (v === null || v === undefined || v === '') return null;
              return (
                <div key={f.name}>
                  <span className="text-muted">{f.label}: </span>
                  <span>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
