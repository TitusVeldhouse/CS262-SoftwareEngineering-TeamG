import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFavorites } from "../data/favorites-context";
import {
  buildBuildingFavorite,
  buildPoiFilterFavorite,
  buildRoomFavorite,
  type FavoritePlace,
  type FavoritePlaceKind,
  type NewFavoritePlace,
} from "../data/favorites";
import {
  CAMPUS_TO_MANIFEST_BUILDINGS,
  LOCATIONS,
  POINTS_OF_INTEREST,
} from "../data/campus-places";
import { getAllRooms } from "../data/campus-layout";

const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const BORDER = "#E6EAF0";
const GOLD = "#D97706";
const GOLD_BG = "#FEF3C7";

type DrawerFilter = "all" | "room" | "poi" | "building";

const KIND_LABELS: Record<FavoritePlaceKind, string> = {
  room: "ROOM",
  floor: "FLOOR",
  poi: "POI",
  building: "BUILDING",
};

const KIND_BADGE_COLORS: Record<
  FavoritePlaceKind,
  { bg: string; text: string }
> = {
  room: { bg: "#EFF6FF", text: "#1D4ED8" },
  floor: { bg: "#F3E8FF", text: "#7E22CE" },
  poi: { bg: "#ECFDF5", text: "#047857" },
  building: { bg: "#FEF3C7", text: "#B45309" },
};

const FILTER_OPTIONS: readonly { key: DrawerFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "room", label: "Rooms" },
  { key: "poi", label: "POIs" },
  { key: "building", label: "Buildings" },
];

type QuickCandidate = {
  place: NewFavoritePlace;
  searchText: string;
};

function matchesFilter(item: FavoritePlace, filter: DrawerFilter): boolean {
  if (filter === "all") return true;
  if (filter === "building") {
    return item.kind === "building" || item.kind === "floor";
  }
  return item.kind === filter;
}

