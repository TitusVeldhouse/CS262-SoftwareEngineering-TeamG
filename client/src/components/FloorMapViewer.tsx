import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, G, Polygon, Polyline } from "react-native-svg";
import { calculateMapFrame, clampMapScale } from "./map-geometry";

// Overlay points use source-PNG pixels so they stay aligned at every zoom level.
type MapPoint = readonly [number, number];
const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

export type RoomHighlight = {
  id: string;
  points: readonly MapPoint[];
};

export type RoutePath = {
  id: string;
  points: readonly MapPoint[];
};

type FloorMapViewerProps = {
  asset: number;
  title: string;
  imageWidth: number;
  imageHeight: number;
  highlights?: readonly RoomHighlight[];
  routes?: readonly RoutePath[];
};

type Size = {
  width: number;
  height: number;
};

function toSvgPoints(points: readonly MapPoint[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export default function FloorMapViewer({
  asset,
  title,
  imageWidth,
  imageHeight,
  highlights = [],
  routes = [],
}: FloorMapViewerProps) {
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const mapFrame = calculateMapFrame(
    imageWidth,
    imageHeight,
    viewport.width,
    viewport.height,
  );
  const mapWidth = mapFrame.width;
  const mapHeight = mapFrame.height;

  const scale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      pinchStartScale.set(scale.get());
    })
    .onUpdate((event) => {
      const nextScale = pinchStartScale.get() * event.scale;
      // Keep the clamp inline because pinch updates run as UI worklets.
      scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale)));
    });

  // Leave two-finger input exclusively to the pinch recognizer.
  const pan = Gesture.Pan().maxPointers(1)
    .onBegin(() => {
      panStartX.set(translateX.get());
      panStartY.set(translateY.get());
    })
    .onUpdate((event) => {
      translateX.set(panStartX.get() + event.translationX);
      translateY.set(panStartY.get() + event.translationY);
    });

  // One transform keeps the raster and its SVG highlights/routes in sync.
  const mapGesture = Gesture.Simultaneous(pan, pinch);
  const mapTransform = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  useEffect(() => {
    scale.set(1);
    translateX.set(0);
    translateY.set(0);
  }, [asset, scale, translateX, translateY]);

  const isLoading =
    !failed && (!loaded || viewport.width === 0 || viewport.height === 0);

  const zoomBy = (factor: number) => {
    scale.set(withTiming(clampMapScale(scale.get() * factor), { duration: 140 }));
  };

  const fitMap = () => {
    scale.set(withTiming(1, { duration: 140 }));
    translateX.set(withTiming(0, { duration: 140 }));
    translateY.set(withTiming(0, { duration: 140 }));
  };

  return (
    <View style={styles.root} testID="plan-viewer">
      <View
        style={styles.mapStage}
        testID="map-stage"
        onLayout={({ nativeEvent }) =>
          setViewport({
            width: nativeEvent.layout.width,
            height: nativeEvent.layout.height,
          })
        }
      >
        {failed ? (
          <Text style={styles.message} testID="plan-load-error">
            This floor plan could not be loaded.
          </Text>
        ) : (
          <>
            <GestureDetector gesture={mapGesture}>
              <Animated.View
                style={[
                  styles.mapSurface,
                  {
                    width: mapWidth,
                    height: mapHeight,
                    left: mapFrame.left,
                    top: mapFrame.top,
                  },
                  mapTransform,
                ]}
                accessibilityLabel={title}
                testID="map-surface"
              >
                <Image
                  source={asset}
                  resizeMode="stretch"
                  style={StyleSheet.absoluteFill}
                  onLoad={() => setLoaded(true)}
                  onError={() => setFailed(true)}
                  accessibilityLabel={title}
                />
                <Svg
                  width={mapWidth}
                  height={mapHeight}
                  // Keep overlay coordinates in the original image's pixel space.
                  viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                  preserveAspectRatio="none"
                  style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
                  testID="map-overlay"
                >
                    {highlights.map((highlight) => (
                      <Polygon
                        key={highlight.id}
                        points={toSvgPoints(highlight.points)}
                        fill="#208AEF"
                        fillOpacity={0.32}
                        stroke="#1671CB"
                        strokeWidth={4}
                      />
                    ))}
                    {routes.map((route) => {
                      const start = route.points[0];
                      const end = route.points[route.points.length - 1];
                      return (
                        <G key={route.id}>
                          <Polyline
                            points={toSvgPoints(route.points)}
                            fill="none"
                            stroke="#D35443"
                            strokeWidth={8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {start && <Circle cx={start[0]} cy={start[1]} r={12} fill="#208AEF" />}
                          {end && <Circle cx={end[0]} cy={end[1]} r={12} fill="#D35443" />}
                        </G>
                      );
                    })}
                </Svg>
              </Animated.View>
            </GestureDetector>

            {isLoading && (
              <View style={[styles.loading, { pointerEvents: "none" }]}>
                <ActivityIndicator color="#208AEF" testID="plan-loading" />
              </View>
            )}

            <View style={styles.mapControls}>
              <Pressable
                testID="zoom-in"
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                style={styles.mapControl}
                onPress={() => zoomBy(1.5)}
              >
                <Text style={styles.mapControlText}>+</Text>
              </Pressable>
              <Pressable
                testID="zoom-out"
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                style={styles.mapControl}
                onPress={() => zoomBy(1 / 1.5)}
              >
                <Text style={styles.mapControlText}>-</Text>
              </Pressable>
              <Pressable
                testID="reset-map"
                accessibilityRole="button"
                accessibilityLabel="Center and fit map"
                style={styles.fitControl}
                onPress={fitMap}
              >
                <Text style={styles.fitControlText}>Fit</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  mapStage: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  mapSurface: {
    position: "absolute",
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    elevation: 2,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControls: {
    position: "absolute",
    top: 12,
    right: 12,
    gap: 6,
  },
  mapControl: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    boxShadow: "0px 1px 4px rgba(16, 24, 40, 0.18)",
  },
  mapControlText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    lineHeight: 26,
    color: "#101828",
  },
  fitControl: {
    minWidth: 38,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    boxShadow: "0px 1px 4px rgba(16, 24, 40, 0.18)",
  },
  fitControlText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#101828",
  },
  message: {
    paddingHorizontal: 20,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#5B6472",
    textAlign: "center",
  },
});