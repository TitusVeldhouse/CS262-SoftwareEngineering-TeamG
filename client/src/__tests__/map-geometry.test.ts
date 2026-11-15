import {
  calculateAxisBounds,
  calculateFitScale,
  calculateFitTransform,
  calculateFocusTransform,
  calculateScaleLimits,
  calculateSettledTransform,
  clamp,
  clampTransform,
  isWithinBounds,
  MAP_PADDING,
  MAX_ZOOM,
  rubberBand,
  rubberBandTransform,
  zoomAroundPoint,
} from "../components/map-geometry";

// A landscape floor plan shown in a portrait phone-sized viewer.
const plan = { width: 1600, height: 1000 };
const phone = { width: 400, height: 700 };

// Where a plan point ends up on screen: screen = x + point * scale.
const toScreen = (t: { scale: number; x: number; y: number }, px: number, py: number) => [
  t.x + px * t.scale,
  t.y + py * t.scale,
];

describe("map geometry", () => {
  describe("calculateFitScale / calculateFitTransform", () => {
    it("fits the whole plan inside the padded viewer", () => {
      const scale = calculateFitScale(plan, phone);
      expect(scale).toBeCloseTo((400 - MAP_PADDING * 2) / 1600);
      expect(plan.width * scale).toBeLessThanOrEqual(phone.width - MAP_PADDING * 2 + 0.001);
      expect(plan.height * scale).toBeLessThanOrEqual(phone.height - MAP_PADDING * 2 + 0.001);
    });

    it("centers the fitted plan on both axes", () => {
      const fit = calculateFitTransform(plan, phone);
      const [left, top] = toScreen(fit, 0, 0);
      const [right, bottom] = toScreen(fit, plan.width, plan.height);
      expect(left).toBeCloseTo(phone.width - right);
      expect(top).toBeCloseTo(phone.height - bottom);
    });

    it("returns 0 until both sizes are known", () => {
      expect(calculateFitScale(plan, { width: 0, height: 0 })).toBe(0);
      expect(calculateFitScale({ width: 0, height: 900 }, phone)).toBe(0);
    });
  });

  describe("calculateScaleLimits", () => {
    it("runs from fit-to-screen up to MAX_ZOOM times that", () => {
      const limits = calculateScaleLimits(plan, phone);
      expect(limits.min).toBeCloseTo(calculateFitScale(plan, phone));
      expect(limits.max).toBeCloseTo(limits.min * MAX_ZOOM);
    });
  });

  describe("calculateAxisBounds", () => {
    it("allows exactly one (centered) position when the plan is smaller than the viewer", () => {
      expect(calculateAxisBounds(1000, 0.3, 700)).toEqual({ min: 200, max: 200 });
    });

    it("lets the plan move until its edges meet the viewer's edges when larger", () => {
      // 1600px * 0.5 = 800px wide in a 400px viewer: x from -400 (right edges meet) to 0.
      expect(calculateAxisBounds(1600, 0.5, 400)).toEqual({ min: -400, max: 0 });
    });
  });

  describe("clampTransform", () => {
    it("pulls a dragged-off plan back so no empty space shows at the edge", () => {
      // At scale 0.5 the plan is 800 x 500 in a 400 x 700 viewer: it is wider
      // than the viewer (x may go from -400 to 0) but shorter (y must center at 100).
      const clamped = clampTransform({ scale: 0.5, x: 120, y: -900 }, plan, phone);
      expect(clamped).toEqual({ scale: 0.5, x: 0, y: 100 });
      expect(isWithinBounds(clamped, plan, phone)).toBe(true);
    });

    it("keeps a small plan centered on the axis where it fits", () => {
      const fitScale = calculateFitScale(plan, phone);
      const clamped = clampTransform({ scale: fitScale, x: 50, y: 0 }, plan, phone);
      expect(clamped.x).toBeCloseTo((phone.width - plan.width * fitScale) / 2);
      expect(clamped.y).toBeCloseTo((phone.height - plan.height * fitScale) / 2);
    });
  });

  describe("rubberBand", () => {
    it("leaves values inside the range alone", () => {
      expect(rubberBand(5, 0, 10, 100)).toBe(5);
    });

    it("resists past the edge and never goes further than the limit", () => {
      const slightly = rubberBand(-50, 0, 10, 100);
      const far = rubberBand(-5000, 0, 10, 100);
      expect(slightly).toBeLessThan(0);
      expect(slightly).toBeGreaterThan(-50);
      expect(far).toBeGreaterThan(-100);
      expect(far).toBeLessThan(slightly);
      expect(rubberBand(60, 0, 10, 100)).toBeLessThan(60);
    });

    it("applies to both axes of a transform", () => {
      const banded = rubberBandTransform({ scale: 0.5, x: 300, y: 0 }, plan, phone);
      expect(banded.x).toBeGreaterThan(0);
      expect(banded.x).toBeLessThan(300);
    });
  });

  describe("zoomAroundPoint", () => {
    it("keeps the plan point under the fingers in the same screen spot", () => {
      const start = { scale: 0.5, x: -100, y: -50 };
      const focal = [180, 260] as const;
      const planPointX = (focal[0] - start.x) / start.scale;
      const planPointY = (focal[1] - start.y) / start.scale;

      const zoomed = zoomAroundPoint(start, 1.25, focal[0], focal[1]);
      const [screenX, screenY] = toScreen(zoomed, planPointX, planPointY);
      expect(zoomed.scale).toBe(1.25);
      expect(screenX).toBeCloseTo(focal[0]);
      expect(screenY).toBeCloseTo(focal[1]);
    });
  });

  describe("calculateFocusTransform", () => {
    it("centers the room at the requested zoom", () => {
      const room = [800, 500] as const; // middle of the plan
      const focused = calculateFocusTransform(room[0], room[1], 2.5, plan, phone);
      const [screenX, screenY] = toScreen(focused, room[0], room[1]);
      expect(focused.scale).toBeCloseTo(calculateFitScale(plan, phone) * 2.5);
      expect(screenX).toBeCloseTo(phone.width / 2);
      expect(screenY).toBeCloseTo(phone.height / 2);
    });

    it("keeps the plan's edges on screen for a room in a corner", () => {
      const focused = calculateFocusTransform(0, 0, 2.5, plan, phone);
      expect(isWithinBounds(focused, plan, phone)).toBe(true);
    });

    it("never zooms past MAX_ZOOM", () => {
      const limits = calculateScaleLimits(plan, phone);
      expect(calculateFocusTransform(800, 500, 50, plan, phone).scale).toBeCloseTo(limits.max);
    });
  });

  describe("calculateSettledTransform", () => {
    it("springs back to fit after pinching smaller than fit", () => {
      const fit = calculateFitTransform(plan, phone);
      const tooSmall = { scale: fit.scale * 0.8, x: 90, y: 300 };
      const settled = calculateSettledTransform(tooSmall, 200, 350, plan, phone);
      expect(settled.scale).toBeCloseTo(fit.scale);
      expect(settled.x).toBeCloseTo(fit.x);
      expect(settled.y).toBeCloseTo(fit.y);
    });

    it("comes back down to MAX_ZOOM after over-pinching, staying in bounds", () => {
      const limits = calculateScaleLimits(plan, phone);
      const tooBig = { scale: limits.max * 1.2, x: -2000, y: -1500 };
      const settled = calculateSettledTransform(tooBig, 200, 350, plan, phone);
      expect(settled.scale).toBeCloseTo(limits.max);
      expect(isWithinBounds(settled, plan, phone)).toBe(true);
    });
  });

  it("clamp keeps a value inside a range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
