begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'test-host@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'test-participant@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('90000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'test-challenger@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('90000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'test-outsider@example.invalid', '', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

create temporary table platform_test_data (
  room_id uuid,
  room_code text,
  case_id uuid,
  step_id uuid,
  challenge_id uuid,
  host_challenge_id uuid
);
grant all on table platform_test_data to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
insert into pg_temp.platform_test_data (room_id, room_code)
select (result ->> 'id')::uuid, result ->> 'code'
from (select public.create_room('Integrity Test Room', 'Host') as result) created;
select is(
  (select role::text from public.room_memberships where room_id = (select room_id from pg_temp.platform_test_data)
    and user_id = auth.uid()),
  'host',
  'room creator receives the host role'
);
update pg_temp.platform_test_data
set case_id = public.submit_case(
  (select room_id from pg_temp.platform_test_data),
  'A sample proof claim',
  '[{"content":"The first reasoning step."}]'::jsonb
);
update pg_temp.platform_test_data
set step_id = (select id from public.solution_steps where case_id = pg_temp.platform_test_data.case_id);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select is(
  public.join_room((select room_code from pg_temp.platform_test_data), 'Participant') ->> 'role',
  'participant',
  'joining a room grants participant role'
);
select is(
  (select role::text from public.room_memberships where room_id = (select room_id from pg_temp.platform_test_data)
    and user_id = auth.uid()),
  'participant',
  'the participant role is stored in the membership'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select is(
  public.get_room_state((select room_id from pg_temp.platform_test_data)),
  null::jsonb,
  'outsiders cannot read room state'
);
select is(
  (select count(*)::integer from public.rooms where id = (select room_id from pg_temp.platform_test_data)),
  0,
  'row-level security hides rooms from outsiders'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
select public.join_room((select room_code from pg_temp.platform_test_data), 'Challenger');
insert into public.challenges (step_id, claim)
values ((select step_id from pg_temp.platform_test_data limit 1),
        'This step makes an unsupported inference.');

update pg_temp.platform_test_data
set challenge_id = (
  select id from public.challenges
  where step_id = pg_temp.platform_test_data.step_id and author_id = auth.uid()
);
select throws_ok(
  format('select public.settle_challenge(%L::uuid, %L::public.challenge_status)',
    (select challenge_id from pg_temp.platform_test_data), 'upheld'),
  '42501',
  'Host role required',
  'participants cannot settle challenges'
);
select throws_ok(
  format('insert into public.score_events (room_id, challenge_id, user_id, points, reason) values (%L, %L, auth.uid(), 1, %L)',
    (select room_id from pg_temp.platform_test_data),
    (select challenge_id from pg_temp.platform_test_data), 'challenge_upheld'),
  '42501',
  'permission denied for table score_events',
  'participants cannot create score events'
);

reset role;
insert into public.challenges (step_id, author_id, claim)
values ((select step_id from pg_temp.platform_test_data limit 1),
        '90000000-0000-4000-8000-000000000001', 'Host-authored challenge fixture.');
update pg_temp.platform_test_data
set host_challenge_id = (
  select id from public.challenges
  where step_id = pg_temp.platform_test_data.step_id
    and author_id = '90000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select throws_ok(
  format('select public.settle_challenge(%L::uuid, %L::public.challenge_status)',
    (select host_challenge_id from pg_temp.platform_test_data), 'upheld'),
  '42501',
  'A host cannot settle their own challenge',
  'hosts cannot settle their own challenges'
);
select is(
  public.settle_challenge(
    (select challenge_id from pg_temp.platform_test_data),
    'upheld'
  ) ->> 'status',
  'upheld',
  'host verdict settles an open participant challenge'
);
select throws_ok(
  format('select public.settle_challenge(%L::uuid, %L::public.challenge_status)',
    (select challenge_id from pg_temp.platform_test_data), 'upheld'),
  '23505',
  'Challenge already settled',
  'a repeated verdict conflicts'
);
select is(
  (select count(*)::integer from public.score_events
   where challenge_id = (select challenge_id from pg_temp.platform_test_data)),
  1,
  'repeated verdict creates no additional score event'
);

select * from finish();
rollback;
