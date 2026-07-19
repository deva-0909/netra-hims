# Netra HIMS

React + Supabase frontend for the Netra HIMS eye hospital design (`Eye_Hospital_HIMS_Design.zip`).

## What's here

- **Supabase project**: `netra-hims` (ref `mdgxsxngbpjtjlkvnbae`, region `ap-south-1`), already provisioned with
  the full schema — patients, appointments, visits, and ~40 clinical tables covering general OPD, retina,
  glaucoma, LASIK/refractive, and pediatric ophthalmology, plus pharmacy, optical, billing, insurance and
  admission/OT/recovery. Row-level security is on for every table (any authenticated staff member with an
  active profile can read/write; tighten per-role if you need stricter separation later).
- **React app** (Vite + TypeScript + React Router + TanStack Query), styled with the design system tokens
  from the original design (`src/design-system.css`, ported verbatim from `styles.css`).
- A generic, config-driven form engine (`src/modules/moduleConfig.ts` + `RecordForm`/`RecordHistory`) that
  renders most of the ~30 clinical screens from one field-schema list, plus three bespoke flows for the
  multi-table cases: Pharmacy (prescriptions + items + dispensing), Billing (bills + line items), and
  Admission → OT → Recovery.

## Local development

```bash
npm install
npm run dev
```

The `.env` file already points at the live Supabase project. Copy `.env.example` if you ever need to point
at a different project.

First run: open the app, click **Register staff** on the login screen, and register yourself with the
**admin** role — that account can then promote/activate other staff from Administration → Staff.

## Deploying

### Push to GitHub

```bash
git init
git add -A
git commit -m "Netra HIMS: React + Supabase frontend"
git branch -M main
git remote add origin https://github.com/<your-username>/netra-hims.git
git push -u origin main
```

### Deploy to Vercel

Easiest path — Vercel CLI:

```bash
npm i -g vercel
vercel login
vercel          # first deploy, follow the prompts (link or create a project)
vercel --prod   # promote to production
```

When prompted (or afterwards in the Vercel dashboard → Project → Settings → Environment Variables), set:

- `VITE_SUPABASE_URL` = `https://mdgxsxngbpjtjlkvnbae.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (the publishable key in `.env.example`)

`vercel.json` is already set up for the Vite SPA build and client-side routing rewrites, so no further
config is needed. Alternatively, import the GitHub repo directly at vercel.com/new — Vercel auto-detects
Vite and you just need to add the two env vars above before the first deploy.

## Notable gaps / next steps

- **Token numbers** aren't auto-generated yet (`visits.token_number` / `appointments.token_number` are free
  text) — wire up a simple daily sequence per clinic module if you want real queue tokens.
- **File uploads** (consent forms, OCT/fundus images, investigation results) are stored as `_file_url` text
  columns — hook up Supabase Storage and a file picker to actually upload rather than paste a URL.
- **Per-role write permissions are enforced at the database level** (see `0007_role_permissions.sql`) —
  e.g. only `reception` can register patients, only `doctor` can write consultations, only `pharmacist`
  can mark prescriptions dispensed, and so on. Reads stay staff-wide (any active staff member can see
  everything, needed for dashboards and cross-module context). The one deliberate exception: any staff
  member can always change *their own* profile's role — that's what makes the sidebar's demo role
  switcher work without needing separate logins per role. Only `admin` can edit or deactivate *other*
  people's accounts.
- **Patient self-service / ABHA and Golden Card live verification** are manual toggles right now, not wired
  to a real government API.
