/** Compares a numeric result against a test's reference range (gender-aware
 * where the catalog has gender-specific overrides) to suggest normal/low/high.
 * 'critical' is never auto-computed — that stays a deliberate human call. */
export function computeLabResultFlag(test: any, patientGender: string | null | undefined, numericValue: number): 'normal' | 'low' | 'high' | null {
  if (!test || test.result_type !== 'numeric') return null;
  let low = test.reference_low, high = test.reference_high;
  if (patientGender === 'male' && (test.reference_low_male != null || test.reference_high_male != null)) {
    low = test.reference_low_male; high = test.reference_high_male;
  } else if (patientGender === 'female' && (test.reference_low_female != null || test.reference_high_female != null)) {
    low = test.reference_low_female; high = test.reference_high_female;
  }
  if (low == null && high == null) return null;
  if (low != null && numericValue < low) return 'low';
  if (high != null && numericValue > high) return 'high';
  return 'normal';
}
