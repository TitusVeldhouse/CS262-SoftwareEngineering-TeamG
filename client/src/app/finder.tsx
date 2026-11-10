// Finder screen (route "/finder") — the app's main data screen. Lets a user
// pick a campus location from a dropdown (highlighting it on a mock map) and
// filter which points of interest are shown, all backed by hard-coded data.
import { useState, useEffect, useRef } from "react";
import { Text, View, Pressable, ScrollView, StyleSheet, Image } from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  LOCATIONS,
  CAMPUS_TO_MANIFEST_BUILDINGS,
  POINTS_OF_INTEREST,
  type LocationName,
  type PointOfInterest,
} from "../data/campus-places";
import { useFavorites } from "../data/favorites-context";
import {
  buildBuildingFavorite,
  buildPoiFilterFavorite,
} from "../data/favorites";
import { FavoritesToggleButton } from "../components/FavoritesDrawer";

export { LOCATIONS, CAMPUS_TO_MANIFEST_BUILDINGS, POINTS_OF_INTEREST };

// Shared color palette for this screen.
const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6EAF0";
const MAP_BG = "#F8FAFC";
const CAMPUS_MAP_IMAGE = require("../../assets/images/campus-map.png");

// Dimensions for the scrollable campus blueprint canvas (preserves 2479:1944 aspect ratio)
export const BASE_MAP_WIDTH = 1000;
export const BASE_MAP_HEIGHT = Math.round(1000 * (1944 / 2479)); // 784
export const MAP_CANVAS_WIDTH = BASE_MAP_WIDTH;
export const MAP_CANVAS_HEIGHT = BASE_MAP_HEIGHT;

