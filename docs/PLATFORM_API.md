# Platform API contract

All protected endpoints require `Authorization: Bearer <access_token>`. Obtain a guest access token from `POST /api/auth/guest`; refresh it with `POST /api/auth/refresh` and `{ "refreshToken": "<refresh_token>" }`. Keep the token in client session state and do not put it in a URL.

Protected error responses use `{ "error": { "code": "...", "message": "..." } }`. A repeated verdict returns HTTP `409` and does not add another score event.

## Guest session

`POST /api/auth/guest` returns HTTP `201`:

```json
{
  "user": { "id": "guest-user-uuid" },
  "access_token": "guest-access-token",
  "refresh_token": "guest-refresh-token",
  "expires_in": 3600,
  "token_type": "bearer"
}
```

## Room flow

`POST /api/rooms` creates a room and host membership:

```json
{ "name": "Proof Lab", "displayName": "Teacher", "subject": "Mathematics", "topic": "Inequalities" }
```

It returns HTTP `201` with `{ "room": { "id": "...", "code": "F8K2QX", "name": "Proof Lab", "subject": "Mathematics", "topic": "Inequalities", "status": "open", "role": "host" } }`.

`POST /api/rooms/join` takes `{ "code": "F8K2QX", "displayName": "Nadia" }` and returns `{ "room": { ... , "role": "participant" } }`. `GET /api/rooms/{roomId}` returns `{ "room": RoomState }` to room members only.

## Cases, challenges, defences, and verdicts

Create a case with ordered steps using `POST /api/rooms/{roomId}/cases`:

```json
{
  "prompt": "If abc = 1, prove the inequality.",
  "source": "Gemini",
  "steps": [{ "content": "First step." }, { "content": "Second step." }]
}
```

The response is `{ "caseId": "..." }`. `POST /api/steps/{stepId}/challenges` accepts `{ "claim": "The exact reasoning error is ...", "correction": "Optional correction", "verification": "Optional check" }` and returns `{ "challengeId": "..." }`. The case author submits a defence with `POST /api/challenges/{challengeId}/defences` and `{ "body": "..." }`; the response is `{ "defenceId": "..." }`.

Only a room host can submit `POST /api/challenges/{challengeId}/verdict` with `{ "verdict": "upheld" }` or `{ "verdict": "rejected" }`. Its response is `{ "settlement": { "challengeId": "...", "status": "upheld", "pointsAwarded": 5, "winnerId": "..." } }`. Points are written only by the settlement transaction; participants cannot write to the score ledger.

## Live room state

`GET /api/rooms/{roomId}/events` returns server-sent events. Send the bearer token in the request header. Each `event: room` event contains the same `RoomState` shape returned by the room read endpoint, including memberships, ordered cases/steps, challenges, defences, and the score-derived participant leaderboard. The feed refreshes at two-second intervals and emits only changed state.
