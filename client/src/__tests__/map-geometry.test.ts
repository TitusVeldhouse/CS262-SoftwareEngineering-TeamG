import {
  calculateMapFrame,
  clampMapScale,
  calculatePanLimits,
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

      // Available width is 400 - 32 = 368. Width scale = 368 / 1600 = 0.23.
      // Available height is 600 - 32 = 568. Height scale = 568 / 800 = 0.71.
      // Fit scale is min(0.23, 0.71) = 0.23.
      expect(frame.width).toBeCloseTo(368);
      expect(frame.height).toBeCloseTo(184);
      expect(frame.left).toBeCloseTo((400 - 368) / 2);
      expect(frame.top).toBeCloseTo((600 - 184) / 2);
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
      // available height is 700 - 32 = 668. Height scale = 668 / 2000 = 0.334.
      // Width scale = (500 - 32) / 400 = 1.17.
      // Fit scale is 0.334.
      expect(frame.height).toBeCloseTo(668);
      expect(frame.width).toBeCloseTo(400 * (668 / 2000));
      expect(frame.top).toBeCloseTo(MAP_PADDING);
    });

    it("correctly fits extremely wide panoramic schematics", () => {
      const frame = calculateMapFrame(3000, 500, 500, 700);
      // available width is 500 - 32 = 468. Width scale = 468 / 3000 = 0.156.
      // Height scale = (700 - 32) / 500 = 1.336.
      // Fit scale is 0.156.
      expect(frame.width).toBeCloseTo(468);
      expect(frame.height).toBeCloseTo(500 * (468 / 3000));
      expect(frame.left).toBeCloseTo(MAP_PADDING);
    });
  });

  describe("clampMapScale", () => {
    it("clamps scale within MIN_MAP_SCALE and MAX_MAP_SCALE", () => {
      expect(clampMapScale(0.1)).toBe(MIN_MAP_SCALE);
      expect(clampMapScale(10)).toBe(MAX_MAP_SCALE);
      expect(clampMapScale(2.5)).toBe(2.5);
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

    it("calculates tight bounds when image fits comfortably inside viewport (scale <= 1)", () => {
      // At scale = 1, scaledW = 360 <= 400, scaledH = 240 <= 600
      const limits = calculatePanLimits(mockFrame, 1.0, viewportW, viewportH, 50);

      // extraX = 0, extraY = 0 => maxTx = 50, maxTy = 50
      expect(limits.minX).toBe(-50);
      expect(limits.maxX).toBe(50);
      expect(limits.minY).toBe(-50);
      expect(limits.maxY).toBe(50);
    });

    it("expands pan boundaries proportionally when zoomed in (scale > 1)", () => {
      // At scale = 2.0, scaledW = 720 (> 400), scaledH = 480 (<= 600)
      const limits = calculatePanLimits(mockFrame, 2.0, viewportW, viewportH, 50);

      // extraX = 720 - 400 = 320 => maxTx = 160 + 50 = 210
      // extraY = 0 => maxTy = 50
      expect(limits.minX).toBe(-210);
      expect(limits.maxX).toBe(210);
      expect(limits.minY).toBe(-50);
      expect(limits.maxY).toBe(50);
    });

    it("allows full multidirectional navigation when both dimensions exceed viewport", () => {
      // At scale = 3.0, scaledW = 1080 (> 400), scaledH = 720 (> 600)
      const limits = calculatePanLimits(mockFrame, 3.0, viewportW, viewportH, 40);

      // extraX = 1080 - 400 = 680 => maxTx = 340 + 40 = 380
      // extraY = 720 - 600 = 120 => maxTy = 60 + 40 = 100
      expect(limits.minX).toBe(-380);
      expect(limits.maxX).toBe(380);
      expect(limits.minY).toBe(-100);
      expect(limits.maxY).toBe(100);
    });

    it("maintains symmetric pan bounds centered around origin", () => {
      const limits = calculatePanLimits(mockFrame, 1.8, viewportW, viewportH, 60);
      expect(limits.minX).toBe(-limits.maxX);
      expect(limits.minY).toBe(-limits.maxY);
    });

    it("respects custom margins for edge padding", () => {
      const tightMargin = calculatePanLimits(mockFrame, 1.0, viewportW, viewportH, 10);
      expect(tightMargin.maxX).toBe(10);
      expect(tightMargin.maxY).toBe(10);

      const generousMargin = calculatePanLimits(mockFrame, 1.0, viewportW, viewportH, 100);
      expect(generousMargin.maxX).toBe(100);
      expect(generousMargin.maxY).toBe(100);
    });
  });
});

