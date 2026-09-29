// Finder screen (route "/finder") — the app's main data screen. Lets a user
// pick a campus location from a dropdown (highlighting it on a mock map) and
// filter which points of interest are shown, all backed by hard-coded data.
import { useState } from "react";
import { Text, View, Pressable, ScrollView, StyleSheet, Image } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

// Shared color palette for this screen.
const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6EAF0";
const MAP_BG = "#F8FAFC";
const CAMPUS_MAP_IMAGE = require("../../assets/images/campus-map.png");

// Mocked campus locations. `top`/`left` are percentage offsets used to
// position each pin over the (also mocked) map background.
export const LOCATIONS = [
  { name: "Hekman Library", top: "62.3%", left: "31.2%" },
  { name: "Covenant Fine Arts Center", top: "58.1%", left: "37.4%" },
  { name: "Spoelhof Center", top: "63.3%", left: "24.2%" },
  { name: "Fieldhouse", top: "39.7%", left: "23.8%" },
  { name: "Hiemenga Hall", top: "64.1%", left: "28.3%" },
  { name: "Devos Communication Building", top: "61.8%", left: "46.6%" },
  { name: "Science Building", top: "54.6%", left: "25.7%" },
  { name: "DeVries Hall", top: "55.0%", left: "23.5%" },
  { name: "North Hall", top: "51.8%", left: "26.6%" },
  { name: "Chapel", top: "66.5%", left: "27.4%" },
  { name: "Commons Annex", top: "58.7%", left: "32.5%" },
  { name: "Commons", top: "56.5%", left: "32.8%" },
] as const;

// Derives a union of literal location names ("Hekman Library" | ...) from
// the LOCATIONS data itself, so the type always stays in sync with the data.
type LocationName = (typeof LOCATIONS)[number]["name"];

// Mocked category filters shown in the horizontal checklist above the map.
export const POINTS_OF_INTEREST = [
  "Restrooms",
  "Printers",
  "Water Fountains",
  "Vending Machines",
] as const;

type PointOfInterest = (typeof POINTS_OF_INTEREST)[number];

