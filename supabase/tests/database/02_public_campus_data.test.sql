-- =============================================================================
-- Public campus data, as seen by the app
-- Acts as the "anon" role (a signed-out app user holding the public anon key)
-- and the "authenticated" role (a signed-in user), and checks that both can
-- read the campus data but cannot change it.
--
-- The read checks use rows from seed.sql, so run `npx supabase db reset`
-- before `npx supabase test db`.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Act as a signed-out app user for the rest of this section.
set local role anon;

-- Reading ----------------------------------------------------------------------
select ok((select count(*) from public.campus_map) = 1, 'anon can read the campus map');
select ok((select count(*) from public.buildings) > 0, 'anon can read buildings');
select ok((select count(*) from public.floors) > 0, 'anon can read floors');
select ok((select count(*) from public.rooms) > 0, 'anon can read rooms');
select ok((select count(*) from public.points_of_interest) > 0, 'anon can read points of interest');

-- Joined reads like the ones the building and floor screens will make.
select results_eq(
  $$ select b.code, b.campus_x, b.campus_y from public.buildings b where b.name = 'Hiemenga Hall' $$,
  $$ values ('HH'::text, 28.30::numeric, 64.10::numeric) $$,
  'anon gets a building''s code and campus map position');
select results_eq(
  $$ select f.level, f.label from public.floors f
     join public.buildings b on b.id = f.building_id
     where b.name = 'Hiemenga Hall' order by f.level $$,
  $$ values (2, 'Level 2'::text), (3, 'Level 3'), (4, 'Level 4') $$,
  'anon gets a building''s floors in level order');
select results_eq(
  $$ select r.name, r.type::text, r.x, r.y from public.rooms r
     where 'HH-211' = any (r.aliases) $$,
  $$ values ('Classroom 211'::text, 'classroom'::text, 450::numeric, 380::numeric) $$,
  'anon gets a room''s details and floor plan position');
select results_eq(
  $$ select p.type::text, b.name, f.level from public.points_of_interest p
     join public.floors f on f.id = p.floor_id
     join public.buildings b on b.id = f.building_id
     where p.type = 'printer' $$,
  $$ values ('printer'::text, 'Hekman Library'::text, 3) $$,
  'anon gets a POI with its building and floor');

-- Writing (all must be blocked) -------------------------------------------------
-- 42501 is Postgres' "insufficient privilege" error, which is what a blocked
-- insert returns under row-level security.
select throws_ok(
  $$ insert into public.buildings (campus_map_id, name)
     values ((select id from public.campus_map limit 1), 'Fake Hall') $$,
  '42501', null,
  'anon cannot add a building');
select throws_ok(
  $$ insert into public.rooms (floor_id, room_number)
     values ((select id from public.floors limit 1), '999') $$,
  '42501', null,
  'anon cannot add a room');

-- Updates and deletes do not raise an error under RLS; they just match no rows.
-- So run them, then check (as the database owner) that nothing changed.
select lives_ok(
  $$ update public.buildings set name = 'Renamed' where name = 'Chapel' $$,
  'anon update of a building runs without changing anything');
select lives_ok(
  $$ delete from public.rooms $$,
  'anon delete of rooms runs without removing anything');

-- Act as a signed-in user and try the same.
reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select ok((select count(*) from public.buildings) > 0, 'signed-in users can read buildings');
select throws_ok(
  $$ insert into public.points_of_interest (floor_id, type, label)
     values ((select id from public.floors limit 1), 'printer', 'Fake Printer') $$,
  '42501', null,
  'signed-in users cannot add a point of interest');
select lives_ok(
  $$ update public.floors set label = 'Hacked' $$,
  'signed-in update of floors runs without changing anything');

-- Back to the database owner to confirm none of the writes above took effect.
reset role;
select ok(
  (select count(*) from public.buildings where name = 'Chapel') = 1
    and (select count(*) from public.buildings where name in ('Renamed', 'Fake Hall')) = 0
    and (select count(*) from public.floors where label = 'Hacked') = 0
    and (select count(*) from public.rooms) > 0,
  'no write made by an app user changed the campus data');

select * from finish();
rollback;
