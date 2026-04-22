/**
 * PanicLens — Real panic-full parser for iOS panic logs
 * Version: 1.0.0
 *
 * Handles: IPS (JSON header + payload), legacy panic.txt and full kernel panics.
 * Produces a normalized structure consumed by the Rules Engine.
 */

export const PARSER_VERSION = '1.0.0';

export type RawEvidence = {
  key: string;            // canonical key, e.g. "thermalmonitord_no_checkins"
  matchedText: string;    // verbatim slice from log
  context?: string;       // surrounding line(s)
  category?: string;      // hint for engine
  weight?: number;        // suggested raw weight
};

export type ParsedMetadata = {
  panicString?: string;
  panicReason?: string;
  bugType?: string;
  process?: string;
  responsibleProcess?: string;
  hardwareModel?: string;       // e.g. iPhone14,2
  productType?: string;
  deviceModel?: string;         // commercial, e.g. "iPhone 13 Pro"
  iosVersion?: string;
  kernelVersion?: string;
  buildVersion?: string;
  timestamp?: string;
  serial?: string;
};

export type ParsedLog = {
  parserVersion: string;
  metadata: ParsedMetadata;
  detectedCategories: string[];
  rawEvidences: RawEvidence[];
  normalizedText: string;       // lowercased, line-normalized
  lines: string[];
};

// -------- Helpers --------
const HW_TO_COMMERCIAL: Record<string, string> = {
  'iPhone10,1': 'iPhone 8', 'iPhone10,4': 'iPhone 8',
  'iPhone10,2': 'iPhone 8 Plus', 'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X', 'iPhone10,6': 'iPhone X',
  'iPhone11,2': 'iPhone XS', 'iPhone11,4': 'iPhone XS Max', 'iPhone11,6': 'iPhone XS Max', 'iPhone11,8': 'iPhone XR',
  'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro', 'iPhone12,5': 'iPhone 11 Pro Max', 'iPhone12,8': 'iPhone SE (2nd gen)',
  'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12', 'iPhone13,3': 'iPhone 12 Pro', 'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,2': 'iPhone 13 Pro', 'iPhone14,3': 'iPhone 13 Pro Max', 'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13',
  'iPhone14,6': 'iPhone SE (3rd gen)', 'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,1': 'iPhone 16 Pro', 'iPhone17,2': 'iPhone 16 Pro Max',
  'iPhone17,3': 'iPhone 16', 'iPhone17,4': 'iPhone 16 Plus',
};

function safeJSON<T = any>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { return null; }
}

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]).trim() : undefined;
}

function pushEvidence(arr: RawEvidence[], ev: RawEvidence) {
  // dedupe by key+matchedText
  if (!arr.some(e => e.key === ev.key && e.matchedText === ev.matchedText)) arr.push(ev);
}

// -------- Pattern catalog (parser-level, raw) --------
type Pattern = {
  key: string;
  category: string;
  re: RegExp;
  weight: number;
};

