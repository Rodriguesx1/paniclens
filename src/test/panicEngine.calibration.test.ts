import { describe, expect, it } from "vitest";
import { parsePanicLog } from "@/lib/parser/panicParser";
import { diagnose } from "@/lib/engine/diagnose";

function run(raw: string) {
  const parsed = parsePanicLog(raw);
  return diagnose(parsed);
}

describe("panic-full engine calibration", () => {
  it("prioritizes thermal/sensors with structured extraction", () => {
    const raw = `
panic(cpu 0 caller 0xfffffff): userspace watchdog timeout: no successful checkins from com.apple.thermalmonitord in 180 seconds
missing sensor(s): TG0B TG1A PRS0
Process: thermalmonitord
Hardware Model: iPhone14,2
OS Version: iOS 17.6
`;
    const result = run(raw);
    expect(result.primaryCategory).toMatch(/thermal|sensors/);
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.recommendedTestSequence.length).toBeGreaterThan(0);
    expect(result.evidences.some(e => e.evidenceKey === "missing_sensor_name")).toBe(true);
  });

  it("keeps battery flow in simple-swap path when battery comm fails", () => {
    const raw = `
panic(cpu 1 caller 0xfffffff): battery communication failure smartbattery gasgauge
battery auth failure
charging negotiation timeout tristar
Product Type: iPhone14,5
`;
    const result = run(raw);
    expect(result.primaryCategory).toMatch(/battery|charging/);
    expect(result.likelyRepairTier).toMatch(/simple_swap|connector_or_line_check/);
    expect(result.likelySimpleSwapChance).toBeGreaterThanOrEqual(40);
    expect(result.likelyBoardRepairChance).toBeLessThan(70);
  });

  it("elevates codec+i2c as board diagnosis when both are present", () => {
    const raw = `
panic(cpu 2 caller 0xfffffff): audio route timeout
audio codec timeout cs42l83
i2c timeout bus error codec i2c
Process: audiomxd
`;
    const result = run(raw);
    expect(result.primaryCategory).toBe("codec");
    expect(result.likelyRepairTier).toBe("advanced_board_diagnosis");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(65);
  });

  it("flags baseband/modem as high board-level probability", () => {
    const raw = `
panic(cpu 0 caller 0xfffffff): baseband panic qmi_error
CommCenter: baseband panic detected
modem crash reset mav20
`;
    const result = run(raw);
    expect(result.primaryCategory).toMatch(/baseband|modem/);
    expect(result.likelyBoardRepairChance).toBeGreaterThanOrEqual(70);
    expect(result.technicalAlerts.length).toBeGreaterThan(0);
  });

  it("keeps conflicting evidence explicit (nand vs storage)", () => {
    const raw = `
panic(cpu 0 caller 0xfffffff): nvme panic appleastrisnand
nand error on read path
apfs panic with io error on disk
`;
    const result = run(raw);
    expect(result.primaryCategory).toMatch(/nand|storage/);
    expect(result.evidences.some(e => e.isConflicting)).toBe(true);
    expect(result.hypotheses.some(h => h.explanation.toLowerCase().includes("conflitante"))).toBe(true);
  });

  it("applies model calibration for face id on face-id-era devices", () => {
    const raw = `
panic(cpu 0 caller 0xfffffff): userspace watchdog timeout
no successful checkins from biometrickitd in 180 seconds
face id truedepth dot projector flood ill
Hardware Model: iPhone14,2
`;
    const result = run(raw);
    expect(result.primaryCategory).toBe("face_id");
    expect(result.technicalAlerts.some(a => a.toLowerCase().includes("família") || a.toLowerCase().includes("face id"))).toBe(true);
    expect(result.executiveSummary.toLowerCase().includes("calibração contextual por modelo")).toBe(true);
  });

  it("biases legacy charging failures toward peripheral-first path", () => {
    const raw = `
panic(cpu 0 caller 0xfffffff): charging negotiation timeout tristar
dock connector communication fault
battery communication failure
Hardware Model: iPhone10,1
`;
    const result = run(raw);
    expect(result.primaryCategory).toMatch(/battery|charging|dock_flex/);
    expect(result.likelyBoardRepairChance).toBeLessThanOrEqual(66);
    expect(result.technicalAlerts.some(a => a.toLowerCase().includes("família") || a.toLowerCase().includes("modelo legado"))).toBe(true);
  });
});

