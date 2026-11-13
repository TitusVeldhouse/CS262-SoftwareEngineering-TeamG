-- =============================================================================
-- Search
-- Calls search_locations(q) as the signed-out app would (the anon role), the
-- same call the client makes with supabase.rpc('search_locations', { q }).
-- Uses rows from seed.sql, so run `npx supabase db reset` first.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

set local role anon;

select results_eq(
  $$ select kind, name, building_name from public.search_locations('hiemenga') $$,
  $$ values ('building'::text, 'Hiemenga Hall'::text, 'Hiemenga Hall'::text) $$,
  'searching a building name returns that building');

select results_eq(
  $$ select kind, name, building_name, floor_level, floor_label
     from public.search_locations('printer') $$,
  $$ values ('poi'::text, 'Printer'::text, 'Hekman Library'::text, 3, 'Level 3'::text) $$,
  'searching a POI type returns the POI with its building and floor');

select results_eq(
  $$ select kind, name, building_name, floor_level from public.search_locations('HH-211') $$,
  $$ values ('room'::text, 'Classroom 211'::text, 'Hiemenga Hall'::text, 2) $$,
  'searching a room id returns that room with its building and floor');

select results_eq(
  $$ select kind, name from public.search_locations('HiEmEnGa') $$,
  $$ values ('building'::text, 'Hiemenga Hall'::text) $$,
  'search ignores upper/lower case');

select results_eq(
  $$ select kind, name from public.search_locations('  hiemenga  ') $$,
  $$ values ('building'::text, 'Hiemenga Hall'::text) $$,
  'search ignores spaces around the query');

select results_eq(
  $$ select name from public.search_locations('spoelhof center') $$,
  $$ values ('Spoelhof University Center'::text) $$,
  'search matches a building alias and returns the canonical name');

select results_eq(
  $$ select kind, name from public.search_locations('water fountain') $$,
  $$ values ('poi'::text, 'Water Fountain'::text) $$,
  'search matches a POI type written with a space instead of an underscore');

-- "science" matches buildings and a room; buildings must come first.
select results_eq(
  $$ select kind, name from public.search_locations('science') $$,
  $$ values ('building'::text, 'Science Building'::text),
            ('building', 'Science Power Plant'),
            ('room', 'Science Lecture Hall 110') $$,
  'results are ordered buildings, then rooms, then POIs, then by name');

select is_empty(
  $$ select * from public.search_locations('') $$,
  'an empty query returns nothing');
select is_empty(
  $$ select * from public.search_locations('   ') $$,
  'a blank query returns nothing');
select is_empty(
  $$ select * from public.search_locations(null) $$,
  'a missing query returns nothing');

-- % and _ are wildcards in SQL LIKE; search must treat them as plain text.
select is_empty(
  $$ select * from public.search_locations('%') $$,
  'a % in the query is not treated as a wildcard');

-- The seed has well over 50 names containing "e", so this hits the cap.
select is(
  (select count(*)::int from public.search_locations('e')), 50,
  'results are capped at 50 rows');

select * from finish();
rollback;
