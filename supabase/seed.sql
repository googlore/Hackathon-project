insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'demo-host@example.invalid', '', now(), '{"provider":"anonymous","providers":["anonymous"]}',
   '{"is_anonymous":true}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'demo-participant@example.invalid', '', now(), '{"provider":"anonymous","providers":["anonymous"]}',
   '{"is_anonymous":true}', now(), now())
on conflict (id) do nothing;

insert into public.rooms (id, code, name, subject, topic, host_id)
values ('20000000-0000-4000-8000-000000000001', 'DEMA42', 'Proof Lab', 'A-level Mathematics',
        'Inequalities', '10000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.room_memberships (room_id, user_id, role, display_name)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'host', 'Demo Host'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'participant', 'Nadia')
on conflict (room_id, user_id) do nothing;

insert into public.cases (id, room_id, author_id, prompt, source)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        'If abc = 1, prove that a + b + c > 1/a + 1/b + 1/c.', 'Gemini')
on conflict (id) do nothing;

insert into public.solution_steps (id, case_id, position, content)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1,
   'Since abc = 1, we may write c = 1/(ab).'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 2,
   'Therefore a + b + c is always greater than 1/a + 1/b + 1/c.')
on conflict (id) do nothing;
