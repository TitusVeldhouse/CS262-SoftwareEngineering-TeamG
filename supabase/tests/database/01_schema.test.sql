-- =============================================================================
-- Schema contract
-- Checks that the tables, columns, types, and functions the client code relies
-- on exist with the expected shape, and that row-level security is switched on.
-- If one of these fails, a client query against that object would break.
--
-- Run with: npx supabase test db   (see supabase/README.md)
-- Each test file runs inside a transaction that is rolled back at the end, so
-- nothing it does is saved.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- Tables -----------------------------------------------------------------------
select has_table('public', 'campus_map', 'campus_map table exists');
select has_table('public', 'buildings', 'buildings table exists');
select has_table('public', 'floors', 'floors table exists');
select has_table('public', 'rooms', 'rooms table exists');
select has_table('public', 'points_of_interest', 'points_of_interest table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'favorites', 'favorites table exists');

-- Columns the client reads -----------------------------------------------------
select columns_are('public', 'buildings',
  array['id', 'campus_map_id', 'name', 'code', 'aliases', 'campus_x', 'campus_y', 'created_at'],
  'buildings has the expected columns');
select columns_are('public', 'floors',
  array['id', 'building_id', 'level', 'label', 'plan_path', 'plan_width', 'plan_height', 'created_at'],
  'floors has the expected columns');
select columns_are('public', 'rooms',
  array['id', 'floor_id', 'room_number', 'name', 'type', 'aliases', 'x', 'y', 'created_at'],
  'rooms has the expected columns');
select columns_are('public', 'points_of_interest',
  array['id', 'floor_id', 'type', 'label', 'x', 'y', 'created_at'],
  'points_of_interest has the expected columns');
select columns_are('public', 'favorites',
  array['id', 'user_id', 'room_id', 'poi_id', 'created_at'],
  'favorites has the expected columns');

-- Enum values must match what the client sends and displays --------------------
select enum_has_labels('public', 'room_type',
  array['classroom', 'lecture_hall', 'lab', 'office', 'auditorium', 'study',
        'dining', 'restroom', 'facility', 'lounge'],
  'room_type matches the RoomType union in client/src/data/campus-layout.ts');
select enum_has_labels('public', 'poi_type',
  array['restroom', 'printer', 'water_fountain', 'vending_machine', 'elevator', 'other'],
  'poi_type has the expected values');

-- Search -----------------------------------------------------------------------
select has_view('public', 'search_index', 'search_index view exists');
select columns_are('public', 'search_index',
  array['kind', 'id', 'name', 'building_id', 'building_name', 'floor_id',
        'floor_level', 'floor_label', 'search_text'],
  'search_index has the columns the search endpoint maps from');
select has_function('public', 'search_locations', array['text'],
  'search_locations(text) exists');
select function_returns('public', 'search_locations', array['text'], 'setof search_index',
  'search_locations returns rows shaped like search_index');
select ok(
  has_function_privilege('anon', 'public.search_locations(text)', 'execute'),
  'anon (signed-out app) can call search_locations');
select ok(
  has_function_privilege('authenticated', 'public.search_locations(text)', 'execute'),
  'authenticated (signed-in app) can call search_locations');

-- Sign-up trigger ---------------------------------------------------------------
select has_trigger('auth', 'users', 'on_auth_user_created',
  'auth.users has the trigger that creates a profile on sign-up');

-- Row-level security must be on for every table; without it, the anon key
-- would give any app user full access to the table.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.campus_map'::regclass),
  'RLS is enabled on campus_map');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.buildings'::regclass),
  'RLS is enabled on buildings');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.floors'::regclass),
  'RLS is enabled on floors');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rooms'::regclass),
  'RLS is enabled on rooms');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.points_of_interest'::regclass),
  'RLS is enabled on points_of_interest');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.favorites'::regclass),
  'RLS is enabled on favorites');

-- security_invoker makes the view obey the caller's RLS. Without it, the view
-- would run with its owner's rights and skip the policies.
select ok(
  (select 'security_invoker=true' = any (reloptions) from pg_class
   where oid = 'public.search_index'::regclass),
  'search_index runs with the caller''s permissions (security_invoker)');

-- Every table is reachable by the client roles at the privilege level (RLS
-- then narrows it down to the allowed rows).
select ok(
  has_table_privilege('anon', 'public.buildings', 'select')
    and has_table_privilege('authenticated', 'public.favorites', 'select'),
  'client roles have table access that RLS can then filter');

select * from finish();
rollback;
