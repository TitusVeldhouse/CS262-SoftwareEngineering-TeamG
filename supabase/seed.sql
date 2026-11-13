-- =============================================================================
-- CalvinFinder seed data
-- =============================================================================
-- GENERATED FILE: do not edit by hand.
-- Regenerate with:  node supabase/scripts/generate-seed.mjs
--
-- Runs after the migration on an empty database (supabase db reset does this).
-- Rows are linked by natural keys (building name, floor level), never by
-- hard-coded ids, so the auto-numbered ids can be anything.
--
-- Import notes:
--   * Building name cleaned: "Spoelhof Fieldhouse Complex," -> "Spoelhof Fieldhouse Complex".
--   * Skipped "Overall Map" for "Spoelhof Fieldhouse Complex": it is an overview image, not a floor.
--   * "Service Building" Storage Loft stored as level 2 (one above its top level).
--   * Building "Spoelhof Fieldhouse Complex" has no floors (its only manifest image was skipped).


-- Campus map ------------------------------------------------------------------
insert into public.campus_map (name, image_path, width, height) values
  ('Calvin University Campus Map', 'campus-map.png', 2479, 1944);


-- Buildings -------------------------------------------------------------------
insert into public.buildings (campus_map_id, name, code, aliases, campus_x, campus_y)
select cm.id, v.name, v.code, v.aliases, v.campus_x, v.campus_y
from (values
  ('Bunker Interpretive Center', 'BIC', array[]::text[], null::numeric, null::numeric),
  ('Bunker Interpretive Center Potting Shed', null, array[]::text[], null::numeric, null::numeric),
  ('Calvin Crossings', null, array[]::text[], null::numeric, null::numeric),
  ('Chapel', 'CHP', array[]::text[], 27.4::numeric, 66.5::numeric),
  ('Commons', 'COM', array[]::text[], 32.8::numeric, 56.5::numeric),
  ('Commons Annex', null, array[]::text[], 32.5::numeric, 58.7::numeric),
  ('Covenant Fine Arts Center', 'CFAC', array[]::text[], 37.4::numeric, 58.1::numeric),
  ('DC AND BU', null, array[]::text[], null::numeric, null::numeric),
  ('De Wit Manor', null, array[]::text[], null::numeric, null::numeric),
  ('Devos Communication Center', 'DCC', array['Devos Communication Building']::text[], 46.6::numeric, 61.8::numeric),
  ('Devries Hall', null, array[]::text[], 23.5::numeric, 55::numeric),
  ('Ecosystem Storage Shed', null, array[]::text[], null::numeric, null::numeric),
  ('Engineering Building', null, array[]::text[], null::numeric, null::numeric),
  ('Football Building', null, array[]::text[], null::numeric, null::numeric),
  ('Gainey Fields Concessions Building', null, array[]::text[], null::numeric, null::numeric),
  ('Hekman Library', 'HEK', array[]::text[], 31.2::numeric, 62.3::numeric),
  ('Hiemenga Hall', 'HH', array[]::text[], 28.3::numeric, 64.1::numeric),
  ('Hoogenboom Health & Recreation Center', null, array[]::text[], null::numeric, null::numeric),
  ('Huizenga Tennis & Track Center', null, array[]::text[], null::numeric, null::numeric),
  ('Knollcrest Dining Hall', null, array[]::text[], null::numeric, null::numeric),
  ('Mail & Print Building', null, array[]::text[], null::numeric, null::numeric),
  ('North Hall', null, array[]::text[], 26.6::numeric, 51.8::numeric),
  ('Prince Conference Center', null, array[]::text[], null::numeric, null::numeric),
  ('Prince Lodging', null, array[]::text[], null::numeric, null::numeric),
  ('Ravenswood', null, array[]::text[], null::numeric, null::numeric),
  ('Raybrook Building', null, array[]::text[], null::numeric, null::numeric),
  ('School of Business', null, array[]::text[], null::numeric, null::numeric),
  ('Science Building', 'SB', array[]::text[], 25.7::numeric, 54.6::numeric),
  ('Science Power Plant', null, array[]::text[], null::numeric, null::numeric),
  ('Service Building', null, array[]::text[], null::numeric, null::numeric),
  ('Soccer Stadium', null, array[]::text[], null::numeric, null::numeric),
  ('Spoelhof Fieldhouse', 'SFH', array['Fieldhouse']::text[], 23.8::numeric, 39.7::numeric),
  ('Spoelhof Fieldhouse Complex', null, array[]::text[], null::numeric, null::numeric),
  ('Spoelhof University Center', 'SUC', array['Spoelhof Center']::text[], 24.2::numeric, 63.3::numeric),
  ('Van Noord Arena', null, array[]::text[], null::numeric, null::numeric),
  ('Venema Aquatic Center', null, array[]::text[], null::numeric, null::numeric)
) as v (name, code, aliases, campus_x, campus_y)
join public.campus_map cm on cm.name = 'Calvin University Campus Map';


