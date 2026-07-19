import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { ModuleConfig } from '../modules/fieldTypes';

interface Props {
  visitId: string;
  moduleConfig: ModuleConfig;
  excludeStageKey?: string; // don't repeat the tab the user is currently on
}

/** Fetches the single latest row from every non-custom stage table for this
 * visit, in parallel, so a doctor can see what pretesting/prior exams already
 * found without clicking through every tab first. */
export function PatientChartSummary({ visitId, moduleConfig, excludeStageKey }: Props) {
  const [open, setOpen] = useState(false);

  const stages = moduleConfig.stages.filter((s) => !s.custom && s.key !== excludeStageKey && s.fields.length > 0);

  const { data } = useQuery({
    queryKey: ['chart-summary', visitId, moduleConfig.key],
    enabled: open,
    queryFn: async () => {
      const results = await Promise.all(
        stages.map(async (s) => {
          const { data } = await supabase
            .from(s.table)
            .select('*')
            .eq('visit_id', visitId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return { stage: s, row: data };
        })
      );
      return results.filter((r) => r.row);
    },
  });

  return (
    <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--color-text)' }}
      >
        {open ? '[Hide]' : '[Show]'} Patient chart summary
        <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 400 }}>
          â€” everything recorded so far on this visit, at a glance
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
          {data === undefined && <p className="text-muted" style={{ gridColumn: '1 / -1' }}>Loadingâ€¦</p>}
          {data?.length === 0 && <p className="text-muted" style={{ gridColumn: '1 / -1' }}>No prior records on this visit yet.</p>}
          {data?.map(({ stage, row }) => (
            <div key={stage.key} className="card" style={{ padding: 'var(--space-3)', background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{stage.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginBottom: 6 }}>{new Date(row.created_at).toLocaleString()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
                {stage.fields.map((f) => {
                  const v = row[f.name];
                  if (v === null || v === undefined || v === '' || f.type === 'file') return null;
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
      )}
    </div>
  );
}