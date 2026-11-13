-- Migration 0002: Transfigure Peet's Coffee & Study Lounge to Hekman Library Level 2
-- Because public.favorites references rooms(id) by foreign key, updating the room's
-- floor_id here automatically updates every user's favorite record without data corruption.

do $$
declare
  v_building_id bigint;
  v_floor_2_id bigint;
begin
  -- 1. Find Hekman Library building ID
  select id into v_building_id
  from public.buildings
  where code = 'HL' or name = 'Hekman Library'
  limit 1;

  if v_building_id is not null then
    -- 2. Find or ensure Level 2 floor exists
    select id into v_floor_2_id
    from public.floors
    where building_id = v_building_id and level = 2
    limit 1;

    -- 3. Transfigure the room to point to Level 2
    if v_floor_2_id is not null then
      update public.rooms
      set
        floor_id = v_floor_2_id,
        room_number = '205'
      where client_room_id = 'HEK-CAFE';
    end if;
  end if;
end $$;
