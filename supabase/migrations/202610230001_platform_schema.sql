create extension if not exists pgcrypto with schema extensions;

create type public.room_status as enum ('open', 'closed');
create type public.room_role as enum ('host', 'participant');
create type public.challenge_status as enum ('open', 'upheld', 'rejected');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  subject text,
  topic text,
  host_id uuid not null references auth.users (id) on delete restrict,
  status public.room_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.room_memberships (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  role public.room_role not null,
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  prompt text not null check (length(trim(prompt)) between 1 and 4000),
  source text check (source is null or length(source) <= 120),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table public.solution_steps (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  position integer not null check (position > 0),
  content text not null check (length(trim(content)) between 1 and 4000),
  unique (case_id, position)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.solution_steps (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  claim text not null check (length(trim(claim)) between 10 and 2000),
  correction text check (correction is null or length(correction) <= 2000),
  verification text check (verification is null or length(verification) <= 2000),
  status public.challenge_status not null default 'open',
  settled_by uuid references auth.users (id) on delete restrict,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'open' and settled_by is null and settled_at is null)
      or (status <> 'open' and settled_by is not null and settled_at is not null))
);

create table public.defences (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (challenge_id, author_id)
);

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  points integer not null check (points > 0),
  reason text not null check (reason in ('challenge_upheld', 'challenge_rejected')),
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index cases_room_created_idx on public.cases (room_id, created_at desc);
create index challenges_step_created_idx on public.challenges (step_id, created_at);
create index score_events_room_user_idx on public.score_events (room_id, user_id);

create function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_memberships m
    where m.room_id = p_room_id and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

alter table public.rooms enable row level security;
alter table public.room_memberships enable row level security;
alter table public.cases enable row level security;
alter table public.solution_steps enable row level security;
alter table public.challenges enable row level security;
alter table public.defences enable row level security;
alter table public.score_events enable row level security;

create policy "members read their rooms" on public.rooms
  for select to authenticated using (public.is_room_member(id));
create policy "members read room memberships" on public.room_memberships
  for select to authenticated using (public.is_room_member(room_id));
create policy "members read cases" on public.cases
  for select to authenticated using (public.is_room_member(room_id));
create policy "members read solution steps" on public.solution_steps
  for select to authenticated using (
    exists (select 1 from public.cases c where c.id = case_id and public.is_room_member(c.room_id))
  );
create policy "members read challenges" on public.challenges
  for select to authenticated using (
    exists (
      select 1 from public.solution_steps s
      join public.cases c on c.id = s.case_id
      where s.id = step_id and public.is_room_member(c.room_id)
    )
  );
create policy "participants create challenges" on public.challenges
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.solution_steps s
      join public.cases c on c.id = s.case_id
      join public.room_memberships m on m.room_id = c.room_id
      where s.id = step_id and m.user_id = (select auth.uid())
        and m.role = 'participant' and c.author_id <> (select auth.uid())
        and c.status = 'open'
    )
    and status = 'open' and settled_by is null and settled_at is null
  );
create policy "members read defences" on public.defences
  for select to authenticated using (
    exists (
      select 1 from public.challenges ch
      join public.solution_steps s on s.id = ch.step_id
      join public.cases c on c.id = s.case_id
      where ch.id = challenge_id and public.is_room_member(c.room_id)
    )
  );
create policy "case authors defend challenges" on public.defences
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.challenges ch
      join public.solution_steps s on s.id = ch.step_id
      join public.cases c on c.id = s.case_id
      join public.room_memberships m on m.room_id = c.room_id
      where ch.id = challenge_id and c.author_id = (select auth.uid())
        and m.user_id = (select auth.uid()) and ch.status = 'open'
    )
  );
create policy "members read score events" on public.score_events
  for select to authenticated using (public.is_room_member(room_id));

revoke all on public.rooms, public.room_memberships, public.cases, public.solution_steps,
  public.challenges, public.defences, public.score_events from anon, authenticated;
grant select on public.rooms, public.room_memberships, public.cases, public.solution_steps,
  public.challenges, public.defences, public.score_events to authenticated;
grant insert on public.challenges, public.defences to authenticated;

create function public.generate_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    select string_agg(substr(alphabet, (get_byte(random_bytes.bytes, byte_index) % length(alphabet)) + 1, 1), '')
      into candidate
      from extensions.gen_random_bytes(6) as random_bytes(bytes)
      cross join generate_series(0, 5) as indexes(byte_index);
    exit when not exists (select 1 from public.rooms where code = candidate);
  end loop;
  return candidate;
