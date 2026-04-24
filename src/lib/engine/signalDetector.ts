import type { ParsedLog, RawEvidence } from '@/lib/parser/panicParser';
import type { DetectedSignal, ParserSummary } from './contracts';

type SignalSeed = {
  signalKey: string;
  category: DetectedSignal['category'];
  matchedText: string;
  normalizedValue: string;
  weight: number;
  confidenceContribution: number;
  sourceLine?: string;
  contextWindow?: string;
  ambiguityLevel: DetectedSignal['ambiguityLevel'];
};

const EVIDENCE_SIGNAL_MAP: Record<string, Partial<SignalSeed> & Pick<SignalSeed, 'signalKey' | 'category'>> = {
  thermalmonitord_no_checkins: { signalKey: 'thermalmonitord_detected', category: 'thermal' },
  thermal_pressure: { signalKey: 'thermal_pressure_pattern', category: 'thermal' },
  missing_sensors: { signalKey: 'missing_sensors_detected', category: 'sensors' },
  missing_sensor_name: { signalKey: 'missing_sensors_detected', category: 'sensors' },
  userspace_watchdog_timeout: { signalKey: 'userspace_watchdog_timeout', category: 'watchdog' },
  kernel_watchdog: { signalKey: 'kernel_watchdog_timeout', category: 'watchdog' },
  wdog_no_checkins_generic: { signalKey: 'watchdog_target_missed_checkins', category: 'watchdog' },
  wdog_target_process: { signalKey: 'watchdog_target_process', category: 'watchdog' },
  battery_comm_failure: { signalKey: 'battery_comm_failure', category: 'battery' },
  battery_health_anomaly: { signalKey: 'battery_health_anomaly', category: 'battery' },
  charging_negotiation: { signalKey: 'charging_anomaly', category: 'charging' },
  dock_anomaly: { signalKey: 'dock_related_pattern', category: 'dock_flex' },
  front_flex_ref: { signalKey: 'front_flex_related_pattern', category: 'front_flex' },
  proximity_ref: { signalKey: 'proximity_related_pattern', category: 'proximity' },
  face_id_ref: { signalKey: 'face_id_sensitive_pattern', category: 'face_id' },
  camera_ref: { signalKey: 'camera_related_pattern', category: 'camera' },
  audio_ref: { signalKey: 'audio_related_pattern', category: 'audio' },
  codec_ref: { signalKey: 'audio_codec_pattern', category: 'codec' },
  baseband_panic: { signalKey: 'baseband_pattern', category: 'baseband' },
  modem_crash: { signalKey: 'modem_crash_pattern', category: 'modem' },
  nand_anomaly: { signalKey: 'nand_storage_pattern', category: 'nand' },
  storage_io_failure: { signalKey: 'nand_storage_pattern', category: 'storage' },
  rail_instability: { signalKey: 'rail_instability_pattern', category: 'rail' },
  pmu_power: { signalKey: 'power_sequencing_pattern', category: 'power' },
  i2c_fault: { signalKey: 'i2c_fault_pattern', category: 'i2c' },
  kernel_data_abort: { signalKey: 'memory_access_fault', category: 'cpu_memory' },
  sep_panic: { signalKey: 'memory_access_fault', category: 'cpu_memory' },
  peripheral_bus: { signalKey: 'peripheral_bus_failure', category: 'peripheral_communication' },
};

function severityWeight(level: DetectedSignal['ambiguityLevel']): number {
  switch (level) {
    case 'low': return 0;
    case 'moderate': return 7;
    case 'high': return 12;
    default: return 4;
  }
}

function makeSignal(seed: SignalSeed): DetectedSignal {
  return {
    signalKey: seed.signalKey,
    category: seed.category,
    matchedText: seed.matchedText,
    normalizedValue: seed.normalizedValue,
    weight: seed.weight,
    confidenceContribution: seed.confidenceContribution,
    sourceLine: seed.sourceLine,
    contextWindow: seed.contextWindow,
    ambiguityLevel: seed.ambiguityLevel,
  };
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '"')
    .trim();
}

