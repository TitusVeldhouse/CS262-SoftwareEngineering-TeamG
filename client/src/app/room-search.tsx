import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import FloorMapViewer from "../components/FloorMapViewer";
import {
  BUILDINGS,
  type CampusBuilding,
  type FloorPlan,
} from "../data/room-search-data";

const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const BG = "#F6F8FB";
const BORDER = "#E6EAF0";
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

export default function RoomSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] =
    useState<CampusBuilding | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<FloorPlan | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingBuildings = BUILDINGS.filter((building) =>
    building.name.toLocaleLowerCase().includes(normalizedQuery),
  );
  const academicBuildings = matchingBuildings
    .filter((building) => ACADEMIC_BUILDINGS.has(building.name))
    .sort(byName);
  const otherBuildings = matchingBuildings
    .filter((building) => !ACADEMIC_BUILDINGS.has(building.name))
    .sort(byName);

  const selectBuilding = (building: CampusBuilding) => {
    setSelectedBuilding(building);
    // Floors are sorted numerically in the catalog, so the first is the lowest available.
    setSelectedFloor(building.floors[0] ?? null);
    setQuery(building.name);
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

  if (!fontsLoaded) {
    return <View style={styles.container} testID="room-search-loading" />;
  }

  return (
    <View style={styles.container} testID="room-search-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          testID="room-search-back-button"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Room Search</Text>
      </View>

      <View
        style={[
          styles.searchArea,
          !selectedBuilding && styles.searchAreaExpanded,
        ]}
      >
        <TextInput
          testID="building-search-input"
          accessibilityLabel="Search campus buildings"
          style={styles.searchInput}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setSelectedBuilding(null);
            setSelectedFloor(null);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search buildings"
          placeholderTextColor={SUBTLE}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
        />

        {showResults && matchingBuildings.length > 0 && (
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
                <Text style={styles.buildingSectionTitle}>Academic buildings</Text>
                {academicBuildings.map(renderBuilding)}
              </View>
            )}
            {otherBuildings.length > 0 && (
              <View>
                <Text style={styles.buildingSectionTitle}>Other campus buildings</Text>
                {otherBuildings.map(renderBuilding)}
              </View>
            )}
          </ScrollView>
        )}

        {showResults && matchingBuildings.length === 0 && query.trim() !== "" && (
          <Text style={styles.noResults} testID="no-building-results">
            No buildings found.
          </Text>
        )}
      </View>

      {selectedBuilding && selectedFloor ? (
        <>
          <View style={styles.floorPicker}>
            <Text style={styles.selectedBuilding}>{selectedBuilding.name}</Text>
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
                    onPress={() => setSelectedFloor(floor)}
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
          </View>

          <View style={styles.planContainer}>
            <FloorMapViewer
              key={selectedFloor.asset}
              asset={selectedFloor.asset}
              imageWidth={selectedFloor.width}
              imageHeight={selectedFloor.height}
              title={`${selectedBuilding.name} ${selectedFloor.label}`}
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
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
  floorCount: {
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
  selectedBuilding: {
    paddingHorizontal: 20,
    marginBottom: 10,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: INK,
  },
  floorOptions: {
    paddingHorizontal: 20,
    paddingBottom: 14,
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
  planContainer: {
    flex: 1,
    minHeight: 180,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
});