end;
$$;

create function public.create_room(
  p_name text,
  p_display_name text,
  p_subject text default null,
  p_topic text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  created_room public.rooms;
begin
  if actor is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80
     or length(trim(coalesce(p_display_name, ''))) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'Invalid room or display name';
  end if;

  insert into public.rooms (code, name, subject, topic, host_id)
  values (public.generate_room_code(), trim(p_name), nullif(trim(p_subject), ''),
          nullif(trim(p_topic), ''), actor)
  returning * into created_room;
  insert into public.room_memberships (room_id, user_id, role, display_name)
  values (created_room.id, actor, 'host', trim(p_display_name));

  return jsonb_build_object('id', created_room.id, 'code', created_room.code,
    'name', created_room.name, 'subject', created_room.subject, 'topic', created_room.topic,
    'status', created_room.status, 'role', 'host');
end;
$$;

create function public.join_room(p_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.rooms;
  actor_role public.room_role;
begin
  if actor is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'Invalid display name';
  end if;
  select * into target from public.rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or target.status <> 'open' then
    raise exception using errcode = 'P0002', message = 'Room not found or closed';
  end if;
  insert into public.room_memberships (room_id, user_id, role, display_name)
  values (target.id, actor, 'participant', trim(p_display_name))
  on conflict (room_id, user_id) do update set display_name = excluded.display_name
  returning role into actor_role;

  return jsonb_build_object('id', target.id, 'code', target.code, 'name', target.name,
    'subject', target.subject, 'topic', target.topic, 'status', target.status, 'role', actor_role);
end;
$$;

create function public.get_room_state(p_room_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  room_row public.rooms;
  payload jsonb;
begin
  select * into room_row from public.rooms where id = p_room_id;
  if not found then return null; end if;

  select jsonb_build_object(
    'id', room_row.id, 'code', room_row.code, 'name', room_row.name,
    'subject', room_row.subject, 'topic', room_row.topic, 'status', room_row.status,
    'role', (select m.role from public.room_memberships m
      where m.room_id = room_row.id and m.user_id = (select auth.uid())),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('userId', m.user_id, 'displayName', m.display_name,
        'role', m.role) order by m.joined_at)
      from public.room_memberships m where m.room_id = room_row.id
    ), '[]'::jsonb),
    'cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'authorId', c.author_id, 'authorName', member.display_name,
        'prompt', c.prompt, 'source', c.source, 'status', c.status, 'createdAt', c.created_at,
        'steps', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'content', s.content,
            'challenges', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', ch.id, 'authorId', ch.author_id, 'authorName', challenge_author.display_name,
                'claim', ch.claim, 'correction', ch.correction, 'verification', ch.verification,
                'status', ch.status, 'createdAt', ch.created_at,
                'defences', coalesce((
                  select jsonb_agg(jsonb_build_object('id', d.id, 'authorId', d.author_id,
                    'authorName', defence_author.display_name, 'body', d.body, 'createdAt', d.created_at)
                    order by d.created_at)
                  from public.defences d
                  join public.room_memberships defence_author
                    on defence_author.room_id = room_row.id and defence_author.user_id = d.author_id
                  where d.challenge_id = ch.id
                ), '[]'::jsonb)
              ) order by ch.created_at)
              from public.challenges ch
              join public.room_memberships challenge_author
                on challenge_author.room_id = room_row.id and challenge_author.user_id = ch.author_id
              where ch.step_id = s.id
            ), '[]'::jsonb)
          ) order by s.position)
          from public.solution_steps s where s.case_id = c.id
        ), '[]'::jsonb)
      ) order by c.created_at desc)
      from public.cases c
      join public.room_memberships member on member.room_id = room_row.id and member.user_id = c.author_id
      where c.room_id = room_row.id
    ), '[]'::jsonb),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('userId', m.user_id, 'displayName', m.display_name,
        'role', m.role, 'points', coalesce(scores.points, 0))
        order by coalesce(scores.points, 0) desc, m.joined_at)
      from public.room_memberships m
      left join (
        select user_id, sum(points)::integer as points from public.score_events
        where room_id = room_row.id group by user_id
      ) scores on scores.user_id = m.user_id
      where m.room_id = room_row.id and m.role = 'participant'
    ), '[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;

