-- =============================================================================
-- Profiles and favorites, as seen by signed-in app users
-- Creates two test users, Alice and Bob, then acts as each of them (the way
-- the Supabase client does after sign-in) to check that a user can manage
-- their own profile and favorites and cannot touch anyone else's.
-- Uses rows from seed.sql, so run `npx supabase db reset` first.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- Setup (as the database owner) ----------------------------------------------
-- Signing up inserts into auth.users; the trigger should create each profile.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com', '{"display_name": "Alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com', '{}');

select results_eq(
  $$ select display_name from public.profiles
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('Alice'::text) $$,
  'signing up creates a profile with the display name from sign-up');
select results_eq(
  $$ select display_name, settings from public.profiles
     where id = '00000000-0000-0000-0000-0000000000b2' $$,
  $$ values (null::text, '{}'::jsonb) $$,
  'signing up without a display name still creates a profile with empty settings');

-- Give Bob one favorite so we can check Alice cannot see or remove it.
insert into public.favorites (user_id, room_id)
select '00000000-0000-0000-0000-0000000000b2', id from public.rooms where 'HH-211' = any (aliases);

-- Act as Alice ------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

-- Profiles
select results_eq(
  $$ select id::text from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1') $$,
  'Alice sees only her own profile');
select lives_ok(
  $$ update public.profiles set display_name = 'Alice A.', settings = '{"theme": "dark"}'
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'Alice can update her own profile');
select results_eq(
  $$ select display_name, settings ->> 'theme' from public.profiles $$,
  $$ values ('Alice A.'::text, 'dark'::text) $$,
  'Alice''s profile change is saved');
select lives_ok(
  $$ update public.profiles set display_name = 'Hacked'
     where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'Alice''s update of Bob''s profile runs but matches no rows');
select throws_ok(
  $$ update public.profiles set id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'Alice cannot change her profile id to Bob''s');

-- Favorites
select is_empty(
  $$ select * from public.favorites $$,
  'Alice starts with no favorites and cannot see Bob''s');
select lives_ok(
  $$ insert into public.favorites (user_id, room_id)
     select '00000000-0000-0000-0000-0000000000a1', id
     from public.rooms where 'HH-211' = any (aliases) $$,
  'Alice can favorite a room');
select lives_ok(
  $$ insert into public.favorites (user_id, poi_id)
     select '00000000-0000-0000-0000-0000000000a1', id
     from public.points_of_interest where type = 'printer' $$,
  'Alice can favorite a point of interest');

-- Reading the list the way the favorites screen will: joined to the room/POI.
select results_eq(
  $$ select coalesce(r.name, p.label)
     from public.favorites fav
     left join public.rooms r on r.id = fav.room_id
     left join public.points_of_interest p on p.id = fav.poi_id
     order by 1 $$,
  $$ values ('Classroom 211'::text), ('Printer'::text) $$,
  'Alice''s favorite list shows her room and POI');

-- 23505 = unique violation, 23514 = check violation, 23503 = foreign key violation.
select throws_ok(
  $$ insert into public.favorites (user_id, room_id)
     select '00000000-0000-0000-0000-0000000000a1', id
     from public.rooms where 'HH-211' = any (aliases) $$,
  '23505', null,
  'Alice cannot favorite the same room twice');
select throws_ok(
  $$ insert into public.favorites (user_id, poi_id)
     select '00000000-0000-0000-0000-0000000000a1', id
     from public.points_of_interest where type = 'printer' $$,
  '23505', null,
  'Alice cannot favorite the same POI twice');
select throws_ok(
  $$ insert into public.favorites (user_id, room_id, poi_id)
     values ('00000000-0000-0000-0000-0000000000a1',
             (select min(id) from public.rooms),
             (select min(id) from public.points_of_interest)) $$,
  '23514', null,
  'a favorite cannot point at both a room and a POI');
select throws_ok(
  $$ insert into public.favorites (user_id)
     values ('00000000-0000-0000-0000-0000000000a1') $$,
  '23514', null,
  'a favorite must point at a room or a POI');
select throws_ok(
  $$ insert into public.favorites (user_id, room_id)
     values ('00000000-0000-0000-0000-0000000000a1', -1) $$,
  '23503', null,
  'a favorite cannot point at a room that does not exist');
select throws_ok(
  $$ insert into public.favorites (user_id, room_id)
     select '00000000-0000-0000-0000-0000000000b2', id
     from public.rooms where 'SB-110' = any (aliases) $$,
  '42501', null,
  'Alice cannot add a favorite to Bob''s list');
select lives_ok(
  $$ delete from public.favorites where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  'Alice''s delete of Bob''s favorites runs but matches no rows');
select lives_ok(
  $$ delete from public.favorites where poi_id is not null $$,
  'Alice can remove one of her favorites');
select results_eq(
  $$ select count(*)::int from public.favorites $$,
  $$ values (1) $$,
  'Alice has one favorite left after removing one');

-- Act as Bob ----------------------------------------------------------------------
set local request.jwt.claims to
  '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';

select results_eq(
  $$ select r.name from public.favorites fav join public.rooms r on r.id = fav.room_id $$,
  $$ values ('Classroom 211'::text) $$,
  'Bob still has his favorite and does not see Alice''s');
select results_eq(
  $$ select display_name from public.profiles $$,
  $$ values (null::text) $$,
  'Bob''s profile was not changed by Alice');

-- Signed-out app ------------------------------------------------------------------
reset role;
set local role anon;
select is_empty($$ select * from public.profiles $$, 'signed-out users see no profiles');
select is_empty($$ select * from public.favorites $$, 'signed-out users see no favorites');

-- Deleting an account (as the database owner) ------------------------------------
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
select ok(
  not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')
    and not exists (select 1 from public.favorites
                    where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'deleting a user removes their profile and favorites');

select * from finish();
rollback;
