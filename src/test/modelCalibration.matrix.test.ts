import { describe, expect, it } from "vitest";
import { resolveCalibration } from "@/lib/engine/modelCalibration";

describe("model calibration matrix", () => {
  it("applies face id calibration for iPhone 13 family", () => {
    const result = resolveCalibration(14, "face_id");
    expect(result.applied).toBe(true);
    expect(result.confidenceDelta).toBeGreaterThan(0);
    expect(result.boardChanceDelta).toBeGreaterThan(0);
  });

  it("applies critical subsystem calibration for recent models", () => {
    const result = resolveCalibration(16, "nand");
    expect(result.applied).toBe(true);
    expect(result.boardChanceDelta).toBeGreaterThanOrEqual(6);
  });

  it("applies legacy peripheral-first calibration", () => {
    const result = resolveCalibration(10, "charging");
    expect(result.applied).toBe(true);
    expect(result.boardChanceDelta).toBeLessThan(0);
  });

  it("does not apply calibration for unknown category", () => {
    const result = resolveCalibration(14, "unknown");
    expect(result.applied).toBe(false);
    expect(result.confidenceDelta).toBe(0);
    expect(result.boardChanceDelta).toBe(0);
  });
});

