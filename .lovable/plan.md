# Migration Plan: Move from Lovable Cloud to your own Supabase

## Recommended path (easiest)

**Remix this Lovable project → create a new project with the same code → disable Lovable Cloud on the new project → connect your own Supabase project → export/import the database.**

This is the easiest route because it keeps your entire codebase intact while moving the backend (database, auth, storage) to a Supabase dashboard you fully control. You do not need to rewrite the app.

---

## What this plan does not cover

- This is not a one-click migration. Lovable Cloud and Supabase are separate backends; data must be exported and imported manually.
- Auth users may need to be re-invited or reset passwords unless Supabase supports migrating auth identities from the Cloud export.
- Storage files (invoice PDFs, POD photos, logos) must be moved separately.

---

## Step-by-step plan

### Step 1 — Prepare your own Supabase project
- Create a new Supabase project at supabase.com (or self-host if you prefer).
- Keep the project URL, anon key, service role key, and database password ready.
- Do not create any tables yet. We will recreate the schema from the Cloud export.

### Step 2 — Remix the current Lovable project
- In the current project, go to **Project name → Settings → Remix this project**.
- This creates a new Lovable project with a copy of the codebase.
- During setup, do **not** enable Lovable Cloud on the new project.
- After creation, update the new project’s environment variables to point to your Supabase project:
  - `VITE_SUPABASE_URL` / `SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Step 3 — Export the database from Lovable Cloud
- In the current project, go to **Cloud → Advanced settings → Export data** and request a full database export.
- This gives you a PostgreSQL dump of the current database (schema + data).
- If you only want specific tables, tell me which ones and I can export them as CSV/SQL instead.

### Step 4 — Import the database into your Supabase project
- Use the Supabase SQL editor or `psql` to run the exported dump.
- Verify that all tables, RLS policies, triggers, and functions are present.
- Confirm that `auth.users` and related auth data migrated correctly (Supabase may handle this, or you may need to re-create users).

### Step 5 — Update integrations and secrets in the new project
- Reconfigure any Cloud-only features you were using:
  - Push notifications (VAPID keys)
  - Email/SMS/WhatsApp providers
  - Social OAuth providers (Google sign-in)
  - Sentry, if enabled
- Move these from the old project settings to the new project’s secrets/environment.

### Step 6 — Move storage files
- Download any files from the old project’s storage (invoice PDFs, POD photos, logos, challan images).
- Upload them into your new Supabase storage bucket and update the file URLs in the database if the paths change.

### Step 7 — Test the new project
- Verify sign-in works for each role (admin, manager, salesperson, driver, helper, retailer).
- Check that core flows work: orders, invoices, inventory, deliveries, payments, reports.
- Run a full build to confirm no environment-specific errors.

### Step 8 — Publish and switch over
- Publish the new project to a custom domain or use the Lovable-provided URL.
- Train users to use the new URL.
- Keep the old project read-only for a short period, then disconnect it if you want to stop paying for Cloud on the old project.

---

## What files/code move automatically

The entire codebase moves when you remix:
- `src/` — all React components, routes, hooks, server functions
- `supabase/` — edge functions and config (these will be re-deployed to your new Supabase project)
- `public/` — static assets, PWA service worker
- `package.json`, `vite.config.ts`, `tsconfig.json`, etc.

The only things that do **not** move automatically are:
- The database contents
- Storage files
- Project secrets and environment variables
- Cloud-specific settings (VAPID, OAuth, email domains)

---

## Alternative paths

1. **Disable Cloud only for future projects** — easiest, but does not move this project. Useful if you just want new projects to use Supabase directly.
2. **Disconnect Cloud from this project** — destructive; deletes all data. Not recommended unless you are abandoning the app.
3. **Stay on Lovable Cloud** — simplest if you just want the Supabase backend managed for you. You can still use the migration tool for schema changes and backend access through the Lovable backend UI.

---

## Next action

Decide whether you want to proceed with the recommended remix path. If yes, we can start with Step 1 (create your Supabase project) and Step 2 (remix the project). If you want a simpler scope first, we can also export only the database schema or specific tables to begin with.