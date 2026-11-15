import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Polygon, Polyline } from "react-native-svg";
import ZoomablePlan, { type PlanPoint } from "./ZoomablePlan";

// Overlay points use source-PNG pixels, the same space ZoomablePlan works in,
// so they stay aligned with the plan at every zoom level.
type MapPoint = readonly [number, number];

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
  /** Plan point (image pixels) to center and mark, e.g. the selected room. */
  focusPoint?: PlanPoint | null;
};

function toSvgPoints(points: readonly MapPoint[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/**
 * Shows one floor plan image with room highlights and routes drawn on top.
 * Panning and zooming are handled by ZoomablePlan.
 */
export default function FloorMapViewer({
  asset,
  title,
  imageWidth,
  imageHeight,
  highlights = [],
  routes = [],
  focusPoint = null,
}: FloorMapViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={styles.root} testID="plan-viewer">
        <View style={styles.centered}>
          <Text style={styles.message} testID="plan-load-error">
            This floor plan could not be loaded.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="plan-viewer">
      <ZoomablePlan contentWidth={imageWidth} contentHeight={imageHeight} focusPoint={focusPoint}>
        <Image
          source={asset}
          resizeMode="stretch"
          style={[
            { width: imageWidth, height: imageHeight },
            // @ts-ignore - prevent ghost image drag on web
            { userSelect: "none" },
          ]}
          // @ts-ignore - web only: stop the browser's own image dragging
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          accessibilityLabel={title}
          testID="floor-plan-image"
        />
        <Svg
          width={imageWidth}
          height={imageHeight}
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
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
      </ZoomablePlan>

      {!loaded && (
        <View style={[styles.centered, { pointerEvents: "none" }]}>
          <ActivityIndicator color="#208AEF" testID="plan-loading" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  centered: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    paddingHorizontal: 20,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#5B6472",
    textAlign: "center",
  },
});
