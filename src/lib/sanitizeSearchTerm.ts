/**
 * PostgREST's `.or()` filter syntax uses commas to separate conditions and
 * parentheses for grouping. Interpolating raw user input into a filter
 * string (e.g. `full_name.ilike.%${input}%`) lets a comma or parenthesis in
 * the input break out of the intended condition and manipulate the filter
 * logic — not classic SQL injection (RLS still applies to every row
 * regardless), but a genuine "filter injection" a security audit will flag.
 * Strip the characters that are structurally significant to the parser.
 */
export function sanitizeSearchTerm(input: string): string {
  return input.replace(/[,()]/g, '').trim();
}
