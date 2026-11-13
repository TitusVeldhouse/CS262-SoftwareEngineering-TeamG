import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import FloorMapViewer, {
  type RoomHighlight,
} from "../components/FloorMapViewer";
import {
  BUILDINGS,
  type CampusBuilding,
  type FloorPlan,
} from "../data/room-search-data";
import { getAllRooms, getRoomsOnFloor } from "../data/campus-layout";
import { CAMPUS_TO_MANIFEST_BUILDINGS } from "../data/campus-places";
import { FavoritesToggleButton } from "../components/FavoritesDrawer";
import { UserAvatarButton } from "../components/UserAvatarButton";
import { useFavorites } from "../data/favorites-context";
import {
  buildFloorFavorite,
  buildRoomFavorite,
} from "../data/favorites";
import { getBuildings, searchPlaces } from "../services/api";

const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const BG = "#F6F8FB";
const BORDER = "#E6EAF0";
const GOLD = "#D97706";
const GOLD_BG = "#FEF3C7";
const ACADEMIC_BUILDINGS = new Set([
  "Covenant Fine Arts Center",
  "Devries Hall",
  "Devos Communication Center",
  "Engineering Building",
  "Hekman Library",
  "Hiemenga Hall",
  "North Hall",
  "School of Business",
  "Science Building",
  "Spoelhof University Center",
]);

const byName = (first: CampusBuilding, second: CampusBuilding) =>
  first.name.localeCompare(second.name);

const MANIFEST_TO_CAMPUS = new Map<string, string>(
  Object.entries(CAMPUS_TO_MANIFEST_BUILDINGS).map(([campus, manifest]) => [
    manifest,
    campus,
  ]),
);

function resolveBuildingAndFloor(
  buildingParam?: string,
  floorParam?: string,
): { building: CampusBuilding | null; floor: FloorPlan | null } {
  if (!buildingParam) {
    return { building: null, floor: null };
  }
  const building =
    BUILDINGS.find(
      (b) => b.name.toLowerCase() === buildingParam.toLowerCase(),
    ) ?? null;
  if (!building) {
    return { building: null, floor: null };
  }
  const floor =
    (floorParam
      ? building.floors.find(
          (f) =>
            f.label.toLowerCase() === floorParam.toLowerCase() ||
            f.label.toLowerCase().includes(floorParam.toLowerCase()),
        )
      : null) ??
    building.floors[0] ??
    null;
  return { building, floor };
}

/**
 * Extracts building names from the API's building, room, and point-of-interest
 * search results. The local catalog is still used for floor-plan assets.
 */
function extractApiBuildingNames(
  payload: unknown,
  buildingNamesById: Record<string, string>,
): string[] {
  const names = new Set<string>();
  const visited = new Set<object>();

  const addName = (candidate: unknown) => {
    if (typeof candidate === "string" && candidate.trim()) {
      names.add(candidate.trim());
      return;
    }

    if (candidate && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      if (typeof record.name === "string" && record.name.trim()) {
        names.add(record.name.trim());
      }
    }
  };

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    const record = value as Record<string, unknown>;
    const resultType = [
      record.type,
      record.category,
      record.kind,
      record.entityType,
    ].find((item): item is string => typeof item === "string");

    if (resultType?.toLowerCase().includes("building")) {
      addName(record.name);
    }

    addName(record.buildingName);
    addName(record.building_name);
    addName(record.building);

    const buildingId = record.buildingId ?? record.building_id;
    if (
      (typeof buildingId === "string" || typeof buildingId === "number") &&
      buildingNamesById[String(buildingId)]
    ) {
      names.add(buildingNamesById[String(buildingId)]);
    }

    // Support common API response envelopes without depending on one shape.
    visit(record.results);
    visit(record.data);
    visit(record.items);
    visit(record.matches);
    visit(record.result);
  };

  visit(payload);
  return Array.from(names);
}

