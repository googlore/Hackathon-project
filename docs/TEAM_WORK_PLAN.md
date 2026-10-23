# Two-person, conflict-free build plan

## First demo scope

Only ship this flow:

`host creates room -> participants join -> submit case -> challenge/defend a step -> host verdict -> live leaderboard`

Defer images, CSV export, votes, analytics, reports, and advanced moderation.

## Branches and ownership

### `work/platform`

Owns authentication, trusted server behaviour, and data integrity.

```
supabase/**
src/app/api/**
src/lib/**
src/types/**
tests/unit/**
tests/database/**
.env.example
```

Tasks, in order:

1. Supabase schema, guest authentication, rooms, and memberships.
2. Row-level security policies and server routes for create/join/read room.
3. Cases, ordered solution steps, challenges, defences, and realtime data hooks.
4. Host-only `settle_challenge` database transaction and append-only score ledger.
5. Seed data plus tests for room isolation, permissions, and duplicate verdict prevention.

### `work/gameplay-ui`

Owns all visible classroom screens. It uses fixtures until server endpoints are ready.

```
src/app/(arena)/**
src/components/**
src/features/**
src/styles/**
tests/e2e/**
```

Tasks, in order:

1. Join screen and fixture-based room/lobby.
2. New-case editor with manual step splitting and review.
3. Case screen, challenge form, defence panel, and status display.
4. Host queue, verdict controls, responsive leaderboard, loading/empty/error states.
5. Wire pages to the stable server API and run the three-session demo test.

### `main` — integration only

Only the repository maintainer changes shared configuration or merges work:

```
package.json
package-lock.json
next.config.*
tsconfig.json
src/app/layout.tsx
src/app/globals.css
```

## Rules that prevent clashes

1. Never commit development work directly to `main`.
2. Work only in your assigned branch and path list.
3. Never use `git add .`; stage individual owned files.
4. Do not edit a file owned by the other branch. Record required changes in the pull-request description.
5. The platform owner publishes example request/response payloads before the UI wiring milestone.
6. Merge one pull request at a time. After each merge, run the complete host + two-participant demo.

## Non-negotiable integrity checks

- Roles, verdict eligibility, and points are decided by server/database code, never the browser.
- A host cannot settle their own challenge.
- A repeated verdict request returns a conflict and creates no additional score events.
- No participant can create score events directly.
