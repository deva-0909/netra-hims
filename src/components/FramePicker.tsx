import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';

interface EyewearItem {
  id: string;
  category: string;
  brand: string;
  model: string | null;
  stock_qty: number;
  unit_price: number;
}

interface Props {
  value: { itemId: string | null; brand: string; model: string };
  onChange: (v: { itemId: string | null; brand: string; model: string; unitPrice?: number }) => void;
  category?: string; // filter to 'frame' | 'lens' | 'contact_lens'
}

export function FramePicker({ value, onChange, category }: Props) {
  const [query, setQuery] = useState(value.brand ? `${value.brand} ${value.model}`.trim() : '');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);

  const { data: matches } = useQuery({
    queryKey: ['eyewear-search', debouncedQuery, category],
    enabled: open && debouncedQuery.length > 0,
    queryFn: async () => {
      let q = supabase.from('eyewear_items').select('id, category, brand, model, stock_qty, unit_price')
        .or(`brand.ilike.%${sanitizeSearchTerm(debouncedQuery)}%,model.ilike.%${sanitizeSearchTerm(debouncedQuery)}%`)
        .order('brand')
        .limit(8);
      if (category) q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      return data as EyewearItem[];
    },
  });

  return (
    <div style={{ position: 'relative', flex: '1 1 220px' }}>
      <input
        className="input"
        placeholder="Search catalog (brand / model) or type freely"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange({ itemId: null, brand: e.target.value, model: value.model });
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches && matches.length > 0 && (
        <div className="card elev-md" style={{ position: 'absolute', zIndex: 20, width: '100%', maxHeight: 220, overflowY: 'auto', padding: 4 }}>
          {matches.map((it) => (
            <div
              key={it.id}
              style={{ padding: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}
              onMouseDown={() => {
                setQuery(`${it.brand} ${it.model ?? ''}`.trim());
                onChange({ itemId: it.id, brand: it.brand, model: it.model ?? '', unitPrice: Number(it.unit_price) });
                setOpen(false);
              }}
            >
              <span>{it.brand} {it.model ?? ''}</span>
              <span className={`tag ${it.stock_qty > 0 ? 'tag-outline' : 'tag-neutral'}`} style={{ fontSize: 11 }}>
                {it.stock_qty > 0 ? `${it.stock_qty} in stock` : 'out of stock'}
              </span>
            </div>
          ))}
        </div>
      )}
      {value.itemId && (
        <div style={{ fontSize: 11, color: 'var(--color-accent-700)', marginTop: 2 }}>Linked to catalog — stock will be deducted on dispense</div>
      )}
    </div>
  );
}
