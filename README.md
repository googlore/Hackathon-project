# AI Challenge Arena

A private classroom arena where students challenge and defend steps in AI-generated A-level reasoning. The app never calls an AI model: students paste an answer from the AI service they already use.

## What works

- Guest sessions, private rooms, room codes, and host/participant roles
- Case submission with manually separated solution steps
- Challenges, defences, host verdicts, an append-only score ledger, and live room updates
- Responsive UI for creating/joining a room and running the challenge flow

## Run locally

1. Install Node.js 20+ and create a Supabase project.
2. In Supabase **Authentication → Providers**, enable anonymous sign-ins. This project intentionally uses guest accounts and does not collect school identifiers.
3. Copy `.env.example` to `.env.local`, then add the project URL and publishable/anon key.
4. Apply `supabase/migrations/202610230001_platform_schema.sql` in the Supabase SQL Editor. Optionally apply `supabase/seed.sql` for a demo room.
5. Install and start the app:

   ```bash
   npm install
   npm run dev
   ```

6. Open `http://localhost:3000`, create a room, then join its code from a second browser session.

## Verification

```bash
npm run build
npm run lint
```

The database integrity test is in `supabase/tests/database/platform_integrity.test.sql`. Run it against a local Supabase environment or a dedicated non-production project after applying the migration.
