import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';

interface Drug {
  id: string;
  name: string;
  form: string | null;
  strength: string | null;
  stock_qty: number;
}

interface Props {
  value: { drugId: string | null; name: string };
  onChange: (v: { drugId: string | null; name: string }) => void;
}

export function DrugPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value.name);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);

  const { data: matches } = useQuery({
    queryKey: ['drug-search', debouncedQuery],
    enabled: open && debouncedQuery.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drugs')
        .select('id, name, form, strength, stock_qty')
        .ilike('name', `%${debouncedQuery}%`)
        .order('name')
        .limit(8);
      if (error) throw error;
      return data as Drug[];
    },
  });

  return (
    <div style={{ position: 'relative', flex: '1 1 200px' }}>
      <input
        className="input"
        placeholder="Drug name (search catalog or type freely)"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange({ drugId: null, name: e.target.value }); // typing clears the catalog link — treated as free-text unless a match is picked
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches && matches.length > 0 && (
        <div className="card elev-md" style={{ position: 'absolute', zIndex: 20, width: '100%', maxHeight: 220, overflowY: 'auto', padding: 4 }}>
          {matches.map((d) => (
            <div
              key={d.id}
              style={{ padding: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}
              onMouseDown={() => {
                setQuery(d.name);
                onChange({ drugId: d.id, name: d.name });
                setOpen(false);
              }}
            >
              <span>{d.name} {d.strength ? `(${d.strength})` : ''}</span>
              <span className={`tag ${d.stock_qty > 0 ? 'tag-outline' : 'tag-neutral'}`} style={{ fontSize: 11 }}>
                {d.stock_qty > 0 ? `${d.stock_qty} in stock` : 'out of stock'}
              </span>
            </div>
          ))}
        </div>
      )}
      {value.drugId && (
        <div style={{ fontSize: 11, color: 'var(--color-accent-700)', marginTop: 2 }}>Linked to catalog — stock will be deducted on dispense</div>
      )}
    </div>
  );
}