function findContext(lines: string[], needle: string): { sourceLine?: string; contextWindow?: string } {
  const lowered = needle.toLowerCase();
  const index = lines.findIndex(line => line.toLowerCase().includes(lowered));
  if (index === -1) return {};
  const start = Math.max(0, index - 1);
  const end = Math.min(lines.length - 1, index + 1);
  return {
    sourceLine: lines[index]?.trim(),
    contextWindow: lines.slice(start, end + 1).map(line => line.trim()).join('\n'),
  };
}

function pushUnique(target: DetectedSignal[], signal: DetectedSignal) {
  if (target.some(existing => existing.signalKey === signal.signalKey && existing.matchedText === signal.matchedText)) return;
  target.push(signal);
}

function buildMetaSignals(parsed: ParsedLog): DetectedSignal[] {
  const out: DetectedSignal[] = [];
  const meta = parsed.metadata;
  const hardware = meta.hardwareModel ?? meta.productType ?? '';
  if (hardware) {
    out.push(makeSignal({
      signalKey: 'device_model_present',
      category: 'meta',
      matchedText: hardware,
      normalizedValue: hardware.toLowerCase(),
      weight: 5,
      confidenceContribution: 5,
      ambiguityLevel: 'low',
    }));
  }
  if (meta.process) {
    out.push(makeSignal({
      signalKey: 'process_name_present',
      category: 'meta',
      matchedText: meta.process,
      normalizedValue: normalizeText(meta.process),
      weight: 5,
      confidenceContribution: 5,
      ambiguityLevel: 'low',
    }));
  }
  if (meta.panicString) {
    out.push(makeSignal({
      signalKey: 'panic_string_present',
      category: 'meta',
      matchedText: meta.panicString,
      normalizedValue: normalizeText(meta.panicString),
      weight: 4,
      confidenceContribution: 4,
      ambiguityLevel: 'low',
    }));
  }
  return out;
}