const PATTERNS: Pattern[] = [
  // thermal
  { key: 'thermalmonitord_no_checkins', category: 'thermal', weight: 35,
    re: /no successful checkins from (?:com\.apple\.)?thermalmonitord/i },
  { key: 'thermal_pressure', category: 'thermal', weight: 15,
    re: /thermal[_ ]pressure|thermal trap|thermal shutdown/i },
  { key: 'missing_sensors', category: 'sensors', weight: 30,
    re: /missing sensor\(s\)?:?\s*([A-Za-z0-9 _,\-]+)?/i },

  // watchdog
  { key: 'userspace_watchdog_timeout', category: 'watchdog', weight: 30,
    re: /userspace watchdog timeout/i },
  { key: 'kernel_watchdog', category: 'watchdog', weight: 25,
    re: /watchdog (?:timeout|expired|trip)/i },
  { key: 'wdog_no_checkins_generic', category: 'watchdog', weight: 20,
    re: /no successful checkins from ([\w\.\-]+) in \d+ seconds/i },

  // battery / charging
  { key: 'battery_comm_failure', category: 'battery', weight: 30,
    re: /(battery (?:auth|gas[\- ]?gauge|comm(?:unication)?) (?:failure|error|fault)|gasgauge|smartbattery)/i },
  { key: 'battery_health_anomaly', category: 'battery', weight: 15,
    re: /battery (?:health|state of charge|capacity) (?:anomal|invalid|out of range)/i },
  { key: 'charging_negotiation', category: 'charging', weight: 25,
    re: /(charging negotiation|tristar|hydra|usbc?_pd|pd negotiation|charge_port)/i },
  { key: 'dock_anomaly', category: 'dock_flex', weight: 25,
    re: /(dock(?: connector| accessory)?|appleidiagnostics.*dock|usb[_-]?dock)/i },

  // front sensors / proximity / face id
  { key: 'front_flex_ref', category: 'front_flex', weight: 20,
    re: /(front[_ ]?flex|earpiece flex|flood illuminator|als sensor|ambient light)/i },
  { key: 'proximity_ref', category: 'proximity', weight: 22,
    re: /(proximity (?:sensor|driver)|prox[_ ]?sensor)/i },
  { key: 'face_id_ref', category: 'face_id', weight: 35,
    re: /(face[_ ]?id|biometrickitd|pearl|sep face|trueDepth|dot projector|flood ill)/i },

  // camera / audio / codec
  { key: 'camera_ref', category: 'camera', weight: 25,
    re: /(camerad|isp panic|h\d+ camera|rear camera|front camera|telephoto)/i },
  { key: 'audio_ref', category: 'audio', weight: 22,
    re: /(audiomxd|coreaudio|audio panic|audio route|speakerd)/i },
  { key: 'codec_ref', category: 'codec', weight: 25,
    re: /(cs35l\d+|cs42l\d+|alc\d+|audio codec|codec timeout|codec i2c)/i },

  // baseband / modem
  { key: 'baseband_panic', category: 'baseband', weight: 45,
    re: /(baseband panic|bbpanic|commcenter.*baseband|qmi[_ ]?error)/i },
  { key: 'modem_crash', category: 'modem', weight: 40,
    re: /(modem crash|modem reset|m1 modem|mav\d+|qcom modem|sahara error)/i },

  // nand / storage
  { key: 'nand_anomaly', category: 'nand', weight: 45,
    re: /(nand error|nand panic|astris|appleastrisnand|s3e|nvme.*panic)/i },
  { key: 'storage_io_failure', category: 'storage', weight: 30,
    re: /(I\/O error|io error on disk|filesystem panic|apfs panic|mediakit error)/i },

  // power / rail / i2c
  { key: 'rail_instability', category: 'rail', weight: 30,
    re: /(rail (?:droop|undervolt|overvolt|short)|pp\w+_\w+ rail|voltage rail)/i },
  { key: 'pmu_power', category: 'power', weight: 25,
    re: /(pmu (?:fault|panic|reset)|power sequencing|power button stuck)/i },
  { key: 'i2c_fault', category: 'i2c', weight: 28,
    re: /(i2c (?:timeout|nak|fault|bus error)|smc.*i2c)/i },

  // cpu / memory
  { key: 'kernel_data_abort', category: 'cpu_memory', weight: 35,
    re: /(kernel data abort|data abort|prefetch abort|invalid kernel pointer|invalid memory access)/i },
  { key: 'sep_panic', category: 'cpu_memory', weight: 35,
    re: /(sep(?:os)? panic|secure enclave panic|aksd panic)/i },
  { key: 'peripheral_bus', category: 'peripheral_communication', weight: 20,
    re: /(spmi (?:fault|timeout)|spi bus error|peripheral communication (?:lost|fault))/i },

  // generic but valuable signals
  { key: 'panic_string_present', category: 'unknown', weight: 5,
    re: /panic\(cpu \d+ caller [^\)]+\):/i },
];