export default function Finder() {
  const router = useRouter();
  const params = useLocalSearchParams<{ building?: string; poi?: string }>();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Resolve matching location name if provided via route params
  const resolveBuilding = (buildingParam?: string): LocationName | null => {
    if (!buildingParam) return null;
    const match = LOCATIONS.find(
      (l) =>
        l.name.toLowerCase() === buildingParam.toLowerCase() ||
        CAMPUS_TO_MANIFEST_BUILDINGS[l.name]?.toLowerCase() ===
          buildingParam.toLowerCase(),
    );
    return match ? (match.name as LocationName) : null;
  };

  const resolvePoi = (poiParam?: string): PointOfInterest | null => {
    if (!poiParam) return null;
    const match = POINTS_OF_INTEREST.find(
      (p) => p.toLowerCase() === poiParam.toLowerCase(),
    );
    return match ?? null;
  };

  const initialSelection = resolveBuilding(params.building) ?? LOCATIONS[0].name;
  const initialPoi = resolvePoi(params.poi);

  // Which location is highlighted on the map / shown in the result card.
  const [selected, setSelected] = useState<LocationName>(initialSelection);

  // Dynamic zoom scale for campus blueprint canvas (0.7x to 2.5x)
  const [mapScale, setMapScale] = useState(1.0);
  const currentWidth = Math.round(BASE_MAP_WIDTH * mapScale);
  const currentHeight = Math.round(BASE_MAP_HEIGHT * mapScale);

  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const horizontalScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);

  // Smoothly center the scroll viewport on a specific campus location
  const centerOnLocation = (
    locName: LocationName,
    animated = true,
    scale = mapScale,
    vpWidth = viewportSize.width,
    vpHeight = viewportSize.height,
  ) => {
    const loc = LOCATIONS.find((l) => l.name === locName);
    if (!loc) return;
    const leftPercent = parseFloat(loc.left) / 100;
    const topPercent = parseFloat(loc.top) / 100;
    const targetX = leftPercent * (BASE_MAP_WIDTH * scale);
    const targetY = topPercent * (BASE_MAP_HEIGHT * scale);

    // Center target dynamically relative to container viewport (falling back to 195w x 210h if not yet measured)
    const halfW = vpWidth > 0 ? vpWidth / 2 : 195;
    const halfH = vpHeight > 0 ? vpHeight / 2 : 210;
    const scrollX = Math.max(0, targetX - halfW);
    const scrollY = Math.max(0, targetY - halfH);

    horizontalScrollRef.current?.scrollTo({ x: scrollX, animated });
    verticalScrollRef.current?.scrollTo({ y: scrollY, animated });
  };

  // Whether the location dropdown list is expanded.
  const [open, setOpen] = useState(false);
  // Which POI checkboxes are currently checked. A Set makes toggling and
  // membership checks (`.has`) simple, since order doesn't matter here.
  const [activePois, setActivePois] = useState<Set<PointOfInterest>>(() =>
    initialPoi ? new Set([initialPoi]) : new Set(),
  );
  const [prevParamBuilding, setPrevParamBuilding] = useState(params.building);
  const [prevParamPoi, setPrevParamPoi] = useState(params.poi);

  if (params.building !== prevParamBuilding) {
    setPrevParamBuilding(params.building);
    const matched = resolveBuilding(params.building);
    if (matched) {
      setSelected(matched);
    }
  }

  if (params.poi !== prevParamPoi) {
    setPrevParamPoi(params.poi);
    const matchedPoi = resolvePoi(params.poi);
    if (matchedPoi && !activePois.has(matchedPoi)) {
      const next = new Set(activePois);
      next.add(matchedPoi);
      setActivePois(next);
    }
  }

  useEffect(() => {
    const matched = resolveBuilding(params.building);
    if (matched) {
      centerOnLocation(matched, true, mapScale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.building]);

  // Center on quad/initial building on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      centerOnLocation(initialSelection, false, 1.0);
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <View style={styles.headerLeft}>
          <Pressable
            testID="back-button"
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
          >
            <Text style={styles.backButtonText}>{"‹"}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Calvin Finder</Text>
        </View>
        <FavoritesToggleButton />
      </View>

      {/* Horizontally scrollable checklist: tapping a POI toggles its
          checkbox via togglePoi; tapping its star saves it to Favorites. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.poiNav}
        contentContainerStyle={styles.poiNavContent}
      >
        {POINTS_OF_INTEREST.map((poi) => {
          const isActive = activePois.has(poi);
          const poiFavorite = buildPoiFilterFavorite(poi);
          const isPoiSaved = isFavorite(poiFavorite.id);
          return (
            <View key={poi} style={styles.poiChipGroup}>
              <Pressable
                testID={`poi-${poi}`}
                style={styles.poiItem}
                onPress={() => togglePoi(poi)}
              >
                <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                  {isActive && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.poiLabel}>{poi}</Text>
              </Pressable>
              <Pressable
                testID={`favorite-poi-${poi}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isPoiSaved }}
                accessibilityLabel={
                  isPoiSaved
                    ? `Remove ${poi} from favorites`
                    : `Save ${poi} to favorites`
                }
                style={styles.poiFavoriteButton}
                onPress={() => toggleFavorite(poiFavorite)}
              >
                <Text
                  style={[
                    styles.poiFavoriteStar,
                    isPoiSaved && styles.starActive,
                  ]}
                >
                  {isPoiSaved ? "★" : "☆"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View
        style={styles.mapContainer}
        testID="map-container"
        onLayout={({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          setViewportSize({ width, height });
          centerOnLocation(selected, false, mapScale, width, height);
        }}
      >
        {/* Scrollable & zoomable 2D map viewport */}
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.mapScroll}
          contentContainerStyle={styles.mapScrollContentHorizontal}
          maximumZoomScale={3.0}
          minimumZoomScale={0.7}
          testID="campus-map-scroll-horizontal"
        >
          <ScrollView
            ref={verticalScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mapScrollContentVertical}
            maximumZoomScale={3.0}
            minimumZoomScale={0.7}
            testID="campus-map-scroll-vertical"
          >
            <View
              style={[
                styles.mapCanvas,
                { width: currentWidth, height: currentHeight },
              ]}
            >
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
                    onPress={() => {
                      if (isSelected && CAMPUS_TO_MANIFEST_BUILDINGS[loc.name]) {
                        router.push({
                          pathname: "/room-search",
                          params: {
                            building: CAMPUS_TO_MANIFEST_BUILDINGS[loc.name],
                          },
                        });
                      } else {
                        setSelected(loc.name);
                        centerOnLocation(loc.name, true);
                      }
                    }}
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
          </ScrollView>
        </ScrollView>

        {/* Floating map controls: Zoom In, Zoom Out, Center Quad */}
        <View style={styles.mapControls}>
          <Pressable
            testID="zoom-in"
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            style={({ pressed }) => [
              styles.mapControlBtn,
              pressed && styles.mapControlBtnPressed,
            ]}
            onPress={() => {
              const nextScale = Math.min(2.5, +(mapScale + 0.25).toFixed(2));
              setMapScale(nextScale);
              centerOnLocation(selected, true, nextScale);
            }}
          >
            <Text style={styles.mapControlText}>+</Text>
          </Pressable>
          <Pressable
            testID="zoom-out"
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            style={({ pressed }) => [
              styles.mapControlBtn,
              pressed && styles.mapControlBtnPressed,
            ]}
            onPress={() => {
              const nextScale = Math.max(0.7, +(mapScale - 0.25).toFixed(2));
              setMapScale(nextScale);
              centerOnLocation(selected, true, nextScale);
            }}
          >
            <Text style={styles.mapControlText}>−</Text>
          </Pressable>
          <Pressable
            testID="center-map-button"
            accessibilityRole="button"
            accessibilityLabel="Center on Campus Quad"
            style={({ pressed }) => [
              styles.centerMapButton,
              pressed && styles.centerMapButtonPressed,
            ]}
            onPress={() => {
              setMapScale(1.0);
              setSelected("Hiemenga Hall");
              centerOnLocation("Hiemenga Hall", true, 1.0);
            }}
          >
            <Text style={styles.centerMapButtonText}>⌖ Quad</Text>
          </Pressable>
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
                    // Choosing an option updates the selection, closes
                    // dropdown, and centers on the chosen building.
                    setSelected(loc.name);
                    setOpen(false);
                    centerOnLocation(loc.name, true);
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
            <View style={styles.resultCardTextWrap}>
              <Text style={styles.resultTitle}>{activeLocation.name}</Text>
              <Text style={styles.resultSubtitle}>Showing on the map</Text>
            </View>
            <View style={styles.resultCardActions}>
              {(() => {
                const buildingFav = buildBuildingFavorite(
                  activeLocation.name,
                  CAMPUS_TO_MANIFEST_BUILDINGS[activeLocation.name],
                );
                const saved = isFavorite(buildingFav.id);
                return (
                  <Pressable
                    testID="favorite-building-button"
                    accessibilityRole="button"
                    accessibilityState={{ selected: saved }}
                    accessibilityLabel={
                      saved
                        ? `Remove ${activeLocation.name} from favorites`
                        : `Save ${activeLocation.name} to favorites`
                    }
                    style={({ pressed }) => [
                      styles.favoriteBuildingButton,
                      saved && styles.favoriteBuildingButtonSaved,
                      pressed && styles.enterBuildingButtonPressed,
                    ]}
                    onPress={() => toggleFavorite(buildingFav)}
                  >
                    <Text
                      style={[
                        styles.favoriteBuildingStar,
                        saved && styles.starActive,
                      ]}
                    >
                      {saved ? "★" : "☆"}
                    </Text>
                  </Pressable>
                );
              })()}
              {CAMPUS_TO_MANIFEST_BUILDINGS[activeLocation.name] && (
                <Pressable
                  testID="enter-building-button"
                  accessibilityRole="button"
                  accessibilityLabel={`View ${activeLocation.name} Floor Plan`}
                  style={({ pressed }) => [
                    styles.enterBuildingButton,
                    pressed && styles.enterBuildingButtonPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/room-search",
                      params: {
                        building: CAMPUS_TO_MANIFEST_BUILDINGS[activeLocation.name],
                      },
                    })
                  }
                >
                  <Text style={styles.enterBuildingButtonText}>View Floor Plan ›</Text>
                </Pressable>
              )}
            </View>
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
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    gap: 16,
    alignItems: "center",
  },
  poiChipGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  poiItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  poiFavoriteButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  poiFavoriteStar: {
    fontSize: 13,
    color: SUBTLE,
  },
  starActive: {
    color: "#D97706",
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
  },
  mapScroll: {
    flex: 1,
  },
  mapScrollContentHorizontal: {
    minWidth: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  mapScrollContentVertical: {
    minHeight: "100%",
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 240,
  },
  mapCanvas: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    borderRadius: 8,
  },
  mapControls: {
    position: "absolute",
    top: 72,
    right: 16,
    gap: 8,
    alignItems: "flex-end",
    zIndex: 6,
  },
  mapControlBtn: {
    width: 36,
    height: 36,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapControlBtnPressed: {
    backgroundColor: "#F1F5F9",
  },
  mapControlText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    lineHeight: 22,
    color: INK,
  },
  centerMapButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  centerMapButtonPressed: {
    backgroundColor: "#F1F5F9",
  },
  centerMapButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: INK,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0F1B2E",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  resultCardTextWrap: {
    flex: 1,
    marginRight: 12,
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
  resultCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favoriteBuildingButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteBuildingButtonSaved: {
    borderColor: "#FCD34D",
    backgroundColor: "#FEF3C7",
  },
  favoriteBuildingStar: {
    fontSize: 18,
    color: SUBTLE,
  },
  enterBuildingButton: {
    backgroundColor: ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  enterBuildingButtonPressed: {
    opacity: 0.85,
  },
  enterBuildingButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});
