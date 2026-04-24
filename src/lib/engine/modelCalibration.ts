export const MODEL_CALIBRATION_VERSION = "1.0.0";

export type CalibrationBucket =
  | "legacy"
  | "x_series"
  | "iphone_11_family"
  | "iphone_12_family"
  | "iphone_13_family"
  | "iphone_14_family"
  | "iphone_15_family"
  | "iphone_16_family"
  | "future";

export type CalibrationRule = {
  categories: string[];
  confidenceDelta: number;
  boardChanceDelta: number;
  note: string;
};

export type BucketCalibration = {
  bucket: CalibrationBucket;
  minMajor: number;
  maxMajor: number;
  rules: CalibrationRule[];
};

export const MODEL_CALIBRATION_MATRIX: BucketCalibration[] = [
  {
    bucket: "legacy",
    minMajor: 1,
    maxMajor: 9,
    rules: [
      {
        categories: ["battery", "charging", "dock_flex"],
        confidenceDelta: 2,
        boardChanceDelta: -6,
        note: "Modelo legado: priorizar periféricos de energia/carga antes de placa.",
      },
    ],
  },
  {
    bucket: "x_series",
    minMajor: 10,
    maxMajor: 10,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 4,
        boardChanceDelta: 6,
        note: "Família X: sistema Face ID é sensível e com maior risco estrutural.",
      },
      {
        categories: ["battery", "charging", "dock_flex"],
        confidenceDelta: 2,
        boardChanceDelta: -4,
        note: "Família X: falhas de carga costumam responder melhor a trilha periférica primeiro.",
      },
    ],
  },
  {
    bucket: "iphone_11_family",
    minMajor: 11,
    maxMajor: 12,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 4,
        boardChanceDelta: 6,
        note: "Família 11: Face ID com forte peso para diagnóstico sensível.",
      },
      {
        categories: ["baseband", "modem"],
        confidenceDelta: 2,
        boardChanceDelta: 4,
        note: "Família 11: eventos de modem/baseband merecem atenção board-level cedo.",
      },
    ],
  },
  {
    bucket: "iphone_12_family",
    minMajor: 13,
    maxMajor: 13,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 4,
        boardChanceDelta: 6,
        note: "Família 12: Face ID permanece altamente sensível a falhas estruturais.",
      },
      {
        categories: ["baseband", "modem", "nand", "cpu_memory"],
        confidenceDelta: 3,
        boardChanceDelta: 5,
        note: "Família 12: subsistemas críticos indicam maior chance de board-level.",
      },
    ],
  },
  {
    bucket: "iphone_13_family",
    minMajor: 14,
    maxMajor: 14,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 4,
        boardChanceDelta: 6,
        note: "Família 13: falhas Face ID tratadas com viés de risco técnico elevado.",
      },
      {
        categories: ["baseband", "modem", "nand", "cpu_memory"],
        confidenceDelta: 3,
        boardChanceDelta: 5,
        note: "Família 13: falhas críticas tendem a escalar para placa especializada.",
      },
    ],
  },
  {
    bucket: "iphone_14_family",
    minMajor: 15,
    maxMajor: 15,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 4,
        boardChanceDelta: 7,
        note: "Família 14: diagnóstico Face ID com maior peso de risco board-level.",
      },
      {
        categories: ["baseband", "modem", "nand", "cpu_memory"],
        confidenceDelta: 3,
        boardChanceDelta: 6,
        note: "Família 14: eventos críticos aumentam probabilidade de intervenção em placa.",
      },
    ],
  },
  {
    bucket: "iphone_15_family",
    minMajor: 16,
    maxMajor: 16,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 4,
        boardChanceDelta: 7,
        note: "Família 15: Face ID com viés conservador para reparo estrutural.",
      },
      {
        categories: ["baseband", "modem", "nand", "cpu_memory"],
        confidenceDelta: 4,
        boardChanceDelta: 6,
        note: "Família 15: falhas em subsistemas críticos costumam exigir bancada avançada.",
      },
    ],
  },
  {
    bucket: "iphone_16_family",
    minMajor: 17,
    maxMajor: 17,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 5,
        boardChanceDelta: 8,
        note: "Família 16: alta sensibilidade em cadeia Face ID/TrueDepth.",
      },
      {
        categories: ["baseband", "modem", "nand", "cpu_memory"],
        confidenceDelta: 4,
        boardChanceDelta: 7,
        note: "Família 16: subsistemas críticos favorecem rota board-level especializada.",
      },
    ],
  },
  {
    bucket: "future",
    minMajor: 18,
    maxMajor: 99,
    rules: [
      {
        categories: ["face_id"],
        confidenceDelta: 5,
        boardChanceDelta: 8,
        note: "Geração recente: Face ID tratado com cautela máxima.",
      },
      {
        categories: ["baseband", "modem", "nand", "cpu_memory"],
        confidenceDelta: 4,
        boardChanceDelta: 7,
        note: "Geração recente: anomalias críticas priorizam diagnóstico board-level.",
      },
    ],
  },
];

