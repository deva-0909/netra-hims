// Inbound API endpoint for clinic instruments — autorefractors, tonometers,
// biometers, OCT, fundus cameras, lab analyzers — anything that can make an
// HTTP call. Authenticated by a per-device API key (see device_registry),
// not a Supabase user session, since a machine has no staff profile.
//
// Request:
//   POST /functions/v1/device-ingest
//   Header: x-device-api-key: <plaintext key issued when the device was registered>
//   Body (JSON):
//     {
//       "reading_type": "lab_result" | "iop" | "refraction" | "biometry" | "other",
//       "patient_identifier": "<UHID as the device operator typed it>",
//       "payload": { ...reading-type-specific fields, see below }
//     }
//
// Expected payload shapes (the reconciliation UI in DeviceIntegrationPage
// reads these keys when a human applies a reading into the chart):
//   lab_result: { test_code: string, value: string | number }
//   iop:        { iop_od?: number, iop_os?: number, method?: string }
//   refraction: { sphere_od?, cylinder_od?, axis_od?, sphere_os?, cylinder_os?, axis_os?, method? }
//   biometry:   { imaging_type?, axial_length_od?, axial_length_os?, k1_od?, k2_od?, k1_os?, k2_os?, iol_power_od?, iol_power_os?, iol_formula? }
//
// The reading always lands in device_readings first — auto-matched to a
// patient by UHID if exactly one active patient matches, never auto-matched
// to a visit/lab-order or auto-applied into a clinical record. A staff
// member always makes that final call from the Device Integration screen.
//
// Authentication happens before payload validation so that once a device
// is identified, every failure past that point (bad payload shape, DB
// insert error) can be attributed to it and logged to
// device_ingest_failures for the retry queue in DeviceIntegrationPage.
// Invalid-API-key attempts are deliberately never logged — that would
// give an unauthenticated caller a write path into the table.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const READING_TYPES = new Set(['lab_result', 'iop', 'refraction', 'biometry', 'other']);

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-device-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = req.headers.get('x-device-api-key');
  if (!apiKey) return json({ error: 'Missing x-device-api-key header' }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const apiKeyHash = await sha256Hex(apiKey);
  const { data: device, error: deviceError } = await supabase
    .from('device_registry')
    .select('id, device_name, active')
    .eq('api_key_hash', apiKeyHash)
    .maybeSingle();

  if (deviceError) return json({ error: deviceError.message }, 500);
  if (!device) return json({ error: 'Unrecognized API key' }, 401);
  if (!device.active) return json({ error: 'This device is deactivated' }, 403);

  // Authenticated — mark the device as reachable regardless of what
  // happens with the payload below.
  await supabase.from('device_registry').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id);

  const logFailure = async (errorMessage: string, readingType: string | null) => {
    await supabase.from('device_ingest_failures').insert({
      device_id: device.id, reading_type: readingType, error_message: errorMessage, raw_body: body,
    });
  };

  const { reading_type, patient_identifier, payload } = body ?? {};
  if (!reading_type || !READING_TYPES.has(reading_type)) {
    const message = `reading_type must be one of ${[...READING_TYPES].join(', ')}`;
    await logFailure(message, reading_type ?? null);
    return json({ error: message }, 400);
  }
  if (!payload || typeof payload !== 'object') {
    await logFailure('payload (object) is required', reading_type);
    return json({ error: 'payload (object) is required' }, 400);
  }

  let matchedPatientId: string | null = null;
  let status = 'unmatched';
  if (patient_identifier) {
    const { data: patients } = await supabase
      .from('patients')
      .select('id')
      .is('merged_into', null)
      .ilike('uhid', patient_identifier);
    if (patients && patients.length === 1) {
      matchedPatientId = patients[0].id;
      status = 'matched';
    }
  }

  const { data: reading, error: insertError } = await supabase
    .from('device_readings')
    .insert({
      device_id: device.id,
      reading_type,
      patient_identifier: patient_identifier ?? null,
      raw_payload: payload,
      status,
      matched_patient_id: matchedPatientId,
    })
    .select('id')
    .single();

  if (insertError) {
    await logFailure(insertError.message, reading_type);
    return json({ error: insertError.message }, 500);
  }

  await supabase.from('device_registry').update({ last_reading_at: new Date().toISOString() }).eq('id', device.id);

  return json({ success: true, reading_id: reading.id, device: device.device_name, matched: status === 'matched' });
});