export function FavoritesToggleButton({
  testID = "favorites-menu-toggle",
}: {
  testID?: string;
}) {
  const { favorites, isDrawerOpen, toggleDrawer } = useFavorites();
  const count = favorites.length;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ expanded: isDrawerOpen }}
      accessibilityLabel={
        count > 0 ? `Favorites menu, ${count} saved` : "Open favorites menu"
      }
      style={({ pressed }) => [
        styles.toggleButton,
        isDrawerOpen && styles.toggleButtonActive,
        pressed && styles.toggleButtonPressed,
      ]}
      onPress={toggleDrawer}
    >
      <Text
        style={[
          styles.toggleStar,
          count > 0 && styles.toggleStarSaved,
          isDrawerOpen && styles.toggleTextActive,
        ]}
      >
        {count > 0 ? "★" : "☆"}
      </Text>
      <Text
        style={[
          styles.toggleLabel,
          isDrawerOpen && styles.toggleTextActive,
        ]}
      >
        Favorites
      </Text>
      {count > 0 && (
        <View
          style={[
            styles.toggleBadge,
            isDrawerOpen && styles.toggleBadgeActive,
          ]}
          testID="favorites-count-badge"
        >
          <Text
            style={[
              styles.toggleBadgeText,
              isDrawerOpen && styles.toggleBadgeTextActive,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function FavoritesDrawer() {
  const router = useRouter();
  const {
    favorites,
    storageMode,
    isDrawerOpen,
    closeDrawer,
    isFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
  } = useFavorites();

  const [filter, setFilter] = useState<DrawerFilter>("all");
  const [quickQuery, setQuickQuery] = useState("");
  const [slideAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isDrawerOpen) {
      slideAnim.setValue(40);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }
  }, [isDrawerOpen, slideAnim]);

  const allQuickCandidates = useMemo<QuickCandidate[]>(() => {
    const manifestToCampus = new Map<string, string>();
    for (const [campusName, manifestName] of Object.entries(
      CAMPUS_TO_MANIFEST_BUILDINGS,
    )) {
      manifestToCampus.set(manifestName, campusName);
    }

    const candidates: QuickCandidate[] = [];

    for (const poi of POINTS_OF_INTEREST) {
      const place = buildPoiFilterFavorite(poi);
      candidates.push({
        place,
        searchText: `${poi} poi campus filter`.toLowerCase(),
      });
    }

    for (const room of getAllRooms()) {
      const campusName = manifestToCampus.get(room.building);
      const place = buildRoomFavorite(room, room.building, room.floor, campusName);
      const aliasText = room.aliases ? room.aliases.join(" ") : "";
      candidates.push({
        place,
        searchText: `${room.id} ${room.roomNumber} ${room.name ?? ""} ${room.building} ${room.floor} ${aliasText}`.toLowerCase(),
      });
    }

    for (const loc of LOCATIONS) {
      const place = buildBuildingFavorite(
        loc.name,
        CAMPUS_TO_MANIFEST_BUILDINGS[loc.name],
      );
      candidates.push({
        place,
        searchText: `${loc.name} building campus`.toLowerCase(),
      });
    }

    return candidates;
  }, []);

  const quickSuggestions = useMemo(() => {
    const trimmed = quickQuery.trim().toLowerCase();
    if (!trimmed) {
      const starterIds = new Set([
        "poi:Restrooms",
        "room:HH-211",
        "room:HEK-CAFE",
        "building:Hiemenga Hall",
      ]);
      const unsavedStarters = allQuickCandidates.filter(
        (c) => starterIds.has(c.place.id) && !isFavorite(c.place.id),
      );
      if (unsavedStarters.length > 0) {
        return unsavedStarters;
      }
      return allQuickCandidates
        .filter((c) => !isFavorite(c.place.id))
        .slice(0, 4);
    }
    return allQuickCandidates
      .filter((candidate) => candidate.searchText.includes(trimmed))
      .slice(0, 6);
  }, [allQuickCandidates, quickQuery, isFavorite]);

  const filteredFavorites = useMemo(
    () => favorites.filter((item) => matchesFilter(item, filter)),
    [favorites, filter],
  );

  const navigateToFavorite = (item: FavoritePlace) => {
    closeDrawer();
    if (item.poiFilter) {
      router.push({
        pathname: "/finder",
        params: { poi: item.poiFilter },
      });
      return;
    }

    if (item.building && (item.roomId || item.floor)) {
      router.push({
        pathname: "/room-search",
        params: {
          building: item.building,
          ...(item.floor ? { floor: item.floor } : {}),
          ...(item.roomId ? { roomId: item.roomId } : {}),
        },
      });
      return;
    }

    if (item.campusLocation || item.building) {
      router.push({
        pathname: "/finder",
        params: {
          building: item.campusLocation ?? item.building,
        },
      });
    }
  };

  if (!isDrawerOpen) {
    return null;
  }

  return (
    <View style={styles.overlay} testID="favorites-drawer-overlay">
      <Pressable
        testID="favorites-backdrop"
        accessibilityRole="button"
        accessibilityLabel="Close favorites menu"
        style={styles.backdrop}
        onPress={closeDrawer}
      />

      <Animated.View
        testID="favorites-drawer"
        style={[
          styles.drawerPanel,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Side rail collapse handle on the inner left edge of the panel */}
        <Pressable
          testID="favorites-side-collapse-handle"
          accessibilityRole="button"
          accessibilityLabel="Collapse side favorites menu"
          style={styles.sideRailHandle}
          onPress={closeDrawer}
        >
          <Text style={styles.sideRailHandleText}>›</Text>
        </Pressable>

        <View style={styles.drawerHeader}>
          <View style={styles.drawerTitleRow}>
            <Text style={styles.drawerStar}>★</Text>
            <Text style={styles.drawerTitle}>Favorites</Text>
            <View style={styles.headerCountPill}>
              <Text style={styles.headerCountText}>{favorites.length}</Text>
            </View>
          </View>
          <Pressable
            testID="favorites-collapse-button"
            accessibilityRole="button"
            accessibilityLabel="Collapse favorites menu"
            style={({ pressed }) => [
              styles.collapseButton,
              pressed && styles.collapseButtonPressed,
            ]}
            onPress={closeDrawer}
          >
            <Text style={styles.collapseButtonText}>Collapse ›</Text>
          </Pressable>
        </View>

        <View style={styles.storageNotice} testID="favorites-storage-notice">
          <Text style={styles.storageNoticeTitle}>
            {storageMode === "local-temp"
              ? "Temporary Local List"
              : "Account Synced"}
          </Text>
          <Text style={styles.storageNoticeBody}>
            {storageMode === "local-temp"
              ? "Saved locally on this device for testing. Will sync with your account once login is added."
              : "Synced to your logged-in account."}
          </Text>
        </View>

        {favorites.length > 0 && (
          <View style={styles.filterRow}>
            {FILTER_OPTIONS.map((option) => {
              const active = filter === option.key;
              return (
                <Pressable
                  key={option.key}
                  testID={`favorites-filter-${option.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                  ]}
                  onPress={() => setFilter(option.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {favorites.length === 0 ? (
            <View style={styles.emptyState} testID="favorites-empty-state">
              <Text style={styles.emptyIcon}>☆</Text>
              <Text style={styles.emptyTitle}>No saved favorites yet</Text>
              <Text style={styles.emptyBody}>
                Tap ☆ on any building, floor, room, or POI on the map to bookmark
                it here for quick navigation.
              </Text>
            </View>
          ) : filteredFavorites.length === 0 ? (
            <Text style={styles.filteredEmpty}>
              No saved items match this filter.
            </Text>
          ) : (
            <View style={styles.listSection}>
              {filteredFavorites.map((item) => {
                const badgeStyle = KIND_BADGE_COLORS[item.kind];
                return (
                  <View
                    key={item.id}
                    testID={`favorite-item-${item.id}`}
                    style={styles.favoriteCard}
                  >
                    <Pressable
                      testID={`favorite-navigate-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Navigate to ${item.title}`}
                      style={({ pressed }) => [
                        styles.favoriteMain,
                        pressed && styles.favoriteMainPressed,
                      ]}
                      onPress={() => navigateToFavorite(item)}
                    >
                      <View
                        style={[
                          styles.kindBadge,
                          { backgroundColor: badgeStyle.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.kindBadgeText,
                            { color: badgeStyle.text },
                          ]}
                        >
                          {KIND_LABELS[item.kind]}
                        </Text>
                      </View>
                      <Text style={styles.favoriteTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.subtitle && (
                        <Text style={styles.favoriteSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      testID={`favorite-remove-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.title} from favorites`}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.removeButtonPressed,
                      ]}
                      onPress={() => removeFavorite(item.id)}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Quick-add search so POIs and Rooms can also be saved right from the drawer */}
          <View style={styles.quickAddSection}>
            <Text style={styles.quickAddHeading}>Quick Add Place</Text>
            <TextInput
              testID="favorites-quick-add-input"
              accessibilityLabel="Quick add a room or POI"
              style={styles.quickAddInput}
              value={quickQuery}
              onChangeText={setQuickQuery}
              placeholder="Search rooms, POIs, buildings..."
              placeholderTextColor={SUBTLE}
              autoCorrect={false}
            />
            {quickSuggestions.length === 0 ? (
              <Text style={styles.quickEmpty}>No matching places found.</Text>
            ) : (
              quickSuggestions.map(({ place }) => {
                const saved = isFavorite(place.id);
                return (
                  <Pressable
                    key={place.id}
                    testID={`quick-add-${place.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: saved }}
                    style={({ pressed }) => [
                      styles.quickRow,
                      pressed && styles.quickRowPressed,
                    ]}
                    onPress={() => toggleFavorite(place)}
                  >
                    <View style={styles.quickTextWrap}>
                      <Text style={styles.quickTitle} numberOfLines={1}>
                        {place.title}
                      </Text>
                      {place.subtitle && (
                        <Text style={styles.quickSubtitle} numberOfLines={1}>
                          {place.subtitle}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.quickActionPill,
                        saved && styles.quickActionPillSaved,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickActionText,
                          saved && styles.quickActionTextSaved,
                        ]}
                      >
                        {saved ? "★ Saved" : "+ Save"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

        {favorites.length > 0 && (
          <View style={styles.drawerFooter}>
            <Pressable
              testID="favorites-clear-button"
              accessibilityRole="button"
              accessibilityLabel="Clear all favorites"
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.clearButtonPressed,
              ]}
              onPress={clearFavorites}
            >
              <Text style={styles.clearButtonText}>Clear Temporary List</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
    gap: 5,
  },
  toggleButtonActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  toggleButtonPressed: {
    opacity: 0.85,
  },
  toggleStar: {
    fontSize: 13,
    color: SUBTLE,
  },
  toggleStarSaved: {
    color: GOLD,
  },
  toggleLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12.5,
    color: INK,
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  toggleBadge: {
    backgroundColor: GOLD_BG,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  toggleBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: GOLD,
  },
  toggleBadgeTextActive: {
    color: "#FFFFFF",
  },

  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.36)",
  },
  drawerPanel: {
    width: 316,
    maxWidth: "86%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: -4, height: 0 },
    elevation: 16,
    paddingTop: 52,
    position: "relative",
  },
  sideRailHandle: {
    position: "absolute",
    left: -24,
    top: "45%",
    width: 24,
    height: 52,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: -2, height: 0 },
    elevation: 8,
  },
  sideRailHandleText: {
    fontSize: 18,
    color: SUBTLE,
    fontFamily: "Inter_700Bold",
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  drawerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  drawerStar: {
    fontSize: 17,
    color: GOLD,
  },
  drawerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: INK,
  },
  headerCountPill: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  headerCountText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11.5,
    color: SUBTLE,
  },
  collapseButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
  },
  collapseButtonPressed: {
    backgroundColor: "#F1F5F9",
  },
  collapseButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: INK,
  },
  storageNotice: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
  },
  storageNoticeTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11.5,
    color: INK,
  },
  storageNoticeBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 15,
    color: SUBTLE,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  filterChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: SUBTLE,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  scrollBody: {
    flex: 1,
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 14,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyIcon: {
    fontSize: 26,
    color: GOLD,
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: INK,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: SUBTLE,
    textAlign: "center",
    marginTop: 4,
  },
  filteredEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: SUBTLE,
    paddingVertical: 14,
    textAlign: "center",
  },
  listSection: {
    gap: 8,
  },
  favoriteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    overflow: "hidden",
  },
  favoriteMain: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  favoriteMainPressed: {
    backgroundColor: "#F8FAFC",
  },
  kindBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 2,
  },
  kindBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  favoriteTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: INK,
  },
  favoriteSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    color: SUBTLE,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonPressed: {
    backgroundColor: "#FEE2E2",
  },
  removeButtonText: {
    fontSize: 13,
    color: SUBTLE,
    fontFamily: "Inter_600SemiBold",
  },
  quickAddSection: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 12,
    gap: 8,
  },
  quickAddHeading: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12.5,
    color: INK,
  },
  quickAddInput: {
    height: 38,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: INK,
  },
  quickEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: SUBTLE,
    paddingVertical: 4,
  },
  quickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  quickRowPressed: {
    backgroundColor: "#F8FAFC",
  },
  quickTextWrap: {
    flex: 1,
  },
  quickTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12.5,
    color: INK,
  },
  quickSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: SUBTLE,
  },
  quickActionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
  },
  quickActionPillSaved: {
    backgroundColor: GOLD_BG,
  },
  quickActionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: ACCENT,
  },
  quickActionTextSaved: {
    color: GOLD,
  },
  drawerFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  clearButton: {
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  clearButtonPressed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  clearButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12.5,
    color: "#DC2626",
  },
});