export function resolveCalibration(major: number, category: string): {
  applied: boolean;
  confidenceDelta: number;
  boardChanceDelta: number;
  note?: string;
} {
  const bucket = MODEL_CALIBRATION_MATRIX.find(b => major >= b.minMajor && major <= b.maxMajor);
  if (!bucket) return { applied: false, confidenceDelta: 0, boardChanceDelta: 0 };
  const rule = bucket.rules.find(r => r.categories.includes(category));
  if (!rule) return { applied: false, confidenceDelta: 0, boardChanceDelta: 0 };
  return {
    applied: true,
    confidenceDelta: rule.confidenceDelta,
    boardChanceDelta: rule.boardChanceDelta,
    note: rule.note,
  };
}

function normalizeHardwareModel(modelCode: string): string {
  return modelCode.trim().toLowerCase();
}

function bucketForHardwareModel(modelCode: string): CalibrationBucket | null {
  const normalized = normalizeHardwareModel(modelCode);
  if (!normalized) return null;

  if (/^iphone10,(1|2|4|5)$/.test(normalized)) return 'legacy';
  if (/^iphone10,(3|6)$/.test(normalized)) return 'x_series';
  if (/^iphone11,/.test(normalized)) return 'iphone_11_family';
  if (/^iphone12,/.test(normalized)) return 'iphone_12_family';
  if (/^iphone13,/.test(normalized)) return 'iphone_13_family';
  if (/^iphone14,/.test(normalized)) return 'iphone_14_family';
  if (/^iphone15,/.test(normalized)) return 'iphone_15_family';
  if (/^iphone16,/.test(normalized)) return 'iphone_16_family';
  if (/^iphone17,/.test(normalized)) return 'future';

  return null;
}

export function resolveCalibrationForModel(modelCode: string, category: string): {
  applied: boolean;
  confidenceDelta: number;
  boardChanceDelta: number;
  note?: string;
} {
  const bucketKey = bucketForHardwareModel(modelCode);
  if (bucketKey) {
    const bucket = MODEL_CALIBRATION_MATRIX.find(entry => entry.bucket === bucketKey);
    const rule = bucket?.rules.find(r => r.categories.includes(category));
    if (rule) {
      return {
        applied: true,
        confidenceDelta: rule.confidenceDelta,
        boardChanceDelta: rule.boardChanceDelta,
        note: rule.note,
      };
    }
  }

  const major = parseIphoneMajor(modelCode);
  if (major === null) return { applied: false, confidenceDelta: 0, boardChanceDelta: 0 };
  return resolveCalibration(major, category);
}

function parseIphoneMajor(modelCode: string): number | null {
  const match = modelCode.match(/iphone(\d+),\d+/i);
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}