// -------- Main parse --------
export function parsePanicLog(input: string): ParsedLog {
  const trimmed = input.trim();

  // Detect IPS format: first line is JSON header, rest is JSON payload
  const meta: ParsedMetadata = {};
  let body = trimmed;

  if (trimmed.startsWith('{')) {
    // Could be a single-JSON IPS or header+payload
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline > 0) {
      const headerLine = trimmed.slice(0, firstNewline);
      const rest = trimmed.slice(firstNewline + 1);
      const header = safeJSON<any>(headerLine);
      const payload = safeJSON<any>(rest);
      if (header && payload) {
        meta.bugType = header.bug_type ?? payload.bug_type;
        meta.timestamp = header.timestamp ?? payload.timestamp;
        meta.iosVersion = payload.os_version || payload.build_version;
        meta.buildVersion = payload.build || payload.build_version;
        meta.kernelVersion = payload.kernel || payload.kernelVersion;
        meta.hardwareModel = payload.modelCode || payload.product || payload.hardware_model;
        meta.productType = payload.product || payload.productType;
        meta.process = payload.process || payload.procName;
        meta.responsibleProcess = payload.responsibleProcess;
        meta.panicString = payload.panicString || payload.panic_string;
        meta.panicReason = payload.reason;
        body = (payload.panicString as string) || (payload.callStack as string) || JSON.stringify(payload);
      } else {
        const single = safeJSON<any>(trimmed);
        if (single) {
          meta.panicString = single.panicString;
          body = single.panicString || JSON.stringify(single);
        }
      }
    }
  }

  // Plain-text fallbacks (work even if IPS JSON also present, complementing meta)
  meta.panicString ||= firstMatch(body, /panic\([^\)]+\): ?([^\n]+)/i);
  meta.panicReason ||= firstMatch(body, /Panic Reason:\s*([^\n]+)/i)
                    || firstMatch(body, /reason:\s*"([^"]+)"/i);
  meta.process ||= firstMatch(body, /Process:\s*([^\n]+)/i);
  meta.responsibleProcess ||= firstMatch(body, /Responsible Process:\s*([^\n]+)/i);
  meta.hardwareModel ||= firstMatch(body, /(?:Hardware Model|hardware_model|modelCode)\s*[:=]\s*([A-Za-z0-9,\-]+)/);
  meta.productType ||= firstMatch(body, /(?:Product Type|product)\s*[:=]\s*([A-Za-z0-9,\-]+)/);
  meta.iosVersion ||= firstMatch(body, /(?:iOS Version|OS Version|os_version)\s*[:=]\s*([^\n]+)/i);
  meta.kernelVersion ||= firstMatch(body, /Kernel Version:\s*([^\n]+)/i);
  meta.buildVersion ||= firstMatch(body, /Build:\s*([^\n]+)/i);
  meta.timestamp ||= firstMatch(body, /(?:Date\/Time|timestamp)\s*[:=]\s*([^\n]+)/i);
  meta.serial ||= firstMatch(body, /Serial(?:\s*Number)?:\s*([A-Z0-9]+)/i);

  if (meta.hardwareModel && HW_TO_COMMERCIAL[meta.hardwareModel]) {
    meta.deviceModel = HW_TO_COMMERCIAL[meta.hardwareModel];
  } else if (meta.productType && HW_TO_COMMERCIAL[meta.productType]) {
    meta.deviceModel = HW_TO_COMMERCIAL[meta.productType];
  }

  // Evidence extraction across the WHOLE input (covers both header/payload)
  const search = trimmed;
  const lines = search.split(/\r?\n/);
  const evidences: RawEvidence[] = [];
  const detectedCats = new Set<string>();

  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(search)) !== null) {
      const matchedText = m[0];
      // find line context
      const idx = m.index;
      const before = search.lastIndexOf('\n', idx);
      const after = search.indexOf('\n', idx);
      const ctxLine = search.slice(before + 1, after === -1 ? undefined : after).trim();

      pushEvidence(evidences, {
        key: p.key,
        matchedText: matchedText.slice(0, 240),
        context: ctxLine.slice(0, 400),
        category: p.category,
        weight: p.weight,
      });
      detectedCats.add(p.category);
      if (re.lastIndex === m.index) re.lastIndex++; // safety
      if (evidences.filter(e => e.key === p.key).length > 6) break; // cap per pattern
    }
  }

  // capture watchdog-targeted process when generic pattern triggered
  const wdogMatches = [...search.matchAll(/no successful checkins from ([\w\.\-]+) in \d+ seconds/gi)];
  for (const m of wdogMatches) {
    const proc = m[1];
    pushEvidence(evidences, {
      key: 'wdog_target_process',
      matchedText: m[0],
      context: `process=${proc}`,
      category: inferCategoryFromProcess(proc),
      weight: 18,
    });
    detectedCats.add(inferCategoryFromProcess(proc));
  }

  return {
    parserVersion: PARSER_VERSION,
    metadata: meta,
    detectedCategories: [...detectedCats],
    rawEvidences: evidences,
    normalizedText: search.toLowerCase(),
    lines,
  };
}

function inferCategoryFromProcess(proc: string): string {
  const p = proc.toLowerCase();
  if (p.includes('thermal')) return 'thermal';
  if (p.includes('biometric') || p.includes('pearl')) return 'face_id';
  if (p.includes('camera')) return 'camera';
  if (p.includes('audio') || p.includes('coreaudio')) return 'audio';
  if (p.includes('commcenter') || p.includes('baseband')) return 'baseband';
  if (p.includes('battery') || p.includes('gas')) return 'battery';
  if (p.includes('sep')) return 'cpu_memory';
  return 'watchdog';
}
