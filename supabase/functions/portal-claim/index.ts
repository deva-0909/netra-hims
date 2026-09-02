// Links a patient portal login (Supabase Auth session, email-OTP) to an
// existing patient record — the one-time "claim your account" step. Runs
// as a service-role Edge Function because the anonymous 'check' call has
// to look up PII (uhid+email match) before any session exists, and RLS
// correctly has no anonymous read access to `patients` at all.
//
// mode "check": { uhid, email } — anonymous, called before the OTP is
//   sent, just to give a clear error before wasting an email. Never
//   reveals *which* field was wrong.
// mode "link": { uhid } with an Authorization: Bearer <user JWT> header —
//   called right after the patient verifies their OTP. Re-verifies the
//   uhid+email match server-side (never trusts the client's claim alone)
//   using the email out of the verified JWT, then sets
//   patients.portal_user_id.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { mode, uhid } = body ?? {};
  if (!uhid || typeof uhid !== 'string') return json({ error: 'uhid is required' }, 400);

  const supabaseService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (mode === 'check') {
    const { email } = body;
    if (!email || typeof email !== 'string') return json({ error: 'email is required' }, 400);
    const { data: patient } = await supabaseService.from('patients').select('id, portal_user_id')
      .ilike('uhid', uhid).ilike('email', email).is('merged_into', null).maybeSingle();
    if (!patient) return json({ ok: false, error: 'No matching patient record found. Check your UHID and the email on file with the hospital.' }, 404);
    if (patient.portal_user_id) return json({ ok: false, error: 'This patient record is already linked to a portal account — try signing in instead.' }, 409);
    return json({ ok: true });
  }

  if (mode === 'link') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user?.email) return json({ error: 'Could not verify your session — please sign in again.' }, 401);

    const { data: patient } = await supabaseService.from('patients').select('id, portal_user_id')
      .ilike('uhid', uhid).ilike('email', userData.user.email).is('merged_into', null).maybeSingle();
    if (!patient) return json({ error: 'No matching patient record found for this account.' }, 404);
    if (patient.portal_user_id && patient.portal_user_id !== userData.user.id) {
      return json({ error: 'This patient record is already linked to a different account.' }, 409);
    }

    const { error: updateError } = await supabaseService.from('patients').update({ portal_user_id: userData.user.id }).eq('id', patient.id);
    if (updateError) return json({ error: updateError.message }, 500);
    return json({ ok: true, patient_id: patient.id });
  }

  return json({ error: 'mode must be "check" or "link"' }, 400);
});
