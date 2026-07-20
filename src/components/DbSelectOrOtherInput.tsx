import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { SelectOrOtherInput } from './SelectOrOtherInput';

interface Props {
  value: string | null | undefined;
  onChange: (value: string) => void;
  dbTable: string;
  dbColumn: string;
  placeholder?: string;
}

/** Same UX as SelectOrOtherInput, but the option list is admin-managed data
 * (Insurance Masters, Investigation Masters, etc.) instead of a hardcoded
 * list — so changes made in Administration → Masters show up here live. */
export function DbSelectOrOtherInput({ value, onChange, dbTable, dbColumn, placeholder }: Props) {
  const { data: options } = useQuery({
    queryKey: ['master-options', dbTable, dbColumn],
    queryFn: async () => {
      const { data, error } = await supabase.from(dbTable).select(dbColumn).eq('active', true).order(dbColumn);
      if (error) throw error;
      return (data ?? []).map((row: any) => row[dbColumn] as string);
    },
  });

  return <SelectOrOtherInput value={value} options={options ?? []} onChange={onChange} placeholder={placeholder} />;
}