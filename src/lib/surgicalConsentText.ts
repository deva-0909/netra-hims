const EYE_LABELS: Record<string, string> = { od: 'the right eye (OD)', os: 'the left eye (OS)', both: 'both eyes' };

/** Every surgery outside LASIK previously only ever got the generic
 * ward-admission consent text — never named the actual procedure, eye, or
 * surgeon. This builds a procedure-specific consent the same way
 * LASIK_CONSENT_TEXT does, snapshotted into surgical_consents.consent_text
 * so it stays accurate even if the procedure details are edited later. */
export function buildSurgicalConsentText(procedureName: string, eye: string, surgeonName: string | null): string {
  const eyeLabel = EYE_LABELS[eye] ?? eye;
  return `INFORMED CONSENT FOR SURGICAL PROCEDURE

Procedure: ${procedureName}
Eye: ${eyeLabel}
Operating surgeon: ${surgeonName ?? 'to be confirmed'}

I understand that the above procedure has been recommended for my eye condition, and that no surgery can guarantee a perfect outcome.

I have been informed of, and understand:
1. The nature and purpose of the procedure, and the alternatives available, including no treatment.
2. Possible risks including but not limited to: infection, bleeding, pain, reduced or loss of vision, and the need for further treatment or surgery.
3. Anaesthesia (local/topical or general, as applicable) carries its own risks, which have been explained to me.
4. I must attend all scheduled post-operative reviews for my safety.
5. I may withdraw consent at any point before the procedure begins.

I confirm my questions have been answered to my satisfaction and I voluntarily consent to undergo the procedure named above, on the eye specified above.`;
}