-- Floors ----------------------------------------------------------------------
insert into public.floors (building_id, level, label, plan_path, plan_width, plan_height)
select b.id, v.level, v.label, v.plan_path, v.plan_width, v.plan_height
from (values
  ('Bunker Interpretive Center', 1, 'Level 1', 'academic-auxiliary/Bunker Interpretive Center level 1.png', 1570, 1035),
  ('Bunker Interpretive Center Potting Shed', 1, 'Level 1', 'academic-auxiliary/Bunker Interpretive Center Potting Shed level 1.png', 1512, 922),
  ('Calvin Crossings', 1, 'Level 1', 'academic-auxiliary/Calvin Crossings level 1.png', 1547, 801),
  ('Calvin Crossings', 2, 'Level 2', 'academic-auxiliary/Calvin Crossings level 2.png', 1570, 733),
  ('Chapel', 1, 'Level 1', 'academic-auxiliary/Chapel level 1.png', 1416, 1064),
  ('Chapel', 2, 'Level 2', 'academic-auxiliary/Chapel level 2.png', 1134, 1060),
  ('Chapel', 3, 'Level 3', 'academic-auxiliary/Chapel level 3.png', 1063, 1064),
  ('Commons', 1, 'Level 1', 'academic-auxiliary/Commons level 1.png', 1570, 996),
  ('Commons', 2, 'Level 2', 'academic-auxiliary/Commons level 2.png', 1262, 1064),
  ('Commons', 3, 'Level 3', 'academic-auxiliary/Commons level 3.png', 1393, 1059),
  ('Commons Annex', 0, 'Level 0', 'academic-auxiliary/Commons Annex level 0.png', 1528, 826),
  ('Commons Annex', 1, 'Level 1', 'academic-auxiliary/Commons Annex level 1.png', 1570, 836),
  ('Commons Annex', 2, 'Level 2', 'academic-auxiliary/Commons Annex level 2.png', 1570, 890),
  ('Covenant Fine Arts Center', 0, 'Level 0', 'academic-auxiliary/Covenant Fine Arts Center level 0.png', 1262, 1064),
  ('Covenant Fine Arts Center', 1, 'Level 1', 'academic-auxiliary/Covenant Fine Arts Center level 1.png', 1351, 1064),
  ('Covenant Fine Arts Center', 2, 'Level 2', 'academic-auxiliary/Covenant Fine Arts Center level 2.png', 1327, 1064),
  ('Covenant Fine Arts Center', 3, 'Level 3', 'academic-auxiliary/Covenant Fine Arts Center level 3.png', 1253, 978),
  ('DC AND BU', 0, 'Level 0', 'academic-auxiliary/DC AND BU LEVEL 0.png', 1982, 1378),
  ('DC AND BU', 1, 'Level 1', 'academic-auxiliary/DC AND BU LEVEL 1.png', 1970, 1363),
  ('DC AND BU', 2, 'Level 2', 'academic-auxiliary/DC AND BU LEVEL 2.png', 1344, 1064),
  ('De Wit Manor', 0, 'Level 0', 'academic-auxiliary/De Wit Manor level 0.png', 1316, 1028),
  ('De Wit Manor', 1, 'Level 1', 'academic-auxiliary/De Wit Manor level 1.png', 1283, 1015),
  ('De Wit Manor', 2, 'Level 2', 'academic-auxiliary/De Wit Manor level 2.png', 1116, 949),
  ('Devos Communication Center', 0, 'Level 0', 'academic-auxiliary/Devos Communication Center level 0.png', 1570, 947),
  ('Devos Communication Center', 1, 'Level 1', 'academic-auxiliary/Devos Communication Center level 1.png', 1570, 758),
  ('Devos Communication Center', 2, 'Level 2', 'academic-auxiliary/Devos Communication Center level 2.png', 1570, 815),
  ('Devos Communication Center', 3, 'Level 3', 'academic-auxiliary/Devos Communication Center level 3.png', 1449, 701),
  ('Devries Hall', 0, 'Level 0', 'academic-auxiliary/Devries Hall level 0.png', 1295, 1064),
  ('Devries Hall', 1, 'Level 1', 'academic-auxiliary/Devries Hall level 1.png', 1348, 1064),
  ('Devries Hall', 2, 'Level 2', 'academic-auxiliary/Devries Hall level 2.png', 1570, 1064),
  ('Devries Hall', 3, 'Level 3', 'academic-auxiliary/Devries Hall level 3.png', 1570, 1036),
  ('Devries Hall', 4, 'Level 4', 'academic-auxiliary/Devries Hall level 4.png', 1451, 1064),
  ('Ecosystem Storage Shed', 1, 'Level 1', 'academic-auxiliary/Ecosystem Storage Shed level 1.png', 1448, 598),
  ('Engineering Building', 1, 'Level 1', 'academic-auxiliary/Engineering Building level 1.png', 1548, 938),
  ('Engineering Building', 2, 'Level 2', 'academic-auxiliary/Engineering Building level 2.png', 1533, 926),
  ('Football Building', 1, 'Level 1', 'academic-auxiliary/Football Building level 1.png', 1526, 687),
  ('Gainey Fields Concessions Building', 1, 'Level 1', 'academic-auxiliary/Gainey Fields Concessions Building level 1.png', 1317, 858),
  ('Hekman Library', 1, 'Level 1', 'academic-auxiliary/Hekman Library level 1.png', 1167, 1052),
  ('Hekman Library', 2, 'Level 2', 'academic-auxiliary/Hekman Library level 2.png', 1193, 1064),
  ('Hekman Library', 3, 'Level 3', 'academic-auxiliary/Hekman Library level 3.png', 1311, 1062),
  ('Hekman Library', 4, 'Level 4', 'academic-auxiliary/Hekman Library level 4.png', 1517, 1054),
  ('Hekman Library', 5, 'Level 5', 'academic-auxiliary/Hekman Library level 5.png', 1071, 1059),
  ('Hiemenga Hall', 2, 'Level 2', 'academic-auxiliary/Hiemenga Hall level 2.png', 1287, 1058),
  ('Hiemenga Hall', 3, 'Level 3', 'academic-auxiliary/Hiemenga Hall level 3.png', 1357, 1064),
  ('Hiemenga Hall', 4, 'Level 4', 'academic-auxiliary/Hiemenga Hall level 4.png', 1227, 1058),
  ('Hoogenboom Health & Recreation Center', 1, 'Level 1', 'academic-auxiliary/Hoogenboom Health & Recreation Center level 1.png', 1049, 1064),
  ('Hoogenboom Health & Recreation Center', 2, 'Level 2', 'academic-auxiliary/Hoogenboom Health & Recreation Center level 2.png', 921, 1041),
  ('Hoogenboom Health & Recreation Center', 3, 'Level 3', 'academic-auxiliary/Hoogenboom Health & Recreation Center level 3.png', 1100, 1009),
  ('Huizenga Tennis & Track Center', 1, 'Level 1', 'academic-auxiliary/Huizenga Tennis & Track Center level 1.png', 1526, 1015),
  ('Huizenga Tennis & Track Center', 2, 'Level 2', 'academic-auxiliary/Huizenga Tennis & Track Center level 2.png', 1502, 978),
  ('Knollcrest Dining Hall', 1, 'Level 1', 'academic-auxiliary/Knollcrest Dining Hall level 1.png', 1067, 1039),
  ('Mail & Print Building', 1, 'Level 1', 'academic-auxiliary/Mail & Print Building level 1.png', 1566, 845),
  ('Mail & Print Building', 2, 'Level 2', 'academic-auxiliary/Mail & Print Building level 2.png', 1551, 794),
  ('North Hall', 0, 'Level 0', 'academic-auxiliary/North Hall level 0.png', 1564, 833),
  ('North Hall', 1, 'Level 1', 'academic-auxiliary/North Hall level 1.png', 1557, 787),
  ('North Hall', 2, 'Level 2', 'academic-auxiliary/North Hall level 2.png', 1567, 738),
  ('Prince Conference Center', 1, 'Level 1', 'academic-auxiliary/Prince Conference Center level 1.png', 1319, 1064),
  ('Prince Conference Center', 2, 'Level 2', 'academic-auxiliary/Prince Conference Center level 2.png', 1252, 853),
  ('Prince Lodging', 1, 'Level 1', 'academic-auxiliary/Prince Lodging level 1.png', 1478, 666),
  ('Prince Lodging', 2, 'Level 2', 'academic-auxiliary/Prince Lodging level 2.png', 1473, 768),
  ('Prince Lodging', 3, 'Level 3', 'academic-auxiliary/Prince Lodging level 3.png', 1474, 658),
  ('Ravenswood', 0, 'Level 0', 'academic-auxiliary/Ravenswood level 0.png', 1390, 951),
  ('Ravenswood', 1, 'Level 1', 'academic-auxiliary/Ravenswood level 1.png', 1360, 939),
  ('Ravenswood', 2, 'Level 2', 'academic-auxiliary/Ravenswood level 2.png', 903, 657),
  ('Raybrook Building', 1, 'Level 1', 'academic-auxiliary/Raybrook Building level 1.png', 1282, 1007),
  ('Raybrook Building', 2, 'Level 2', 'academic-auxiliary/Raybrook Building level 2.png', 1283, 1009),
  ('School of Business', 0, 'Level 0', 'academic-auxiliary/School of Business level 0.png', 1070, 1064),
  ('School of Business', 1, 'Level 1', 'academic-auxiliary/School of Business level 1.png', 1028, 1036),
  ('School of Business', 2, 'Level 2', 'academic-auxiliary/School of Business level 2.png', 1028, 1042),
  ('Science Building', -1, 'Sub-Basement', 'academic-auxiliary/Science Building sub-basement.png', 974, 784),
  ('Science Building', 0, 'Level 0', 'academic-auxiliary/Science Building level 0.png', 1494, 1064),
  ('Science Building', 1, 'Level 1', 'academic-auxiliary/Science Building level 1.png', 1519, 1064),
  ('Science Building', 2, 'Level 2', 'academic-auxiliary/Science Building level 2.png', 1321, 1064),
  ('Science Building', 3, 'Level 3', 'academic-auxiliary/Science Building level 3.png', 1325, 1064),
  ('Science Building', 4, 'Level 4', 'academic-auxiliary/Science Building level 4.png', 781, 742),
  ('Science Power Plant', 1, 'Level 1', 'academic-auxiliary/Science Power Plant level 1.png', 1558, 817),
  ('Service Building', 1, 'Level 1', 'academic-auxiliary/Service Building level 1.png', 1523, 1056),
  ('Service Building', 2, 'Storage Loft', 'academic-auxiliary/Service Building storage loft.png', 1328, 965),
  ('Soccer Stadium', 1, 'Level 1', 'academic-auxiliary/Soccer Stadium level 1.png', 1570, 740),
  ('Soccer Stadium', 2, 'Level 2', 'academic-auxiliary/Soccer Stadium level 2.png', 1570, 563),
  ('Spoelhof Fieldhouse', 0, 'Level 0', 'academic-auxiliary/Spoelhof Fieldhouse level 0.png', 980, 1005),
  ('Spoelhof Fieldhouse', 1, 'Level 1', 'academic-auxiliary/Spoelhof Fieldhouse level 1.png', 1460, 808),
  ('Spoelhof Fieldhouse', 2, 'Level 2', 'academic-auxiliary/Spoelhof Fieldhouse level 2.png', 1570, 1046),
  ('Spoelhof University Center', 1, 'Level 1', 'academic-auxiliary/Spoelhof University Center level 1.png', 1570, 1034),
  ('Spoelhof University Center', 2, 'Level 2', 'academic-auxiliary/Spoelhof University Center level 2.png', 1570, 1020),
  ('Spoelhof University Center', 3, 'Level 3', 'academic-auxiliary/Spoelhof University Center level 3.png', 1560, 999),
  ('Van Noord Arena', 1, 'Level 1', 'academic-auxiliary/Van Noord Arena level 1.png', 1071, 1058),
  ('Van Noord Arena', 2, 'Level 2', 'academic-auxiliary/Van Noord Arena level 2.png', 1283, 1064),
  ('Van Noord Arena', 3, 'Level 3', 'academic-auxiliary/Van Noord Arena level 3.png', 1023, 1063),
  ('Van Noord Arena', 4, 'Level 4', 'academic-auxiliary/Van Noord Arena level 4.png', 1163, 1053),
  ('Venema Aquatic Center', 0, 'Level 0', 'academic-auxiliary/Venema Aquatic Center level 0.png', 1418, 997),
  ('Venema Aquatic Center', 1, 'Level 1', 'academic-auxiliary/Venema Aquatic Center level 1.png', 1375, 1064),
  ('Venema Aquatic Center', 2, 'Level 2', 'academic-auxiliary/Venema Aquatic Center level 2.png', 1521, 1064)
) as v (building_name, level, label, plan_path, plan_width, plan_height)
join public.buildings b on b.name = v.building_name;


