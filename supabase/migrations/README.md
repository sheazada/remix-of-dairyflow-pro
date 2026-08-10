# DairyFlow Pro — Database Migration

Recovered schema of the full DairyFlow Pro ERP (55 tables, 60 functions,
189+2 RLS policies, 106 indexes, 89 FKs, 36 triggers, 3 enums, 1 view),
reconstructed from the old project's pg_dump archive.

Everything below runs as the `postgres` role in the Supabase **SQL Editor**
of the new project (`otqdtqbrigivwxmtijyp`).

## Run order

| # | File | Contents | ~size |
|---|------|----------|-------|
| 1 | `001_schema.sql` | Enums, 55 tables, daily_reconciliation view | 30 KB |
| 2 | `002_functions.sql` | All 60 public functions (recalc_invoice, revise_invoice, notification queue, RBAC helpers…) | 47 KB |
| 3 | `003_row_security.sql` | RLS enable + 189 original policies + **2 fixes** | 34 KB |
| 4 | `004_indexes_constraints.sql` | Indexes, CHECK + FK constraints | 34 KB |
| 5 | `005_triggers.sql` | 36 triggers (recalc cascades, audit logging, updated_at) | 6 KB |
| 6 | `006_grants_comments.sql` | Grants to anon/authenticated/service_role + comments | 24 KB |
| 7 | `007_storage.sql` | Storage buckets `challans` + `pod` and their policies | 2 KB |
| 8 | `008_seed.sql` | Distributor, admin login, permissions catalog, role maps, expense categories, reminder templates | 9 KB |

Run them **one at a time, in order** (each fits the SQL Editor).

## RLS fixes vs. the original schema

1. `users_select_anon_login` — the login page queries `public.users` by
   email **before** authentication; the original schema had no anon policy,
   so login could never find the user. Added anon SELECT.
2. `email_verification_tokens_select_anon` — the `/verify-email` page looks
   up the token while signed out. Added anon SELECT (the token is the secret).

## Admin login (created by 008_seed.sql)

```
Email:    admin@creamroute.com
Password: Admin@1234
```

**Change this password immediately after first login** (Admin → Users, or via
SQL by updating `auth.users.encrypted_password` and `public.users.password_hash`).

The seed creates the admin in `auth.users` (+ identity for
`signInWithPassword`), `public.users` (bcrypt hash for the edge-function
login path), `profiles`, and `user_roles` ('admin').

## After the SQL: deploy edge functions

Forgot/reset password and email verification use Supabase Edge Functions in
`supabase/functions/auth/`. Deploy them and set secrets:

```bash
supabase login
supabase link --project-ref otqdtqbrigivwxmtijyp
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>
supabase secrets set RESEND_API_KEY=<your Resend key>   # optional, for emails
supabase functions deploy auth-login --no-verify-jwt    # etc. for each fn
```

(Function names in Supabase must match the URLs used by the app:
`auth/login`, `auth/create-user`, `auth/verify-email`,
`auth/forgot-password`, `auth/reset-password`.)

## Verified

All 8 files were executed against a clean PostgreSQL 17 instance with
`ON_ERROR_STOP=1` — zero errors. A functional smoke test passed:
invoice creation recalculates totals + customer outstanding via triggers;
partial payment cascades status `pending → partial` and updates balances;
`get_user_permissions`, `has_role`, and the full auth-user chain verified.