export default function RoomSearch() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    building?: string;
    floor?: string;
    roomId?: string;
  }>();
  const { isFavorite, toggleFavorite } = useFavorites();

  const initial = resolveBuildingAndFloor(params.building, params.floor);
  const routeParamKey = `${params.building ?? ""}|${params.floor ?? ""}|${params.roomId ?? ""}`;
  const [prevRouteParamKey, setPrevRouteParamKey] = useState(routeParamKey);

  const [query, setQuery] = useState(
    initial.building ? initial.building.name : "",
  );
  const [selectedBuilding, setSelectedBuilding] =
    useState<CampusBuilding | null>(initial.building);
  const [selectedFloor, setSelectedFloor] = useState<FloorPlan | null>(
    initial.floor,
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    params.roomId ?? null,
  );
  const [showResults, setShowResults] = useState(!initial.building);
  const [apiBuildingNames, setApiBuildingNames] = useState<string[]>([]);
  const [apiBuildingNamesById, setApiBuildingNamesById] = useState<
    Record<string, string>
  >({});
  const [apiSearchLoading, setApiSearchLoading] = useState(false);
  const [apiSearchUnavailable, setApiSearchUnavailable] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (routeParamKey !== prevRouteParamKey) {
    setPrevRouteParamKey(routeParamKey);
    if (params.building) {
      const resolved = resolveBuildingAndFloor(params.building, params.floor);
      if (resolved.building) {
        setSelectedBuilding(resolved.building);
        setSelectedFloor(resolved.floor);
        setSelectedRoomId(params.roomId ?? null);
        setQuery(resolved.building.name);
        setShowResults(false);
      }
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();

  // Load server building IDs once so room/POI search results can be associated
  // with the correct local building and its locally bundled floor plans.
  useEffect(() => {
    let cancelled = false;

    getBuildings()
      .then((buildings) => {
        if (cancelled) return;

        const namesById: Record<string, string> = {};
        for (const building of buildings) {
          namesById[String(building.id)] = building.name;
        }
        setApiBuildingNamesById(namesById);
      })
      .catch(() => {
        // Keep the local building catalog usable when the server is offline.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Search the API as the user types. API matches are shown first, while the
  // complete local catalog remains available as a fallback.
  useEffect(() => {
    if (normalizedQuery.length < 2 || selectedBuilding) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiBuildingNames([]);
      setApiSearchLoading(false);
      setApiSearchUnavailable(false);
      return;
    }

    let cancelled = false;
    setApiSearchLoading(true);
    setApiSearchUnavailable(false);

    searchPlaces(normalizedQuery)
      .then((results) => {
        if (cancelled) return;
        setApiBuildingNames(
          extractApiBuildingNames(results, apiBuildingNamesById),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setApiBuildingNames([]);
        setApiSearchUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) {
          setApiSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedQuery, selectedBuilding, apiBuildingNamesById]);

  const localMatchingBuildings = BUILDINGS.filter((building) =>
    building.name.toLocaleLowerCase().includes(normalizedQuery),
  );

  const apiMatchingBuildings = apiBuildingNames
    .map((name) =>
      BUILDINGS.find(
        (building) => building.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
    )
    .filter((building): building is CampusBuilding => building !== undefined);

  const matchingBuildings = Array.from(
    new Map(
      [...apiMatchingBuildings, ...localMatchingBuildings].map((building) => [
        building.name,
        building,
      ]),
    ).values(),
  );

  const academicBuildings = matchingBuildings
    .filter((building) => ACADEMIC_BUILDINGS.has(building.name))
    .sort(byName);
  const otherBuildings = matchingBuildings
    .filter((building) => !ACADEMIC_BUILDINGS.has(building.name))
    .sort(byName);

  const availableBuildings = new Set(BUILDINGS.map((b) => b.name));
  const matchingRooms = normalizedQuery
    ? getAllRooms()
        .filter((room) => {
          if (!availableBuildings.has(room.building)) return false;
          return (
            room.id.toLowerCase().includes(normalizedQuery) ||
            room.roomNumber.toLowerCase().includes(normalizedQuery) ||
            (room.name?.toLowerCase().includes(normalizedQuery) ?? false) ||
            room.building.toLowerCase().includes(normalizedQuery) ||
            (room.aliases?.some((a) =>
              a.toLowerCase().includes(normalizedQuery),
            ) ??
              false)
          );
        })
        .slice(0, 8)
    : [];

  const selectBuilding = (building: CampusBuilding) => {
    setSelectedBuilding(building);
    // Floors are sorted numerically in the catalog, so the first is the lowest available.
    setSelectedFloor(building.floors[0] ?? null);
    setSelectedRoomId(null);
    setQuery(building.name);
    setShowResults(false);
  };

  const selectRoomResult = (
    buildingName: string,
    floorLabel: string,
    roomId: string,
  ) => {
    const resolved = resolveBuildingAndFloor(buildingName, floorLabel);
    if (!resolved.building) return;
    setSelectedBuilding(resolved.building);
    setSelectedFloor(resolved.floor);
    setSelectedRoomId(roomId);
    setQuery(resolved.building.name);
    setShowResults(false);
  };

  const renderBuilding = (building: CampusBuilding) => (
    <Pressable
      key={building.name}
      testID={`building-option-${building.name}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.buildingOption,
        pressed && styles.optionPressed,
      ]}
      onPress={() => selectBuilding(building)}
    >
      <Text style={styles.buildingName}>{building.name}</Text>
      <Text style={styles.floorCount}>
        {building.floors.length} {building.floors.length === 1 ? "floor" : "floors"}
      </Text>
    </Pressable>
  );

  const roomsOnFloor = useMemo(
    () =>
      selectedBuilding && selectedFloor
        ? getRoomsOnFloor(selectedBuilding.name, selectedFloor.label)
        : [],
    [selectedBuilding, selectedFloor],
  );

  const selectedRoom = useMemo(
    () => roomsOnFloor.find((room) => room.id === selectedRoomId) ?? null,
    [roomsOnFloor, selectedRoomId],
  );

  const roomHighlights = useMemo<RoomHighlight[]>(() => {
    if (!selectedRoom?.coordinates || !selectedFloor) return [];
    const [cx, cy] = selectedRoom.coordinates;
    const w = selectedFloor.width ?? 1200;
    const h = selectedFloor.height ?? 1000;
    const halfBox = 38;
    const x1 = Math.max(0, cx - halfBox);
    const y1 = Math.max(0, cy - halfBox);
    const x2 = Math.min(w, cx + halfBox);
    const y2 = Math.min(h, cy + halfBox);
    return [
      {
        id: selectedRoom.id,
        points: [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
        ],
      },
    ];
  }, [selectedRoom, selectedFloor]);

  if (!fontsLoaded) {
    return <View style={styles.container} testID="room-search-loading" />;
  }

  const floorFavorite =
    selectedBuilding && selectedFloor
      ? buildFloorFavorite(
          selectedBuilding.name,
          selectedFloor.label,
          MANIFEST_TO_CAMPUS.get(selectedBuilding.name),
        )
      : null;
  const isFloorSaved = floorFavorite ? isFavorite(floorFavorite.id) : false;

  return (
    <View style={styles.container} testID="room-search-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            testID="room-search-back-button"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Room Search</Text>
        </View>
        <View style={styles.headerRight}>
          <FavoritesToggleButton />
          <UserAvatarButton />
        </View>
      </View>

      <View
        style={[
          styles.searchArea,
          !selectedBuilding && styles.searchAreaExpanded,
        ]}
      >
        <TextInput
          testID="building-search-input"
          accessibilityLabel="Search campus buildings and rooms"
          style={styles.searchInput}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setSelectedBuilding(null);
            setSelectedFloor(null);
            setSelectedRoomId(null);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search buildings or rooms"
          placeholderTextColor={SUBTLE}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
        />

        {showResults && apiSearchLoading && normalizedQuery.length >= 2 && (
          <Text style={styles.apiSearchStatus} testID="api-search-loading">
            Searching campus data...
          </Text>
        )}

        {showResults && apiSearchUnavailable && normalizedQuery.length >= 2 && (
          <Text style={styles.apiSearchStatus} testID="api-search-fallback">
            Server search unavailable. Showing the local campus catalog.
          </Text>
        )}

        {showResults &&
          (matchingBuildings.length > 0 || matchingRooms.length > 0) && (
            <ScrollView
              style={[
                styles.buildingResults,
                !selectedBuilding && styles.buildingResultsExpanded,
              ]}
              keyboardShouldPersistTaps="handled"
              testID="building-results"
            >
              {academicBuildings.length > 0 && (
                <View>
                  <Text style={styles.buildingSectionTitle}>
                    Academic buildings
                  </Text>
                  {academicBuildings.map(renderBuilding)}
                </View>
              )}
              {otherBuildings.length > 0 && (
                <View>
                  <Text style={styles.buildingSectionTitle}>
                    Other campus buildings
                  </Text>
                  {otherBuildings.map(renderBuilding)}
                </View>
              )}
              {matchingRooms.length > 0 && (
                <View>
                  <Text style={styles.buildingSectionTitle}>
                    Rooms &amp; Points of Interest
                  </Text>
                  {matchingRooms.map((room) => (
                    <Pressable
                      key={room.id}
                      testID={`room-option-${room.id}`}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.buildingOption,
                        pressed && styles.optionPressed,
                      ]}
                      onPress={() =>
                        selectRoomResult(room.building, room.floor, room.id)
                      }
                    >
                      <View style={styles.roomOptionTextWrap}>
                        <Text style={styles.buildingName}>
                          {room.name ?? `Room ${room.roomNumber}`}
                        </Text>
                        <Text style={styles.roomOptionSub}>
                          {room.building} · {room.floor} ({room.roomNumber})
                        </Text>
                      </View>
                      <Text style={styles.floorCount}>{room.roomNumber}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

        {showResults &&
          matchingBuildings.length === 0 &&
          matchingRooms.length === 0 &&
          query.trim() !== "" && (
            <Text style={styles.noResults} testID="no-building-results">
              No buildings or rooms found.
            </Text>
          )}
      </View>

      {selectedBuilding && selectedFloor ? (
        <>
          <View style={styles.floorPicker}>
            <View style={styles.buildingHeaderRow}>
              <Text style={styles.selectedBuilding}>{selectedBuilding.name}</Text>
              <View style={styles.headerActionGroup}>
                {floorFavorite && (
                  <Pressable
                    testID="favorite-floor-button"
                    accessibilityRole="button"
                    accessibilityState={{ selected: isFloorSaved }}
                    accessibilityLabel={
                      isFloorSaved
                        ? `Remove ${selectedBuilding.name} ${selectedFloor.label} from favorites`
                        : `Save ${selectedBuilding.name} ${selectedFloor.label} to favorites`
                    }
                    style={({ pressed }) => [
                      styles.favoriteFloorButton,
                      isFloorSaved && styles.favoriteChipSaved,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => toggleFavorite(floorFavorite)}
                  >
                    <Text
                      style={[
                        styles.favoriteButtonStar,
                        isFloorSaved && styles.favoriteButtonStarSaved,
                      ]}
                    >
                      {isFloorSaved ? "★ Saved" : "☆ Save Floor"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  testID="exit-to-campus-button"
                  accessibilityRole="button"
                  accessibilityLabel="Exit to Campus Map"
                  style={({ pressed }) => [
                    styles.exitToCampusButton,
                    pressed && styles.exitToCampusButtonPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/finder",
                      params: { building: selectedBuilding.name },
                    })
                  }
                >
                  <Text style={styles.exitToCampusButtonIcon}>↗</Text>
                  <Text style={styles.exitToCampusButtonText}>
                    Exit to Campus Map
                  </Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.floorOptions}
            >
              {selectedBuilding.floors.map((floor) => {
                const isSelected = floor.label === selectedFloor.label;
                return (
                  <Pressable
                    key={floor.label}
                    testID={`floor-option-${floor.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.floorOption,
                      isSelected && styles.floorOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedFloor(floor);
                      setSelectedRoomId(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.floorOptionText,
                        isSelected && styles.floorOptionTextActive,
                      ]}
                    >
                      {floor.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {roomsOnFloor.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.floorRoomsStrip}
                testID="floor-rooms-strip"
              >
                {roomsOnFloor.map((room) => {
                  const isRoomSelected = room.id === selectedRoomId;
                  const roomFav = buildRoomFavorite(
                    room,
                    selectedBuilding.name,
                    selectedFloor.label,
                    MANIFEST_TO_CAMPUS.get(selectedBuilding.name),
                  );
                  const isRoomSaved = isFavorite(roomFav.id);
                  return (
                    <View
                      key={room.id}
                      style={[
                        styles.roomChipGroup,
                        isRoomSelected && styles.roomChipGroupActive,
                      ]}
                    >
                      <Pressable
                        testID={`floor-room-chip-${room.id}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isRoomSelected }}
                        style={styles.roomChipMain}
                        onPress={() =>
                          setSelectedRoomId((prev) =>
                            prev === room.id ? null : room.id,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.roomChipText,
                            isRoomSelected && styles.roomChipTextActive,
                          ]}
                        >
                          {room.roomNumber} · {room.name ?? "Room"}
                        </Text>
                      </Pressable>
                      <Pressable
                        testID={`favorite-room-${room.id}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isRoomSaved }}
                        accessibilityLabel={
                          isRoomSaved
                            ? `Remove ${room.name ?? room.roomNumber} from favorites`
                            : `Save ${room.name ?? room.roomNumber} to favorites`
                        }
                        style={styles.roomChipStarButton}
                        onPress={() => toggleFavorite(roomFav)}
                      >
                        <Text
                          style={[
                            styles.roomChipStar,
                            isRoomSelected && styles.roomChipTextActive,
                            isRoomSaved && styles.favoriteButtonStarSaved,
                          ]}
                        >
                          {isRoomSaved ? "★" : "☆"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={styles.planContainer}>
            <FloorMapViewer
              key={`${selectedBuilding.name}-${selectedFloor.label}-${selectedFloor.asset}`}
              asset={selectedFloor.asset}
              imageWidth={selectedFloor.width}
              imageHeight={selectedFloor.height}
              title={`${selectedBuilding.name} ${selectedFloor.label}`}
              highlights={roomHighlights}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: INK,
    lineHeight: 26,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: INK,
  },
  searchArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
  },
  searchAreaExpanded: {
    flex: 1,
    minHeight: 0,
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: INK,
    backgroundColor: BG,
  },
  buildingResults: {
    maxHeight: 208,
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  buildingResultsExpanded: {
    flex: 1,
    maxHeight: "100%",
  },
  buildingOption: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  buildingSectionTitle: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: SUBTLE,
  },
  optionPressed: {
    backgroundColor: "#EAF3FE",
  },
  buildingName: {
    flex: 1,
    marginRight: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: INK,
  },
  roomOptionTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  roomOptionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: SUBTLE,
    marginTop: 2,
  },
  floorCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: SUBTLE,
  },
  apiSearchStatus: {
    paddingTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: SUBTLE,
  },
  noResults: {
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: SUBTLE,
  },
  floorPicker: {
    paddingTop: 18,
    backgroundColor: "#FFFFFF",
  },
  buildingHeaderRow: {
    paddingHorizontal: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectedBuilding: {
    flex: 1,
    marginRight: 8,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: INK,
  },
  headerActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favoriteFloorButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  favoriteChipSaved: {
    borderColor: "#FCD34D",
    backgroundColor: GOLD_BG,
  },
  favoriteButtonStar: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: INK,
  },
  favoriteButtonStarSaved: {
    color: GOLD,
  },
  exitToCampusButton: {
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    gap: 4,
  },
  exitToCampusButtonPressed: {
    backgroundColor: "#15803D",
    opacity: 0.9,
  },
  exitToCampusButtonIcon: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  exitToCampusButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  floorOptions: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  floorOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  floorOptionActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  floorOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: INK,
  },
  floorOptionTextActive: {
    color: "#FFFFFF",
  },
  floorRoomsStrip: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  roomChipGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  roomChipGroupActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  roomChipMain: {
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
  },
  roomChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: INK,
  },
  roomChipTextActive: {
    color: "#FFFFFF",
  },
  roomChipStarButton: {
    paddingVertical: 6,
    paddingLeft: 4,
    paddingRight: 10,
  },
  roomChipStar: {
    fontSize: 13,
    color: SUBTLE,
  },
  planContainer: {
    flex: 1,
    minHeight: 280,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
});