-- Rooms -----------------------------------------------------------------------
insert into public.rooms (floor_id, room_number, name, type, aliases, x, y)
select f.id, v.room_number, v.name, v.type::public.room_type, v.aliases, v.x, v.y
from (values
  ('Hiemenga Hall', 2, '211', 'Classroom 211', 'classroom', array['HH-211']::text[], 450::numeric, 380::numeric),
  ('Hiemenga Hall', 2, '213', 'Classroom 213', 'classroom', array['HH-213']::text[], 520::numeric, 380::numeric),
  ('Hiemenga Hall', 2, '221', 'Classroom 221', 'classroom', array['HH-221']::text[], 680::numeric, 410::numeric),
  ('Hiemenga Hall', 2, '230', 'Student Academic Services', 'office', array['HH-SAS', 'SAS', 'Academic Advising']::text[], 310::numeric, 480::numeric),
  ('Hiemenga Hall', 2, '235', 'Intercultural Student Development', 'office', array['HH-ISD', 'ISD']::text[], 380::numeric, 480::numeric),
  ('Hiemenga Hall', 3, '311', 'Classroom 311', 'classroom', array['HH-311']::text[], 450::numeric, 380::numeric),
  ('Hiemenga Hall', 3, '323', 'Seminar Room 323', 'classroom', array['HH-323']::text[], 580::numeric, 390::numeric),
  ('Hiemenga Hall', 4, '411', 'History Department Office', 'office', array['HH-411']::text[], 460::numeric, 390::numeric),
  ('Science Building', 0, '010', 'Physics Lab 010', 'lab', array['SB-010']::text[], 300::numeric, 420::numeric),
  ('Science Building', 1, '110', 'Science Lecture Hall 110', 'lecture_hall', array['SB-110', 'SB Aud', 'Science Auditorium']::text[], 520::numeric, 440::numeric),
  ('Science Building', 1, '120', 'Chemistry Lab 120', 'lab', array['SB-120']::text[], 610::numeric, 440::numeric),
  ('Devos Communication Center', 0, '010', 'TV Production Studio', 'lab', array['DCC-010', 'Studio', 'Control Room']::text[], 400::numeric, 350::numeric),
  ('Devos Communication Center', 1, '110', 'Speech & Media Classroom 110', 'classroom', array['DCC-110']::text[], 450::numeric, 410::numeric),
  ('Devos Communication Center', 2, '210', 'Communication Department Office', 'office', array['DCC-210']::text[], 480::numeric, 430::numeric),
  ('Hekman Library', 1, '101', 'Circulation Desk', 'facility', array['HEK-CIRC', 'Front Desk', 'Library Help']::text[], 500::numeric, 400::numeric),
  ('Hekman Library', 1, '105', 'Peet''s Coffee & Study Lounge', 'dining', array['HEK-CAFE', 'Coffee', 'Cafe']::text[], 350::numeric, 420::numeric),
  ('Hekman Library', 2, '201', 'Group Study Room 201', 'study', array['HEK-201']::text[], 560::numeric, 390::numeric),
  ('Hekman Library', 4, '401', 'Cayvan Media Center', 'study', array['HEK-CAYVAN', 'Media Library', 'Audio Center']::text[], 520::numeric, 380::numeric),
  ('Chapel', 1, '100', 'Sanctuary', 'auditorium', array['CHP-SANCT', 'Worship Center', 'Main Hall']::text[], 600::numeric, 500::numeric),
  ('Chapel', 1, '105', 'Prayer Chapel', 'facility', array['CHP-PRAYER']::text[], 400::numeric, 450::numeric),
  ('Chapel', 2, '200', 'Chapel Balcony', 'auditorium', array['CHP-BALC']::text[], 600::numeric, 350::numeric),
  ('Covenant Fine Arts Center', 1, '100', 'CFAC Auditorium', 'auditorium', array['CFAC-AUD', 'Performance Hall', 'Main Stage']::text[], 500::numeric, 450::numeric),
  ('Covenant Fine Arts Center', 1, '115', 'Recital Hall', 'auditorium', array['CFAC-RECITAL']::text[], 350::numeric, 420::numeric),
  ('Spoelhof University Center', 1, '110', 'Admissions & Welcome Center', 'office', array['SUC-ADM', 'Visitor Center', 'Admissions']::text[], 450::numeric, 400::numeric),
  ('Spoelhof University Center', 1, '120', 'Registrar''s Office', 'office', array['SUC-REG']::text[], 550::numeric, 420::numeric),
  ('Spoelhof Fieldhouse', 1, '100', 'Van Noord Arena', 'auditorium', array['SFH-ARENA', 'Basketball Arena', 'Gym']::text[], 500::numeric, 400::numeric),
  ('Spoelhof Fieldhouse', 1, '120', 'Venema Aquatic Center', 'facility', array['SFH-POOL', 'Pool', 'Swimming Pool']::text[], 400::numeric, 450::numeric),
  ('Commons', 1, '100', 'Commons Dining Hall', 'dining', array['COM-DINING', 'Uppercrust', 'Cafeteria']::text[], 480::numeric, 400::numeric),
  ('Commons', 1, '110', 'Johnny''s Cafe', 'dining', array['COM-JOHNNY', 'Johnnys', 'Snack Bar']::text[], 380::numeric, 450::numeric),
  ('Bunker Interpretive Center', 1, '101', 'Ecosystem Exhibit Hall', 'facility', array['BIC-EXHIBIT', 'Nature Center', 'Preserve']::text[], 500::numeric, 380::numeric)
) as v (building_name, level, room_number, name, type, aliases, x, y)
join public.buildings b on b.name = v.building_name
join public.floors f on f.building_id = b.id and f.level = v.level;


-- Points of interest ----------------------------------------------------------
insert into public.points_of_interest (floor_id, type, label, x, y)
select f.id, v.type::public.poi_type, v.label, v.x, v.y
from (values
  ('Science Building', 0, 'restroom', 'Restroom', null::numeric, null::numeric),
  ('Hekman Library', 3, 'printer', 'Printer', null::numeric, null::numeric),
  ('Science Building', 2, 'water_fountain', 'Water Fountain', null::numeric, null::numeric),
  ('Hekman Library', 1, 'vending_machine', 'Vending Machine', null::numeric, null::numeric)
) as v (building_name, level, type, label, x, y)
join public.buildings b on b.name = v.building_name
join public.floors f on f.building_id = b.id and f.level = v.level;