export function detectSignals(parsed: ParsedLog): DetectedSignal[] {
  const out: DetectedSignal[] = [];
  const lines = parsed.lines.length ? parsed.lines : parsed.normalizedText.split('\n');

  for (const ev of parsed.rawEvidences) {
    const seed = EVIDENCE_SIGNAL_MAP[ev.key];
    const context = ev.context ?? findContext(lines, ev.matchedText);
    pushUnique(out, makeSignal({
      signalKey: ev.key,
      category: (seed?.category ?? 'signal') as DetectedSignal['category'],
      matchedText: ev.matchedText,
      normalizedValue: normalizeText(ev.key),
      weight: ev.weight ?? 10,
      confidenceContribution: Math.min(18, Math.max(6, ev.weight ?? 10)),
      sourceLine: context.sourceLine,
      contextWindow: context.contextWindow,
      ambiguityLevel: ev.weight && ev.weight >= 30 ? 'low' : ev.weight && ev.weight >= 18 ? 'moderate' : 'high',
    }));
    if (seed && seed.signalKey !== ev.key) {
      pushUnique(out, makeSignal({
        signalKey: seed.signalKey,
        category: seed.category,
        matchedText: ev.matchedText,
        normalizedValue: normalizeText(seed.signalKey),
        weight: ev.weight ?? 10,
        confidenceContribution: Math.min(18, Math.max(6, ev.weight ?? 10)),
        sourceLine: context.sourceLine,
        contextWindow: context.contextWindow,
        ambiguityLevel: ev.weight && ev.weight >= 30 ? 'low' : ev.weight && ev.weight >= 18 ? 'moderate' : 'high',
      }));
    }
  }

  const text = parsed.normalizedText;
  const hasThermal = out.some(s => s.signalKey === 'thermalmonitord_detected');
  const hasMissingSensors = out.some(s => s.signalKey === 'missing_sensors_detected');
  const hasWatchdog = out.some(s => s.signalKey === 'userspace_watchdog_timeout' || s.signalKey === 'kernel_watchdog_timeout');
  const targetProcess = parsed.structured.watchdogTargets[0] ?? parsed.metadata.process ?? parsed.metadata.responsibleProcess;

  if (hasThermal && hasMissingSensors) {
    pushUnique(out, makeSignal({
      signalKey: 'thermal_sensor_chain_break',
      category: 'sensors',
      matchedText: 'thermalmonitord + missing sensor(s)',
      normalizedValue: 'thermal_sensor_chain_break',
      weight: 38,
      confidenceContribution: 18,
      ambiguityLevel: 'low',
      sourceLine: parsed.lines.find(line => /thermalmonitord/i.test(line))?.trim(),
      contextWindow: parsed.lines.filter(line => /thermalmonitord|missing sensor/i.test(line)).join('\n'),
    }));
  }

  if (hasWatchdog && targetProcess) {
    pushUnique(out, makeSignal({
      signalKey: 'watchdog_target_specific',
      category: 'watchdog',
      matchedText: targetProcess,
      normalizedValue: normalizeText(targetProcess),
      weight: 24,
      confidenceContribution: 12,
      ambiguityLevel: 'moderate',
      sourceLine: parsed.lines.find(line => line.toLowerCase().includes(targetProcess.toLowerCase()))?.trim(),
      contextWindow: parsed.lines.filter(line => line.toLowerCase().includes(targetProcess.toLowerCase())).slice(0, 3).join('\n'),
    }));
  }

  const familySignals: Array<[RegExp, string, string]> = [
    [/biometrickitd|pearl|truedepth|face[_ ]?id/i, 'face_id_sensitive_pattern', 'face_id'],
    [/camerad|isp panic|front camera|rear camera/i, 'camera_related_pattern', 'camera'],
    [/audiomxd|codec|audio route|speaker/i, 'audio_codec_pattern', 'codec'],
    [/baseband panic|commcenter|qmi|modem/i, 'baseband_pattern', 'baseband'],
    [/nand|nvme|apfs panic|storage|io error/i, 'nand_storage_pattern', 'storage'],
    [/i2c timeout|i2c nak|i2c fault|spi bus|spmi/i, 'i2c_fault_pattern', 'i2c'],
    [/rail droop|undervolt|overvolt|power sequencing|pmu/i, 'rail_instability_pattern', 'power'],
  ];

  for (const [re, signalKey, category] of familySignals) {
    if (!re.test(text)) continue;
    pushUnique(out, makeSignal({
      signalKey,
      category: category as DetectedSignal['category'],
      matchedText: text.match(re)?.[0] ?? signalKey,
      normalizedValue: signalKey,
      weight: 16,
      confidenceContribution: 10,
      ambiguityLevel: 'moderate',
    }));
  }

  if (/invalid memory access|kernel data abort|data abort|prefetch abort/i.test(text)) {
    pushUnique(out, makeSignal({
      signalKey: 'memory_access_fault',
      category: 'cpu_memory',
      matchedText: text.match(/invalid memory access|kernel data abort|data abort|prefetch abort/i)?.[0] ?? 'memory access fault',
      normalizedValue: 'memory_access_fault',
      weight: 30,
      confidenceContribution: 18,
      ambiguityLevel: 'low',
    }));
  }

  for (const metaSignal of buildMetaSignals(parsed)) pushUnique(out, metaSignal);

  return out;
}

export function buildParserSummary(parsed: ParsedLog, signals: DetectedSignal[]): ParserSummary {
  const reliabilityBase = 35;
  const metadataBoost = [
    parsed.metadata.hardwareModel,
    parsed.metadata.productType,
    parsed.metadata.iosVersion,
    parsed.metadata.kernelVersion,
    parsed.metadata.timestamp,
    parsed.metadata.panicString,
  ].filter(Boolean).length * 6;
  const signalBoost = Math.min(25, signals.length * 2);
  const evidenceBoost = Math.min(20, parsed.rawEvidences.length * 2);
  const rawScore = reliabilityBase + metadataBoost + signalBoost + evidenceBoost;
  const parseReliability = Math.max(0, Math.min(100, rawScore));
  const ambiguityLevel: ParserSummary['ambiguityLevel'] = parseReliability >= 75 ? 'low' : parseReliability >= 50 ? 'moderate' : 'high';
  const notes = [
    parsed.metadata.panicString ? 'panicString extraída' : 'panicString ausente',
    parsed.metadata.hardwareModel || parsed.metadata.productType ? 'modelo identificado' : 'modelo ausente',
    signals.length > 0 ? `${signals.length} sinais estruturados detectados` : 'nenhum sinal estruturado detectado',
  ];

  return {
    totalLines: parsed.lines.length,
    evidenceCount: parsed.rawEvidences.length,
    signalCount: signals.length,
    parseReliability,
    ambiguityLevel,
    notes,
  };
}