export default function Finder() {
  const router = useRouter();
  // Which location is highlighted on the map / shown in the result card.
  const [selected, setSelected] = useState<LocationName>(LOCATIONS[0].name);
  // Whether the location dropdown list is expanded.
  const [open, setOpen] = useState(false);
  // Which POI checkboxes are currently checked. A Set makes toggling and
  // membership checks (`.has`) simple, since order doesn't matter here.
  const [activePois, setActivePois] = useState<Set<PointOfInterest>>(
    () => new Set(),
  );

  // Flips a single POI's checked state without mutating the previous Set.
  const togglePoi = (poi: PointOfInterest) => {
    setActivePois((prev) => {
      const next = new Set(prev);
      if (next.has(poi)) {
        next.delete(poi);
      } else {
        next.add(poi);
      }
      return next;
    });
  };

  // Custom fonts load asynchronously; render an empty placeholder until
  // they're ready so text doesn't flash in the default system font first.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={styles.container} testID="finder-loading" />;
  }

  // Look up the full location record for whichever name is selected, so we
  // can show its details in the result card below.
  const activeLocation = LOCATIONS.find((l) => l.name === selected);

  return (
    <View style={styles.container} testID="finder-screen">
      {/* Hide the default expo-router header; this screen has its own. */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header: back button returns to the landing screen. */}
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>{"‹"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Calvin Finder</Text>
      </View>

      {/* Horizontally scrollable checklist: tapping a POI toggles its
          checkbox via togglePoi. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.poiNav}
        contentContainerStyle={styles.poiNavContent}
      >
        {POINTS_OF_INTEREST.map((poi) => {
          const isActive = activePois.has(poi);
          return (
            <Pressable
              key={poi}
              testID={`poi-${poi}`}
              style={styles.poiItem}
              onPress={() => togglePoi(poi)}
            >
              <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                {isActive && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.poiLabel}>{poi}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.mapContainer}>
        {/* Mock map: one dot per LOCATIONS entry, positioned with its
            top/left percentages. The selected location's dot is enlarged
            and colored via the pinActive style. */}
        <View style={styles.mapCanvas}>
          <Image
            source={CAMPUS_MAP_IMAGE}
            style={styles.mapImage}
            resizeMode="contain"
            testID="campus-map-image"
          />
          {LOCATIONS.map((loc) => {
            const isSelected = loc.name === selected;
            return (
              <Pressable
                key={loc.name}
                testID={`pin-${loc.name}`}
                accessibilityRole="button"
                accessibilityLabel={loc.name}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                style={[
                  styles.pinWrapper,
                  { top: loc.top, left: loc.left },
                  isSelected && styles.pinWrapperActive,
                ]}
                onPress={() => setSelected(loc.name)}
              >
                <View
                  style={[
                    styles.pin,
                    isSelected && styles.pinActive,
                  ]}
                />
                {isSelected && (
                  <View style={styles.pinLabelBadge}>
                    <Text style={styles.pinLabelText} numberOfLines={1}>
                      {loc.name}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Dropdown: trigger shows the current selection; tapping it toggles
            `open` to reveal the full LOCATIONS list below. */}
        <View style={styles.dropdownWrap}>
          <Pressable
            testID="location-dropdown-trigger"
            style={styles.dropdownTrigger}
            onPress={() => setOpen((v) => !v)}
          >
            <Text style={styles.dropdownTriggerText} numberOfLines={1}>
              {selected}
            </Text>
            <Text style={styles.dropdownChevron}>{open ? "▲" : "▼"}</Text>
          </Pressable>

          {open && (
            <View style={styles.dropdownList} testID="location-dropdown-list">
              {LOCATIONS.map((loc) => (
                <Pressable
                  key={loc.name}
                  testID={`location-option-${loc.name}`}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    pressed && styles.dropdownItemPressed,
                  ]}
                  onPress={() => {
                    // Choosing an option updates the selection and closes
                    // the dropdown in one tap.
                    setSelected(loc.name);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      loc.name === selected && styles.dropdownItemTextActive,
                    ]}
                  >
                    {loc.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Full-screen tap target that closes the dropdown when the user
            taps outside of it. */}
        {open && (
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        )}

        {/* Card summarizing whichever location is currently selected. */}
        {activeLocation && (
          <View style={styles.resultCard} testID="result-card">
            <Text style={styles.resultTitle}>{activeLocation.name}</Text>
            <Text style={styles.resultSubtitle}>Showing on the map</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CARD_BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: CARD_BG,
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
  poiNav: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  poiNavContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 20,
    alignItems: "center",
  },
  poiItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 8,
    lineHeight: 8,
    fontFamily: "Inter_700Bold",
  },
  poiLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 16,
    color: INK,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  mapCanvas: {
    width: "100%",
    aspectRatio: 2479 / 1944,
    position: "relative",
    backgroundColor: "#FFFFFF",
  },
  mapImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  pinWrapper: {
    position: "absolute",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -22 }, { translateY: -22 }],
    zIndex: 4,
  },
  pinWrapperActive: {
    zIndex: 8,
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#208AEF",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DC2626",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pinLabelBadge: {
    position: "absolute",
    bottom: 38,
    backgroundColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  pinLabelText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  // Dropdown
  dropdownWrap: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#0F1B2E",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dropdownTriggerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: INK,
    flex: 1,
    marginRight: 8,
  },
  dropdownChevron: {
    fontSize: 11,
    color: SUBTLE,
  },
  dropdownList: {
    marginTop: 8,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 6,
    maxHeight: 320,
    overflow: "hidden",
    shadowColor: "#0F1B2E",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemPressed: {
    backgroundColor: "#F1F4F9",
  },
  dropdownItemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14.5,
    color: INK,
  },
  dropdownItemTextActive: {
    fontFamily: "Inter_600SemiBold",
    color: ACCENT,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },

  // Result card
  resultCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#0F1B2E",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  resultTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: INK,
  },
  resultSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: SUBTLE,
    marginTop: 2,
  },
});
