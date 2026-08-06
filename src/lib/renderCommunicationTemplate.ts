export interface CommunicationContext {
  patient_name?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  token_number?: string | null;
  bill_number?: string | null;
  total_amount?: string | number | null;
}

export function renderCommunicationTemplate(text: string, ctx: CommunicationContext): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = (ctx as Record<string, unknown>)[key];
    return value === null || value === undefined || value === '' ? match : String(value);
  });
}