create function public.submit_case(
  p_room_id uuid,
  p_prompt text,
  p_steps jsonb,
  p_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  created_case uuid;
  step_row record;
  step_position integer := 0;
begin
  if actor is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if length(trim(coalesce(p_prompt, ''))) not between 1 and 4000
     or length(coalesce(p_source, '')) > 120
     or coalesce(jsonb_typeof(p_steps), '') <> 'array' then
    raise exception using errcode = '22023', message = 'Invalid case or steps';
  end if;
  if jsonb_array_length(p_steps) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Invalid case or steps';
  end if;
  if not exists (
    select 1 from public.room_memberships m join public.rooms r on r.id = m.room_id
    where m.room_id = p_room_id and m.user_id = actor and r.status = 'open'
  ) then raise exception using errcode = '42501', message = 'Room membership required'; end if;

  insert into public.cases (room_id, author_id, prompt, source)
  values (p_room_id, actor, trim(p_prompt), nullif(trim(p_source), ''))
  returning id into created_case;
  for step_row in select value from jsonb_array_elements(p_steps) loop
    step_position := step_position + 1;
    if jsonb_typeof(step_row.value) <> 'object'
       or length(trim(coalesce(step_row.value ->> 'content', ''))) not between 1 and 4000 then
      raise exception using errcode = '22023', message = 'Invalid solution step';
    end if;
    insert into public.solution_steps (case_id, position, content)
    values (created_case, step_position, trim(step_row.value ->> 'content'));
  end loop;
  return created_case;
end;
$$;

create function public.settle_challenge(p_challenge_id uuid, p_verdict public.challenge_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  challenge_row public.challenges;
  room_id uuid;
  case_author uuid;
  winner uuid;
  awarded integer := 0;
begin
  if actor is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if p_verdict is null or p_verdict not in ('upheld', 'rejected') then
    raise exception using errcode = '22023', message = 'Verdict must be upheld or rejected';
  end if;

  select ch.* into challenge_row
    from public.challenges ch
    where ch.id = p_challenge_id
    for update;
  if not found then raise exception using errcode = 'P0002', message = 'Challenge not found'; end if;
  select c.room_id, c.author_id into room_id, case_author
    from public.challenges ch
    join public.solution_steps s on s.id = ch.step_id
    join public.cases c on c.id = s.case_id
    where ch.id = p_challenge_id;
  if not exists (
    select 1 from public.room_memberships m
    where m.room_id = room_id and m.user_id = actor and m.role = 'host'
  ) then raise exception using errcode = '42501', message = 'Host role required'; end if;
  if challenge_row.author_id = actor then
    raise exception using errcode = '42501', message = 'A host cannot settle their own challenge';
  end if;
  if challenge_row.status <> 'open' then
    raise exception using errcode = '23505', message = 'Challenge already settled';
  end if;

  update public.challenges set status = p_verdict, settled_by = actor, settled_at = now()
    where id = p_challenge_id;
  winner := case when p_verdict = 'upheld' then challenge_row.author_id else case_author end;
  if exists (
    select 1 from public.room_memberships m
    where m.room_id = room_id and m.user_id = winner and m.role = 'participant'
  ) then
    awarded := case when p_verdict = 'upheld' then 5 else 2 end;
    insert into public.score_events (room_id, challenge_id, user_id, points, reason)
    values (room_id, p_challenge_id, winner, awarded,
      case when p_verdict = 'upheld' then 'challenge_upheld' else 'challenge_rejected' end);
  end if;
  return jsonb_build_object('challengeId', p_challenge_id, 'status', p_verdict,
    'pointsAwarded', awarded, 'winnerId', case when awarded > 0 then winner else null end);
end;
$$;

create function public.prevent_score_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Score events are append-only';
end;
$$;

create trigger score_events_append_only
  before update or delete on public.score_events
  for each row execute function public.prevent_score_event_mutation();

revoke all on function public.generate_room_code() from public, anon, authenticated;
revoke all on function public.create_room(text, text, text, text) from public, anon;
revoke all on function public.join_room(text, text) from public, anon;
revoke all on function public.get_room_state(uuid) from public, anon;
revoke all on function public.submit_case(uuid, text, jsonb, text) from public, anon;
revoke all on function public.settle_challenge(uuid, public.challenge_status) from public, anon;
revoke all on function public.prevent_score_event_mutation() from public, anon, authenticated;
grant execute on function public.create_room(text, text, text, text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.get_room_state(uuid) to authenticated;
grant execute on function public.submit_case(uuid, text, jsonb, text) to authenticated;
grant execute on function public.settle_challenge(uuid, public.challenge_status) to authenticated;
