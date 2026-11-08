import {
  calculateMapFrame,
  clampMapScale,
  calculatePanLimits,
  calculatePanLimitsFromDimensions,
  calculateDynamicMinScale,
  clampPanOffset,
  MAP_PADDING,
  MIN_MAP_SCALE,
  MAX_MAP_SCALE,
  DEFAULT_PAN_MARGIN,
} from "../components/map-geometry";

describe("Map Geometry & Pan Boundary Clamping", () => {
  describe("calculateMapFrame", () => {
    it("fits landscape image inside portrait viewport with padding", () => {
      const frame = calculateMapFrame(1600, 800, 400, 600);

      // Available width is 400 - 56 = 344. Width scale = 344 / 1600 = 0.215.
      // Available height is 600 - 56 = 544. Height scale = 544 / 800 = 0.68.
      // Fit scale is min(0.215, 0.68) = 0.215.
      expect(frame.width).toBeCloseTo(344);
      expect(frame.height).toBeCloseTo(172);
      expect(frame.left).toBeCloseTo((400 - 344) / 2);
      expect(frame.top).toBeCloseTo((600 - 172) / 2);
    });

    it("handles zero or negative viewport safely", () => {
      const frame = calculateMapFrame(1000, 500, 0, 0);
      expect(frame.width).toBe(0);
      expect(frame.height).toBe(0);
      expect(frame.left).toBe(0);
      expect(frame.top).toBe(0);
    });

    it("handles viewport smaller than padding without negative sizes", () => {
      const frame = calculateMapFrame(1000, 500, 20, 20);
      expect(frame.width).toBe(0);
      expect(frame.height).toBe(0);
      expect(frame.left).toBe(10);
      expect(frame.top).toBe(10);
    });

    it("handles zero or negative image dimensions safely", () => {
      const frameZeroW = calculateMapFrame(0, 500, 400, 600);
      expect(frameZeroW.width).toBe(0);
      expect(frameZeroW.height).toBe(0);

      const frameZeroH = calculateMapFrame(500, 0, 400, 600);
      expect(frameZeroH.width).toBe(0);
      expect(frameZeroH.height).toBe(0);
    });

    it("correctly fits extremely tall portrait schematics", () => {
      const frame = calculateMapFrame(400, 2000, 500, 700);
      // available height is 700 - 56 = 644. Height scale = 644 / 2000 = 0.322.
      // Width scale = (500 - 56) / 400 = 1.11.
      // Fit scale is 0.322.
      expect(frame.height).toBeCloseTo(644);
      expect(frame.width).toBeCloseTo(400 * (644 / 2000));
      expect(frame.top).toBeCloseTo(MAP_PADDING);
    });

    it("correctly fits extremely wide panoramic schematics", () => {
      const frame = calculateMapFrame(3000, 500, 500, 700);
      // available width is 500 - 56 = 444. Width scale = 444 / 3000 = 0.148.
      // Height scale = (700 - 56) / 500 = 1.288.
      // Fit scale is 0.148.
      expect(frame.width).toBeCloseTo(444);
      expect(frame.height).toBeCloseTo(500 * (444 / 3000));
      expect(frame.left).toBeCloseTo(MAP_PADDING);
    });
  });

  describe("calculateDynamicMinScale", () => {
    it("returns 0.3 for extra large blueprints with dimension >= 1500", () => {
      // DC AND BU (1982x1378)
      expect(calculateDynamicMinScale(1982, 1378)).toBe(0.3);
      // Devries Hall (1570x1064)
      expect(calculateDynamicMinScale(1570, 1064)).toBe(0.3);
      // Tall building (1000x1600)
      expect(calculateDynamicMinScale(1000, 1600)).toBe(0.3);
    });

    it("returns MIN_MAP_SCALE (0.5) for standard and smaller blueprints", () => {
      // Hiemenga Hall (1287x1058)
      expect(calculateDynamicMinScale(1287, 1058)).toBe(MIN_MAP_SCALE);
      // Compact blueprint (781x742)
      expect(calculateDynamicMinScale(781, 742)).toBe(MIN_MAP_SCALE);
    });
  });

  describe("clampMapScale", () => {
    it("clamps scale within MIN_MAP_SCALE and MAX_MAP_SCALE by default", () => {
      expect(clampMapScale(0.1)).toBe(MIN_MAP_SCALE);
      expect(clampMapScale(10)).toBe(MAX_MAP_SCALE);
      expect(clampMapScale(2.5)).toBe(2.5);
    });

    it("clamps scale using custom dynamic minScale", () => {
      expect(clampMapScale(0.2, 0.3, 5)).toBe(0.3);
      expect(clampMapScale(0.4, 0.3, 5)).toBe(0.4);
    });
  });

  describe("clampPanOffset", () => {
    it("clamps values between min and max bounds", () => {
      expect(clampPanOffset(50, -100, 100)).toBe(50);
      expect(clampPanOffset(-250, -100, 100)).toBe(-100);
      expect(clampPanOffset(300, -100, 100)).toBe(100);
    });
  });

  describe("calculatePanLimits", () => {
    const mockFrame = {
      width: 360,
      height: 240,
      left: 20,
      top: 180,
    };
    const viewportW = 400;
    const viewportH = 600;

    it("calculates generous bounds when image fits inside viewport (scale <= 1)", () => {
      // At scale = 1, scaledW = 360, scaledH = 240. Margin = 50.
      // maxTx = Math.max(50, (360 + 400) / 2 - 50) = 380 - 50 = 330
      // maxTy = Math.max(50, (240 + 600) / 2 - 50) = 420 - 50 = 370
      const limits = calculatePanLimits(mockFrame, 1.0, viewportW, viewportH, 50);

      expect(limits.minX).toBe(-330);
      expect(limits.maxX).toBe(330);
      expect(limits.minY).toBe(-370);
      expect(limits.maxY).toBe(370);
    });

    it("expands pan boundaries proportionally when zoomed in (scale > 1)", () => {
      // At scale = 2.0, scaledW = 720, scaledH = 480. Margin = 50.
      // maxTx = Math.max(50, (720 + 400) / 2 - 50) = 560 - 50 = 510
      // maxTy = Math.max(50, (480 + 600) / 2 - 50) = 540 - 50 = 490
      const limits = calculatePanLimits(mockFrame, 2.0, viewportW, viewportH, 50);

      expect(limits.minX).toBe(-510);
      expect(limits.maxX).toBe(510);
      expect(limits.minY).toBe(-490);
      expect(limits.maxY).toBe(490);
    });

    it("allows full multidirectional navigation when both dimensions exceed viewport", () => {
      // At scale = 3.0, scaledW = 1080, scaledH = 720. Margin = 40.
      // maxTx = Math.max(40, (1080 + 400) / 2 - 40) = 740 - 40 = 700
      // maxTy = Math.max(40, (720 + 600) / 2 - 40) = 660 - 40 = 620
      const limits = calculatePanLimits(mockFrame, 3.0, viewportW, viewportH, 40);

      expect(limits.minX).toBe(-700);
      expect(limits.maxX).toBe(700);
      expect(limits.minY).toBe(-620);
      expect(limits.maxY).toBe(620);
    });

    it("maintains symmetric pan bounds centered around origin", () => {
      const limits = calculatePanLimits(mockFrame, 1.8, viewportW, viewportH, 60);
      expect(limits.minX).toBe(-limits.maxX);
      expect(limits.minY).toBe(-limits.maxY);
    });

    it("safely handles zero dimensions without crashing", () => {
      const limits = calculatePanLimits(mockFrame, 1.0, 0, 0, 50);
      expect(limits.minX).toBe(-50);
      expect(limits.maxX).toBe(50);
      expect(limits.minY).toBe(-50);
      expect(limits.maxY).toBe(50);
    });

    it("dynamically computes pan margin when margin parameter is omitted", () => {
      // For DC AND BU (1982x1378) at scale 1.0 in a 400x600 viewport:
      // dynamicMarginX = Math.max(40, Math.min(400 * 0.12, 1982 * 0.1, 80)) = Math.max(40, 48) = 48
      // dynamicMarginY = Math.max(40, Math.min(600 * 0.12, 1378 * 0.1, 80)) = Math.max(40, 72) = 72
      // maxTx = Math.max(48, (1982 + 400) / 2 - 48) = 1191 - 48 = 1143
      // maxTy = Math.max(72, (1378 + 600) / 2 - 72) = 989 - 72 = 917
      const limitsLarge = calculatePanLimitsFromDimensions(1982, 1378, 1.0, 400, 600);
      expect(limitsLarge.maxX).toBe(1143);
      expect(limitsLarge.minX).toBe(-1143);
      expect(limitsLarge.maxY).toBe(917);
      expect(limitsLarge.minY).toBe(-917);

      // Compare with smaller map (e.g., 600x400):
      // dynamicMarginX = Math.max(40, Math.min(48, 60, 80)) = 48
      // dynamicMarginY = Math.max(40, Math.min(72, 40, 80)) = 40
      // maxTx = Math.max(48, (600 + 400) / 2 - 48) = 500 - 48 = 452
      // maxTy = Math.max(40, (400 + 600) / 2 - 40) = 500 - 40 = 460
      const limitsSmall = calculatePanLimitsFromDimensions(600, 400, 1.0, 400, 600);
      expect(limitsSmall.maxX).toBe(452);
      expect(limitsSmall.maxY).toBe(460);
      // Limits dynamically scale so larger blueprints have wider reach
      expect(limitsLarge.maxX).toBeGreaterThan(limitsSmall.maxX);
      expect(limitsLarge.maxY).toBeGreaterThan(limitsSmall.maxY);
    });
  });
});

